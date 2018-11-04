<div align="center">


# Group MMS Bot

<a href="http://dev.bandwidth.com"><img src="https://s3.amazonaws.com/bwdemos/BW_Messaging.png"/></a>
</div>

Group MMS bot powered by [Bandwidth](https://dev.bandwidth.com/v2-messaging/).

If you want to learn more, please contact [openapi@bandwidth.com](mailto:openapi@bandwidth.com) or call (888) 686-9944.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)


## Usage Commands

Add `{{Your-TN}}` to a new group message thread (or directly) and text:

* `@gif phrase` -> Pulls gif from [Giphy](http://giphy.com/)

Anything else is ignored and your chat continues as normal

![Demo](gif_demo.gif)

## Deploy

### This demo will use the:
* Giphy Search API
* Bandwidth V2 Group Messaging

### Basic Flow
1. Receive incoming message event
2. Ensure `message.direction == ‘in’` . We’re ignoring DLRs for now
3. Check the text string starts with `@gif`. If not, ignore the message.
4. Extract the string after the `@gif `.
5. Search [GIPHY for Developers](https://developers.giphy.com/) for the phrase
6. Pick a random GIF from the response
7. Send the GIF to the group!

### Pre Reqs
* [Bandwidth Credentials](https://dev.bandwidth.com/v2-messaging/accountCredentials.html)
* Bandwidth [`/application`](https://dev.bandwidth.com/v2-messaging/applications/about.html) configured with group messaging.

### Env Vars
* `BANDWIDTH_USER_ID`
* `BANDWIDTH_API_TOKEN`
* `BANDWIDTH_API_SECRET`

### Run
`npm install`
`npm start`

---

### About

#### Search GIPHY

The GIPHY API returns a list of GIF responses with various sizes and metadata  about the image.  Since we’re going to attach this as an MMS, we need to search for any version of the GIF that is less than 1.5MB.

##### Sample GIPHY Response

```json
{
  "type": "gif",
  "id": "...",
  "...": "...",
  "images": {
    "fixed_height_still": {
      "url": "https:\/\/..com\/.../cid={gifID}",
      "width": "358",
      "height": "200",
      "size": "50867",
    },
    "...": {
      "url": "https:\/\/..com\/.../cid={gifID}",
      "width": "499",
      "height": "279",
      "size": "108964",
    }
  }
}
```

##### Sample Async NodeJS Function to search for GIF

```js
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
```

#### Attach and Send the GIF

Bandwidth’s API takes a JSON request with a few parameters to send a group message. Primarily an array of phone numbers and an array of mediaURLs to attach to the message.

##### Sample HTTP Request to Group Message API

```http
POST https://api.catapult.inetwork.com/v2/users/{userId}/messages HTTP/1.1
Content-Type: application/json; charset=utf-8
Authorization: {apiToken:apiSecret}

{
    "to"            : [
      "+12345678902",
      "+12345678903"
    ],
    "from"          : "+12345678901",
    "text"          : "GIF for: crazy cat",
    "applicationId" : "93de2206-9669-4e07-948d-329f4b722ee2",
    "media"         : [
      "https://...com/.../cid={gifID}"
    ]
}
```

#### Sample Express Middleware to build a Group Message.

```js
/**
* Middleware the process the incoming text and look for GIF.
* Once GIF is found, send it back to the group.
* If no GIF is found, send a message letting the group know 😞
**/
module.exports.processMessage = async (req, res, next) => {
  // Callbacks are arrays of 1, take first one
  const message = req.body[0];
  // Extract anything after `@gif `
  const query = extractQuery(message.message.text);
  // Serach giphy for
  const mediaUrl = await getGifUrl(query);
  // Build Message to send
  const outMessage = {
    to            : buildToArray(message),
    from          : message.to,
    applicationId : message.message.applicationId
  };
  if (!mediaUrl) {
    outMessage.text = `😞 Unable to find gif for ${query}`;
  }
  else {
    outMessage.text = `GIF for: ${query}`;
    outMessage.media = [mediaUrl];
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
```



![Powered by](giphy.png)