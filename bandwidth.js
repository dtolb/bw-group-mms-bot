const axios      = require('axios');
let giphy        = require('giphy-api')();
const debug      = require('debug')('giphy_sms');
const shuffle    = require('knuth-shuffle').knuthShuffle;
const Scry = require("scryfall-sdk");

const userId     = process.env.BANDWIDTH_USER_ID;
const apiToken   = process.env.BANDWIDTH_API_TOKEN;
const apiSecret  = process.env.BANDWIDTH_API_SECRET;
const maxGifSize = 1500000;

if (!userId || !apiToken || !apiSecret ) {
  throw new Error('Invalid or non-existing Bandwidth credentials. \Please set your: \n * userId \n * apiToken \n * apiSecret');
}

const searchScryFall = async cardName => {
  debug(`Search Scryfall for ${cardName}`);
  try {
    const card = await Scry.Cards.byName(cardName, true);
    if (card.data.length < 1) {
      debug('No card found');
      return {
        hasCard: false,
        message: null
      };
    }
    debug(`Found card`);
    debug(card);
    const prices = {
      normal: card.prices.usd,
      foil: card.prices.usd_foil,
    };
    const message = {
      mediaUrl: card.image_uris.normal,
      text: `Normal: \$${prices.normal} \n Foil: \$${prices.foil}`
    }
    return {
      hasCard: true,
      message
    }
  }
  catch (err) {
    debug('Error searching scrfall');
    debug(err);
    return {
      hasCard: false,
      message: null
    }
  }
};

const messageV2API = axios.create({
  baseURL: `https://messaging.bandwidth.com/api/v2/users/${userId}/messages`,
  auth: {
    username: apiToken,
    password: apiSecret
  },
  headers: {
    'Content-type': 'application/json',
    'Accept': 'application/json'
  }
});

const buildToArray = (message) => {
  let toNumbers = message.message.to;
  let index = toNumbers.indexOf(message.to);
  if (index > -1 ) {
    toNumbers.splice(index, 1);
  }
  toNumbers.push(message.message.from);
  return toNumbers;
};

const sendMessage = async (message) => {
  debug('Sending Message')
  debug(message);
  try {
    const outMessage = await messageV2API.post('', message);
    debug('Sent Message');
    return outMessage.data;
  }
  catch (e) {
    debug('Error sending message');
    debug(e);
    return 'Error Sending Message';
  }
};

const extractQuery = (text) => {
  text = text.toLowerCase().substr(1);
  const command = text.split(' ')[0];
  const query = text.replace(command, '').trim();
  return query;
};

/**
* Search GIPHY for random GIF < maxGifSize
* @returns {STRING} Returns GIF URL
**/
const getGifUrl = async (query) => {
  try {
    const gifs = await giphy.search(query);
    // Search for random GIF < maxGifSize
    const gifUrl = searchGifResponse(gifs);
    return gifUrl;
  }
  catch (e) {
    debug(e);
    return false;
  }
};

const extractCard = text => {
  const mtgCards = text.match(/\[\[(.*)\]\]/);
  if (!mtgCards) {
    return {
      hasCard: false,
      cardName: null
    };
  }
  const cardName = (mtgCards.pop()).trim();
  return {
    hasCard: true,
    cardName,
  };
}

const searchGifResponse = (gifs) => {
  if (!gifs.data) {
    throw new Error('No data in gif response');
  }
  let gifUrl = '';
  shuffle(gifs.data);
  gifSearch:
  for (let i = 0; i < gifs.data.length; i++) {
    let gif = gifs.data[i]
    for (key in gif.images) {
      let pict = gif.images[key];
      debug('Gif Size: %s', pict.size);
      if (pict.size < maxGifSize) {
        gifUrl = pict.url;
        debug('Found Gif!: ', gifUrl)
        break gifSearch;
      }
    }
  }
  debug('Gif Url: %s', gifUrl);
  return gifUrl;
};


module.exports.sendAccepted = (req, res, next) => {
  res.sendStatus(201);
  debug('Sent 201');
  next();
  return;
};

module.exports.checkIfBodyIsArray = (req, res, next) => {
  debug('Checking if body is array')
  if(Array.isArray(req.body)){
    debug('Req body is array');
    next();
    return;
  }
  else {
    var e = new Error('Message body not array');
    debug(e);
  }
};

module.exports.validateMessage = (req, res, next) => {
  const message = req.body[0];
  const isDLR = (message && message.message && message.message.direction == 'out');
  if (isDLR){
    return;
  }
  const messageText = message.message.text.toLowerCase();
  const isGifCommand = (messageText.startsWith('@gif '));
  res.locals.isGifCommand = isGifCommand;
  const card = extractCard(messageText);
  res.locals.card = card;
  if (isGifCommand) {
    debug('Incoming Message with GIF Command!');
    next();
    return;
  }
  else if (card.hasCard){
    debug('Incoming Message with MTG Command');
    next();
    return;
  }
  else {
    debug('Outbound message DLR or no GIF command');
    debug(message);
    return;
  }
};

/**
* Middleware the process the incoming text and look for GIF.
* Once GIF is found, send it back to the group.
* If no GIF is found, send a message letting the group know 😞
**/
module.exports.processMessage = async (req, res, next) => {
  // Callbacks are arrays of 1, take firstr one
  const message = req.body[0];

  // Build Message to send
  const outMessage = {
    to            : buildToArray(message),
    from          : message.to,
    applicationId : message.message.applicationId
  };
  debug(res.locals);
  if (res.locals.isGifCommand) {
    // Extract anything after `@gif `
    const query = extractQuery(message.message.text);
    // Serach giphy for
    const mediaUrl = await getGifUrl(query);
    if (!mediaUrl) {
      outMessage.text = `😞 Unable to find gif for ${query}`;
    }
    else {
      outMessage.text = `GIF for: ${query}`;
      outMessage.media = [mediaUrl];
    }
  }
  else if (res.locals.card.hasCard) {
    debug('Searching for mtg card');
    const cardName = res.locals.card.cardName
    const card = await searchScryFall(cardName);
    debug(card);
    if (card.hasCard) {
      outMessage.text = card.message.text;
      outMessage.media = [card.message.mediaUrl];
    }
    else {
      outMessage.text = `😞 Nothing on ScryFall for "${cardName}"`;
    }
  }
  res.locals.outMessage = outMessage;
  next();
};

/**
* Middleware to actualy send the Message in res.locals.outMessage;
**/
module.exports.sendMessage = async (req, res) => {
  const message = res.locals.outMessage;
  // Make API request to send message
  const messageResponse = await sendMessage(message);
  debug(messageResponse);
  return;
}
