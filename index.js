const bodyParser = require('body-parser');
const debug = require('debug')('giphy_sms');
const bandwidth = require('./bandwidth.js');
const name = 'giphy_sms';
const CALLBACK_PATH = '/callback/message';
debug('booting %s', name);

const express = require('express');
let app = express();

function startServer() {
  debug('Starting Server');
  app.use(bodyParser.json());
  app.get('/', function (req, res) {
    res.send(`Hello World 👋 🌎, be sure to set the callback url to http://${req.hostname}${CALLBACK_PATH}`);
  });
  app.post('CALLBACK_PATH',
           bandwidth.sendAccepted,
           bandwidth.checkIfBodyIsArray,
           bandwidth.validateMessage,
           bandwidth.processMessage,
           bandwidth.sendMessage);
  /// catch 404 and forward to error handler
  app.use(function (req, res, next) {
    //debug(req)
    debug(req.body)
    debug(req.url)
    var err = new Error('not found');
    err.status = 404;
    res.sendStatus(404, 'Not Found')
  });

  const port = process.env.PORT || 3000;
  app.listen(port, process.env.HOST || "0.0.0.0", function () {
    console.log('Group Messaging Bot listening on port ' + port);
  });
}

startServer()
