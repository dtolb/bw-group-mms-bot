# Group MMS Bot

Group MMS bot powered by [Bandwidth](https://dev.bandwidth.com/v2-messaging/).

If you want to learn more, please contact [openapi@bandwidth.com](mailto:openapi@bandwidth.com) or call (888) 686-9944.

## Usage Commands

Add `{{Your-TN}}` to a new group message thread (or directly) and text:

* `@gif phrase` -> Pulls gif from [Giphy](http://giphy.com/)

Anything else is ignored and your chat continues as normal

![Demo](gif_demo.gif)

## Deploy

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

![Powered by](giphy.png)