const axios      = require('axios');
let giphy        = require('giphy-api')();
const debug      = require('debug')('giphy_sms');
const shuffle    = require('knuth-shuffle').knuthShuffle;

const userId     = process.env.BANDWIDTH_USER_ID;
const apiToken   = process.env.BANDWIDTH_API_TOKEN;
const apiSecret  = process.env.BANDWIDTH_API_SECRET;
const maxGifSize = 1500000;

if (!userId || !apiToken || !apiSecret ) {
  throw new Error('Invalid or non-existing Bandwidth credentials. \Please set your: \n * userId \n * apiToken \n * apiSecret');
}

const messageV2API = axios.create({
  baseURL: `https://api.catapult.inetwork.com/v2/users/${userId}/messages`,
  auth: {
    username: apiToken,
    password: apiSecret
  },
  headers: {
    'Content-type': 'application/json',
    'Accept': 'application/json'
  }
});

const buildToArray = function (message) {
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

const extractQuery = function (text) {
  text = text.toLowerCase().substr(1);
  const command = text.split(' ')[0];
  const query = text.replace(command, '').trim();
  return query;
};

const getGifUrl = async (query) => {
  try {
    const gifs = await giphy.search(query);
    const gifUrl = searchGifResponse(gifs);
    return gifUrl;
  }
  catch (e) {
    debug(e);
    return false;
  }
};

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
}


module.exports.sendAccepted = function (req, res, next) {
  res.sendStatus(201);
  debug('Sent 201');
  next();
  return;
};

module.exports.checkIfBodyIsArray = function (req, res, next) {
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
  const isIncomingMessage = (message && message.message && message.message.direction == 'in');
  const hasGifCommand = (message && message.message && message.message.text.toLowerCase().startsWith('@gif '));
  if (isIncomingMessage && hasGifCommand) {
    debug('Incoming Message with GIF Command!');
    next();
    return;
  }
  else {
    debug('Outbound message DLR or no GIF command');
    debug(message);
    return;
  }
};

module.exports.processMessage = async (req, res, next) => {
  const message = req.body[0];
  const query = extractQuery(message.message.text);
  const mediaUrl = await getGifUrl(query);
  const outMessage = {
    to            : buildToArray(message),
    from          : message.to,
    applicationId : message.message.applicationId
  };
  if (!mediaUrl) {
    outMessage.text = `Unable to find gif for ${query}`;
  }
  else {
    outMessage.text = `GIF for: ${query}`;
    outMessage.media = [mediaUrl];
  }
  res.locals.outMessage = outMessage;
  next();
};

module.exports.sendMessage = async (req, res) => {
  const message = res.locals.outMessage;
  const messageResponse = await sendMessage(message);
  debug(messageResponse);
  return;
}
