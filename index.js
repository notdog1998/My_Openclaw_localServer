require('dotenv').config();
const { WeComBot } = require('./bot-simple');

const CONFIG = {
  corpId: process.env.WECOM_CORP_ID,
  agentId: process.env.WECOM_AGENT_ID,
  secret: process.env.WECOM_SECRET,
  token: process.env.WECOM_TOKEN,
  encodingAesKey: process.env.WECOM_ENCODING_AES_KEY,
  port: process.env.PORT || 3000,
};

const bot = new WeComBot(CONFIG);
bot.start();
