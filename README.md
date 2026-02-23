# WeCom Bot - 企业微信自建应用机器人

基于企业微信官方 API 的 ChatBot，稳定可靠。

## 特性

- ✅ 企业微信官方 API，不封号
- ✅ 支持收发消息（私聊 + 群聊）
- ✅ 支持消息加解密（安全）
- ✅ 支持主动推送消息（HTTP API）
- ✅ 命令扩展简单

## 前置准备

### 1. 注册企业微信

访问 https://work.weixin.qq.com/ 注册企业（个人可注册，无需认证）

### 2. 创建自建应用

1. 登录企业微信管理后台
2. 进入「应用管理」→「自建」→「创建应用」
3. 填写应用名称、上传 Logo
4. 记住 **AgentId** 和 **Secret**
5. 设置可见成员（哪些人能使用这个应用）

### 3. 获取企业ID (CorpID)

在「我的企业」页面最下方，找到 **企业ID**

### 4. 配置接收消息（可选，如果需要被动回复）

在应用详情页「接收消息」→「设置API」：
1. **URL**: `http://你的服务器/wecom`
2. **Token**: 随机生成（记住它）
3. **EncodingAESKey**: 随机生成（记住它）

> ⚠️ URL 必须是企业微信能访问的公网地址。本地测试需要内网穿透（ngrok、cpolar 等）

### 5. 内网穿透（本地测试用）

使用 ngrok：
```bash
ngrok http 3000
```

得到 `https://xxxxx.ngrok.io`，这就是你的回调地址。

## 安装

```bash
cd wecom-bot
npm install
```

## 配置

### 方式1: 环境变量（推荐，生产环境）

```bash
# Windows PowerShell
$env:WECOM_CORP_ID="wwxxxxxxxxxxxxxxxx"
$env:WECOM_AGENT_ID="1000002"
$env:WECOM_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
$env:WECOM_TOKEN="your_token"
$env:WECOM_ENCODING_AES_KEY="your_aes_key"
$env:PORT="3000"

# Windows CMD
set WECOM_CORP_ID=wwxxxxxxxxxxxxxxxx
set WECOM_AGENT_ID=1000002
...
```

### 方式2: 修改代码（快速测试）

编辑 `bot.js`，修改 CONFIG 对象：
```javascript
const CONFIG = {
  corpId: 'wwxxxxxxxxxxxxxxxx',
  agentId: '1000002',
  secret: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  token: 'your_token',
  encodingAesKey: 'your_aes_key',
  port: 3000,
};
```

## 运行

```bash
node bot.js
```

启动后：
1. 企业微信管理后台设置 URL 验证
2. 在手机上打开企业微信，进入应用
3. 发送消息测试

## API 接口

### 主动发送消息

```bash
POST http://localhost:3000/api/send
Content-Type: application/json

{
  "userId": "ZhangSan",
  "message": "你好，这是一条主动推送的消息"
}
```

### 获取用户信息

在代码中：
```javascript
const userInfo = await bot.api.getUserInfo('ZhangSan');
console.log(userInfo);
```

## 自定义回复逻辑

编辑 `handleMessage` 方法：

```javascript
async handleMessage(msg) {
  const { FromUserName, Content } = msg;
  const text = Content.trim();
  
  if (text === '天气') {
    // 调用天气API
    return await getWeather();
  }
  
  if (text.startsWith('提醒 ')) {
    // 设置提醒
    return '已设置提醒';
  }
  
  return `收到: ${text}`;
}
```

## 部署到服务器

1. 代码上传到服务器
2. 安装依赖: `npm install --production`
3. 设置环境变量
4. 使用 PM2 启动:
   ```bash
   npm install -g pm2
   pm2 start bot.js --name wecom-bot
   pm2 save
   pm2 startup
   ```
5. 配置 Nginx 反向代理（可选）
6. 企业微信后台更新 URL 为服务器地址

## 目录结构

```
wecom-bot/
├── bot.js           # 主程序
├── package.json
├── .env.example     # 环境变量示例
└── README.md
```

## 常见问题

**Q: URL 验证失败？**
A: 
- 检查 Token 和 EncodingAESKey 是否正确
- 确认 URL 能被企业微信服务器访问（公网可访问）
- 查看控制台日志

**Q: 收不到消息？**
A:
- 确认应用可见范围包含你的账号
- 检查企业微信管理后台「接收消息」是否配置正确
- 查看服务器日志

**Q: 提示 "not allow to access from your ip"？**
A: 企业微信应用需要设置 IP 白名单，在「企业微信管理后台」→「我的企业」→「企业信息」→「IP白名单」添加服务器IP

## 相关文档

- [企业微信开发者文档](https://developer.work.weixin.qq.com/document/path/90487)
- [接收消息 API](https://developer.work.weixin.qq.com/document/path/90239)
- [发送消息 API](https://developer.work.weixin.qq.com/document/path/90236)

## License

MIT
