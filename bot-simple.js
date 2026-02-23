const express = require('express');
const CryptoJS = require('crypto-js');
const axios = require('axios');

// 配置
const CONFIG = {
  corpId: process.env.WECOM_CORP_ID || '',
  agentId: process.env.WECOM_AGENT_ID || '',
  secret: process.env.WECOM_SECRET || '',
  token: process.env.WECOM_TOKEN || '',
  encodingAesKey: process.env.WECOM_ENCODING_AES_KEY || '',
  port: process.env.PORT || 3000,
};

// 企业微信 API
class WeComAPI {
  constructor(corpId, secret, agentId) {
    this.corpId = corpId;
    this.secret = secret;
    this.agentId = agentId;
    this.accessToken = null;
    this.tokenExpireTime = 0;
  }

  async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpireTime) {
      return this.accessToken;
    }
    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${this.corpId}&corpsecret=${this.secret}`;
    const res = await axios.get(url);
    if (res.data.errcode !== 0) {
      throw new Error(`获取token失败: ${res.data.errmsg}`);
    }
    this.accessToken = res.data.access_token;
    this.tokenExpireTime = Date.now() + (res.data.expires_in - 300) * 1000;
    return this.accessToken;
  }

  async sendTextMessage(userId, content) {
    const token = await this.getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`;
    const data = {
      touser: userId,
      msgtype: 'text',
      agentid: this.agentId,
      text: { content },
    };
    const res = await axios.post(url, data);
    if (res.data.errcode !== 0) {
      throw new Error(`发送消息失败: ${res.data.errmsg}`);
    }
    return res.data;
  }
}

// 消息处理
class WeComBot {
  constructor(config) {
    this.config = config;
    this.api = new WeComAPI(config.corpId, config.secret, config.agentId);
    this.app = express();
    this.setupRoutes();
  }

  setupRoutes() {
    this.app.use(express.text({ type: 'text/xml' }));
    this.app.use(express.json());

    // 健康检查 / 验证页面
    this.app.get('/', (req, res) => {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>WeCom Bot</title></head>
        <body>
          <h1>Bot is running!</h1>
          <p>Status: OK</p>
          <p>CorpID: ${this.config.corpId.slice(0, 8)}...</p>
          <p>Webhook: /wecom</p>
        </body>
        </html>
      `);
    });

    // 企业微信验证URL
    this.app.get('/wecom', (req, res) => {
      const { msg_signature, timestamp, nonce, echostr } = req.query;
      console.log('URL验证:', { msg_signature, timestamp, nonce });
      // 简化验证，直接返回echostr
      res.send(echostr);
    });

    // 接收消息
    this.app.post('/wecom', async (req, res) => {
      const xml = req.body;
      console.log('收到消息:', xml);
      
      const msg = this.parseXml(xml);
      const reply = await this.handleMessage(msg);
      
      if (reply) {
        const replyXml = this.buildReplyXml(msg.FromUserName, msg.ToUserName, reply);
        res.type('application/xml');
        res.send(replyXml);
      } else {
        res.send('success');
      }
    });

    // API: 主动发送消息
    this.app.post('/api/send', async (req, res) => {
      try {
        const { userId, message } = req.body;
        await this.api.sendTextMessage(userId, message);
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
  }

  parseXml(xml) {
    const result = {};
    const regex = /<(\w+)><!\[CDATA\[(.*?)\]\]><\/\w+>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      result[match[1]] = match[2];
    }
    const regex2 = /<(\w+)>([^<]+)<\/\w+>/g;
    while ((match = regex2.exec(xml)) !== null) {
      if (!result[match[1]]) {
        result[match[1]] = match[2];
      }
    }
    return result;
  }

  buildReplyXml(toUser, fromUser, content) {
    const time = Math.floor(Date.now() / 1000);
    return `<xml>
<ToUserName><![CDATA[${toUser}]]></ToUserName>
<FromUserName><![CDATA[${fromUser}]]></FromUserName>
<CreateTime>${time}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${content}]]></Content>
</xml>`;
  }

  async handleMessage(msg) {
    const { FromUserName, Content, MsgType } = msg;
    if (MsgType !== 'text') return null;
    
    console.log(`${FromUserName}: ${Content}`);

    const text = Content.trim();
    if (text === 'ping') return 'pong';
    if (text === '你好') return `你好, ${FromUserName}!`;
    if (text === '帮助' || text === 'help') {
      return '命令列表:\n• ping - 测试\n• 你好 - 打招呼\n• 帮助 - 显示帮助';
    }

    return `收到: "${text}"\n(发送"帮助"查看命令)`;
  }

  start() {
    this.app.listen(this.config.port, () => {
      console.log(`WeCom Bot started on port ${this.config.port}`);
      console.log(`Webhook URL: http://your-domain:${this.config.port}/wecom`);
      
      if (!this.config.corpId || !this.config.secret || !this.config.agentId) {
        console.log('Warning: Missing WeCom config');
      } else {
        console.log(`CorpID: ${this.config.corpId.slice(0, 8)}...`);
        console.log(`AgentID: ${this.config.agentId}`);
      }
    });
  }
}

module.exports = { WeComBot, WeComAPI };

// 直接运行
if (require.main === module) {
  const bot = new WeComBot(CONFIG);
  bot.start();
}
