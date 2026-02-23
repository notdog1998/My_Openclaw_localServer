const express = require('express');
const CryptoJS = require('crypto-js');
const axios = require('axios');

// ============ 配置（从环境变量或 .env 读取） ============
const CONFIG = {
  // 企业微信配置
  corpId: process.env.WECOM_CORP_ID || '',           // 企业ID
  agentId: process.env.WECOM_AGENT_ID || '',         // 应用ID
  secret: process.env.WECOM_SECRET || '',            // 应用Secret
  token: process.env.WECOM_TOKEN || '',              // 接收消息的Token
  encodingAesKey: process.env.WECOM_ENCODING_AES_KEY || '',  // 接收消息的EncodingAESKey
  
  // 服务器配置
  port: process.env.PORT || 3000,
  
  // 可选：管理员企业微信ID（用于区分权限）
  adminUserId: process.env.ADMIN_USER_ID || '',
};

// ============ 企业微信 API 封装 ============
class WeComAPI {
  constructor(corpId, secret, agentId) {
    this.corpId = corpId;
    this.secret = secret;
    this.agentId = agentId;
    this.accessToken = null;
    this.tokenExpireTime = 0;
  }

  // 获取 access_token
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
    // 提前5分钟过期
    this.tokenExpireTime = Date.now() + (res.data.expires_in - 300) * 1000;
    console.log('✅ AccessToken 已更新');
    return this.accessToken;
  }

  // 发送文本消息给用户
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

  // 发送消息到群聊
  async sendTextToChat(chatId, content) {
    const token = await this.getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/appchat/send?access_token=${token}`;
    
    const data = {
      chatid: chatId,
      msgtype: 'text',
      text: { content },
      safe: 0,
    };

    const res = await axios.post(url, data);
    if (res.data.errcode !== 0) {
      throw new Error(`发送群消息失败: ${res.data.errmsg}`);
    }
    return res.data;
  }

  // 获取用户信息
  async getUserInfo(userId) {
    const token = await this.getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/user/get?access_token=${token}&userid=${userId}`;
    const res = await axios.get(url);
    return res.data;
  }
}

// ============ 消息加解密（企业微信标准实现） ============
class WXBizMsgCrypt {
  constructor(token, encodingAesKey, corpId) {
    this.token = token;
    this.corpId = corpId;
    // Base64解码得到AESKey
    this.aesKey = Buffer.from(encodingAesKey + '=', 'base64');
  }

  // 验证URL签名
  verifyUrl(signature, timestamp, nonce, echoStr) {
    const calcSign = this.getSignature(timestamp, nonce, echoStr);
    return calcSign === signature;
  }

  // 生成签名
  getSignature(timestamp, nonce, msgEncrypt) {
    const arr = [this.token, timestamp, nonce, msgEncrypt].sort();
    const str = arr.join('');
    return CryptoJS.SHA1(str).toString();
  }

  // 解密消息
  decrypt(msgEncrypt) {
    const aesKey = this.aesKey;
    const encrypted = Buffer.from(msgEncrypt, 'base64');
    
    // 使用 crypto-js 进行 AES-256-CBC 解密
    const key = CryptoJS.enc.Base64.parse(aesKey.toString('base64'));
    const iv = CryptoJS.enc.Base64.parse(aesKey.slice(0, 16).toString('base64'));
    const encryptedData = CryptoJS.enc.Base64.parse(msgEncrypt);
    
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: encryptedData },
      key,
      { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    );
    
    const result = decrypted.toString(CryptoJS.enc.Utf8);
    // 解析XML格式
    const content = result.substring(16); // 跳过随机字符串长度
    const msgLen = parseInt(content.substring(0, 4), 16);
    const msg = content.substring(4, 4 + msgLen);
    
    return msg;
  }
}

// ============ Bot 逻辑 ============
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
    this.app.use(express.urlencoded({ extended: true }));

    // 健康检查
    this.app.get('/', (req, res) => {
      res.json({ status: 'ok', bot: 'WeCom Bot' });
    });

    // 企业微信验证URL接口
    this.app.get('/wecom', (req, res) => {
      const { msg_signature, timestamp, nonce, echostr } = req.query;
      
      if (!this.config.token || !this.config.encodingAesKey) {
        console.log('⚠️ 未配置Token/AESKey，直接返回echostr用于验证');
        return res.send(echostr);
      }

      const crypt = new WXBizMsgCrypt(
        this.config.token,
        this.config.encodingAesKey,
        this.config.corpId
      );

      if (crypt.verifyUrl(msg_signature, timestamp, nonce, echostr)) {
        console.log('✅ URL验证成功');
        const decrypted = crypt.decrypt(echostr);
        res.send(decrypted);
      } else {
        console.log('❌ URL验证失败');
        res.status(403).send('Forbidden');
      }
    });

    // 接收消息接口
    this.app.post('/wecom', async (req, res) => {
      const xml = req.body;
      console.log('\n📩 收到消息:', xml);

      // 简单解析XML（生产环境用 xml2js 库）
      const msg = this.parseXml(xml);
      
      // 回复消息
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

  // 简单XML解析
  parseXml(xml) {
    const result = {};
    const regex = /\<(\w+)\>\<!\[CDATA\[(.*?)\]\]\>\<\/\w+\>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      result[match[1]] = match[2];
    }
    // 也匹配没有CDATA的
    const regex2 = /\<(\w+)\>([^<]+)\<\/\w+\>/g;
    while ((match = regex2.exec(xml)) !== null) {
      if (!result[match[1]]) {
        result[match[1]] = match[2];
      }
    }
    return result;
  }

  // 构建回复XML
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

  // 处理消息逻辑
  async handleMessage(msg) {
    const { FromUserName, Content, MsgType } = msg;
    
    if (MsgType !== 'text') return null;
    
    console.log(`\n💬 ${FromUserName}: ${Content}`);

    // 命令处理
    const text = Content.trim();
    
    if (text === 'ping') {
      return 'pong 🏓';
    }
    
    if (text === '你好' || text === 'hi') {
      return `你好！我是 NTJ 🤖\n收到你的消息: "${text}"`;
    }
    
    if (text === '帮助' || text === 'help') {
      return `🤖 命令列表：
• ping - 测试
• 你好 / hi - 打招呼
• 帮助 / help - 显示帮助
• 我的ID - 查看你的企业微信ID`;
    }
    
    if (text === '我的ID') {
      return `你的企业微信ID: ${FromUserName}`;
    }

    // 默认回复
    return `收到: "${text}"\n（发送"帮助"查看命令）`;
  }

  start() {
    this.app.listen(this.config.port, () => {
      console.log(`\n🚀 WeCom Bot 已启动`);
      console.log(`📡 监听端口: ${this.config.port}`);
      console.log(`🔗 回调地址: http://你的域名/wecom`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      // 检查配置
      if (!this.config.corpId || !this.config.secret || !this.config.agentId) {
        console.log('\n⚠️ 警告: 缺少企业微信配置，请先设置环境变量或修改 CONFIG');
        console.log('需要配置: WECOM_CORP_ID, WECOM_AGENT_ID, WECOM_SECRET');
      } else {
        console.log('\n✅ 基础配置已加载');
        console.log(`• CorpID: ${this.config.corpId.slice(0, 6)}...`);
        console.log(`• AgentID: ${this.config.agentId}`);
      }
    });
  }
}

// ============ 启动 ============
module.exports = { WeComBot, WeComAPI, WXBizMsgCrypt };

// 如果直接运行
if (require.main === module) {
  const bot = new WeComBot(CONFIG);
  bot.start();
}
