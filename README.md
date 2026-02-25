# WeCom Bot v2.0 - TypeScript 异步响应版

## 新特性

### 1. 异步响应模式
- 收到消息后**立即**返回 `success`，避免企业微信超时
- 后台异步处理消息，处理完成后**主动推送**回复
- 支持长时间运行的 AI 对话，不再受 5 秒超时限制

### 2. 多媒体消息支持
- **图片消息**：自动识别图片内容并回复分析结果
- **语音消息**：支持语音消息处理（可通过语音识别或提示）
- **文本消息**：完整的文字对话支持

### 3. TypeScript 重构
- 完整类型安全，严格模式
- 模块化架构，职责分离
- 更好的代码可维护性

## 项目结构

```
src/
├── config/
│   └── index.ts              # 配置管理
├── types/
│   └── index.ts              # TypeScript 类型定义
├── services/
│   ├── wecom-crypt.ts        # 企业微信消息加密/解密
│   ├── wecom-api.ts          # 企业微信 API 调用
│   ├── openclaw.ts           # OpenClaw AI 服务
│   └── message-handler.ts    # 消息处理器（异步）
├── utils/
│   └── xml-parser.ts         # XML 解析工具
└── server.ts                 # 主入口
```

## 安装与运行

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```

### 编译并运行
```bash
npm run build
npm start
```

### 监视模式
```bash
npm run watch
```

## 环境变量配置

```env
# 企业微信配置
WECOM_CORP_ID=wwxxxxxxxxxxxxxxxx
WECOM_AGENT_ID=1000002
WECOM_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WECOM_TOKEN=your_token
WECOM_ENCODING_AES_KEY=your_aes_key

# OpenClaw 配置
OPENCLAW_URL=http://127.0.0.1:18789
OPENCLAW_TOKEN=your_token
OPENCLAW_AGENT_ID=main

# 服务器端口
PORT=3456
```

## API 端点

### 健康检查
```
GET /
```

### 企业微信 Webhook
```
GET /wecom    # URL 验证
POST /wecom   # 接收消息
```

### 手动发送消息
```
POST /api/send
Body: { "userId": "user_id", "message": "消息内容" }
```

## 代码风格 Skill

项目包含 `.claude/skills/code-style.md`，定义了代码生成规范：
- 只实现基本功能，避免冗余
- TypeScript 严格模式
- 模块化、高可读性、可维护性

## 与原版的差异

| 特性 | v1.0 (JS) | v2.0 (TS) |
|------|-----------|-----------|
| 响应模式 | 同步（5秒超时） | 异步（无限制） |
| 消息类型 | 仅文本 | 文本/图片/语音 |
| 类型安全 | 无 | TypeScript |
| 代码组织 | 单一文件 | 模块化 |
| 主动回复 | 不支持 | 支持 |
