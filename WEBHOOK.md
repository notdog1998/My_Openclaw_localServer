# 企业微信群机器人（Webhook）

最简单的方式，无需内网穿透，无需服务器。

## 创建机器人

1. 在企业微信群聊中，点击右上角「...」→「添加群机器人」
2. 选择「新创建一个机器人」
3. 填写机器人名称，点击「添加」
4. **复制 Webhook 地址**（形如：https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxx）

## 使用

### 直接发送消息

```bash
curl 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "msgtype": "text",
    "text": {
      "content": "Hello from NTJ"
    }
  }'
```

### Node.js 发送

```javascript
const axios = require('axios');

const WEBHOOK_URL = 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY';

async function sendMessage(content) {
  await axios.post(WEBHOOK_URL, {
    msgtype: 'text',
    text: { content }
  });
}

sendMessage('Hello from NTJ!');
```

## 特点

- ✅ 无需服务器
- ✅ 无需内网穿透
- ✅ 无需配置回调
- ❌ 只能**发送**消息到群，不能接收回复

## 消息类型

```javascript
// 文本
{ msgtype: 'text', text: { content: 'Hello' } }

// Markdown
{ msgtype: 'markdown', markdown: { content: '**Bold** text' } }

// 图片（base64）
{ msgtype: 'image', image: { base64: '...', md5: '...' } }

// 图文
{ msgtype: 'news', news: { articles: [{ title, description, url, picurl }] } }
```

## 完整 Bot 代码

```javascript
const axios = require('axios');

const WEBHOOK_URL = process.env.WECOM_WEBHOOK_URL;

class WeComWebhookBot {
  async sendText(content) {
    await axios.post(WEBHOOK_URL, {
      msgtype: 'text',
      text: { content }
    });
  }

  async sendMarkdown(content) {
    await axios.post(WEBHOOK_URL, {
      msgtype: 'markdown',
      markdown: { content }
    });
  }
}

module.exports = WeComWebhookBot;
```
