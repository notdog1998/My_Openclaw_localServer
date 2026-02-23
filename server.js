require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3456;

const CONFIG = {
  corpId: process.env.WECOM_CORP_ID,
  agentId: process.env.WECOM_AGENT_ID,
  secret: process.env.WECOM_SECRET,
  token: process.env.WECOM_TOKEN,
  encodingAesKey: process.env.WECOM_ENCODING_AES_KEY,
  // OpenClaw 配置
  openclaw: {
    baseUrl: process.env.OPENCLAW_URL || 'http://127.0.0.1:18789',
    token: process.env.OPENCLAW_TOKEN,
    agentId: process.env.OPENCLAW_AGENT_ID || 'main',
  }
};

// ============ 企业微信加密/解密 ============
class WXBizMsgCrypt {
  constructor(token, encodingAesKey, corpId) {
    this.token = token;
    this.corpId = corpId;
    this.aesKey = Buffer.from(encodingAesKey + '=', 'base64');
  }

  // 生成签名
  getSignature(timestamp, nonce, msgEncrypt) {
    const arr = [this.token, timestamp, nonce, msgEncrypt].sort();
    const str = arr.join('');
    return crypto.createHash('sha1').update(str).digest('hex');
  }

  // 解密
  decrypt(encryptedBase64) {
    try {
      // Base64 解码
      const encrypted = Buffer.from(encryptedBase64, 'base64');

      // 创建 decipher
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        this.aesKey.slice(0, 32),  // Key
        this.aesKey.slice(0, 16)   // IV
      );

      // 禁用自动填充，手动处理 PKCS#7
      decipher.setAutoPadding(false);

      // 解密
      let decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
      ]);

      // 手动移除 PKCS#7 填充
      const padLen = decrypted[decrypted.length - 1];
      if (padLen > 0 && padLen <= 32) {
        decrypted = decrypted.slice(0, decrypted.length - padLen);
      }

      // 企业微信格式：random(16) + msg_len(4) + msg + appid
      if (decrypted.length < 20) {
        throw new Error('Decrypted data too short');
      }

      // 读取消息长度（4字节，大端序）
      const msgLen = decrypted.readUInt32BE(16);

      // 验证长度合理性
      if (msgLen < 0 || msgLen > decrypted.length - 20) {
        throw new Error(`Invalid message length: ${msgLen}`);
      }

      // 提取消息内容（转换为 UTF-8 字符串）
      const msg = decrypted.slice(20, 20 + msgLen).toString('utf8');

      // 可选：验证 CorpID
      const appId = decrypted.slice(20 + msgLen).toString('utf8');
      if (appId !== this.corpId) {
        console.warn(`CorpID mismatch: received ${appId}, expected ${this.corpId}`);
      }

      return msg;
    } catch (err) {
      console.error('Decrypt failed:', err.message);
      throw err;
    }
  }

  // 加密
  encrypt(plainText) {
    // 1. 生成 16 字节随机字符串
    const randomBytes = crypto.randomBytes(16);

    // 2. 获取消息长度（4字节，大端序/network byte order）
    const msgLenBuffer = Buffer.alloc(4);
    msgLenBuffer.writeUInt32BE(Buffer.byteLength(plainText, 'utf8'), 0);

    // 3. 拼接：随机字符串 + 消息长度 + 消息内容 + CorpID
    const contentBuffer = Buffer.concat([
      randomBytes,
      msgLenBuffer,
      Buffer.from(plainText, 'utf8'),
      Buffer.from(this.corpId, 'utf8')
    ]);

    // 4. PKCS7 填充（AES-256 块大小是 32 字节）
    const blockSize = 32;
    const padLen = blockSize - (contentBuffer.length % blockSize);
    const padBuffer = Buffer.alloc(padLen, padLen);
    const finalBuffer = Buffer.concat([contentBuffer, padBuffer]);

    // 5. AES-256-CBC 加密
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      this.aesKey.slice(0, 32),  // Key: 前32字节
      this.aesKey.slice(0, 16)   // IV: 前16字节
    );

    // 关闭自动填充，因为我们手动填充了
    cipher.setAutoPadding(false);

    const encrypted = Buffer.concat([
      cipher.update(finalBuffer),
      cipher.final()
    ]);

    return encrypted.toString('base64');
  }
}

const crypt = new WXBizMsgCrypt(CONFIG.token, CONFIG.encodingAesKey, CONFIG.corpId);

// ============ 消息处理 ============
function parseXml(xml) {
  const result = {};
  const regex = /<(\w+)><!\[CDATA\[(.*?)\]\]><\/\w+>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    result[match[1]] = match[2];
  }
  // 也匹配没有 CDATA 的
  const regex2 = /<(\w+)>([^<]+)<\/\w+>/g;
  while ((match = regex2.exec(xml)) !== null) {
    if (!result[match[1]]) result[match[1]] = match[2];
  }
  return result;
}

// ============ OpenClaw 集成 ============
async function callOpenClaw(message, userId) {
  try {
    const url = `${CONFIG.openclaw.baseUrl}/v1/responses`;
    const headers = {
      'Content-Type': 'application/json',
      'x-openclaw-agent-id': CONFIG.openclaw.agentId,
    };

    // 如果有 token，添加认证
    if (CONFIG.openclaw.token) {
      headers['Authorization'] = `Bearer ${CONFIG.openclaw.token}`;
    }

    // 设置 4.5 秒超时（企业微信要求 5 秒内回复）
    const response = await axios.post(url, {
      model: `openclaw:${CONFIG.openclaw.agentId}`,
      input: message,
      user: userId,
    }, { headers, timeout: 4500 });

    // 提取回复文本
    if (response.data && response.data.output) {
      for (const item of response.data.output) {
        if (item.type === 'message' && item.content) {
          return item.content.map(c => c.text || '').join('');
        }
      }
    }

    return null;
  } catch (err) {
    console.error('OpenClaw 调用失败:', err.message);
    return null;
  }
}

function buildReply(toUser, fromUser, content) {
  const time = Math.floor(Date.now() / 1000);
  return `<xml>
<ToUserName><![CDATA[${toUser}]]></ToUserName>
<FromUserName><![CDATA[${fromUser}]]></FromUserName>
<CreateTime>${time}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${content}]]></Content>
</xml>`;
}

// ============ 路由 ============
app.get('/', (req, res) => {
  res.send('<h1>Bot is running!</h1><p>Webhook: /wecom</p>');
});

// 企业微信验证URL - GET请求
app.get('/wecom', (req, res) => {
  const { msg_signature, timestamp, nonce, echostr } = req.query;
  console.log('GET /wecom 验证请求:', { msg_signature, timestamp, nonce, echostr });

  if (!CONFIG.token || !echostr) {
    return res.type('text/plain').send(echostr || 'ok');
  }

  // 验证签名
  const calcSign = crypt.getSignature(timestamp, nonce, echostr);
  console.log('计算签名:', calcSign);
  console.log('收到签名:', msg_signature);

  if (calcSign !== msg_signature) {
    console.log('签名验证失败');
    return res.status(403).type('text/plain').send('Forbidden');
  }

  // 解密 echostr
  try {
    const decrypted = crypt.decrypt(echostr);
    console.log('解密成功:', decrypted);

    // 关键：设置 Content-Type 为 text/plain，防止 Express 添加 HTML 标签
    res.type('text/plain');
    res.send(decrypted);
  } catch (err) {
    console.error('解密失败:', err.message);
    res.status(500).type('text/plain').send('Error');
  }
});

// 接收消息 - POST请求
app.post('/wecom', express.text({ type: 'text/xml' }), async (req, res) => {
  console.log('POST /wecom 收到消息');

  let decryptedMsg;
  try {
    const msg = parseXml(req.body);

    if (!msg.Encrypt) {
      return res.status(200).send('success');
    }

    const decryptedXml = crypt.decrypt(msg.Encrypt);
    decryptedMsg = parseXml(decryptedXml);
    console.log('解密后:', decryptedMsg);
  } catch (err) {
    console.error('处理失败:', err.message);
    // 关键：即使解密失败也要返回 200，否则企业微信会一直重试
    return res.status(200).send('success');
  }

  // 获取消息内容
  const content = decryptedMsg.Content || '';
  const fromUser = decryptedMsg.FromUserName;
  const toUser = decryptedMsg.ToUserName;

  console.log(`用户 ${fromUser}: ${content}`);

  // 调用 OpenClaw 生成回复（带超时）
  let replyContent;
  const openclawReply = await callOpenClaw(content, fromUser);

  if (openclawReply) {
    replyContent = openclawReply;
  } else {
    // OpenClaw 调用失败或超时的降级回复
    if (content === 'ping') replyContent = 'pong';
    else if (content === 'hi' || content === '你好') replyContent = '你好！👋';
    else if (content === '你是谁') replyContent = '我是 OpenClaw 企业微信机器人!';
    else replyContent = '思考中...请稍后再试（OpenClaw响应较慢）';
  }

  // 加密回复
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2, 10);

  const plainXml = `<xml>
<ToUserName><![CDATA[${fromUser}]]></ToUserName>
<FromUserName><![CDATA[${toUser}]]></FromUserName>
<CreateTime>${timestamp}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${replyContent}]]></Content>
</xml>`;

  try {
    const encrypted = crypt.encrypt(plainXml);
    const signature = crypt.getSignature(timestamp, nonce, encrypted);

    const finalXml = `<xml>
<Encrypt><![CDATA[${encrypted}]]></Encrypt>
<MsgSignature><![CDATA[${signature}]]></MsgSignature>
<TimeStamp>${timestamp}</TimeStamp>
<Nonce><![CDATA[${nonce}]]></Nonce>
</xml>`;

    res.type('application/xml');
    res.send(finalXml);
  } catch (err) {
    console.error('加密回复失败:', err);
    res.status(200).send('success');
  }
});

app.listen(PORT, () => {
  console.log(`Bot running on port ${PORT}`);
  console.log(`CorpID: ${CONFIG.corpId?.slice(0, 8)}...`);
  console.log(`Token: ${CONFIG.token ? '已配置' : '未配置'}`);
  console.log(`AESKey: ${CONFIG.encodingAesKey ? '已配置' : '未配置'}`);
  console.log(`OpenClaw: ${CONFIG.openclaw.baseUrl} (agent: ${CONFIG.openclaw.agentId})`);
  console.log(`OpenClaw Token: ${CONFIG.openclaw.token ? '已配置' : '未配置'}`);
});
