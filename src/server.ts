import express, { Request, Response } from 'express';
import { config, validateConfig } from './config';
import { WeComCryptService } from './services/wecom-crypt';
import { WeComApiService } from './services/wecom-api';
import { OpenClawService } from './services/openclaw';
import { MessageHandler } from './services/message-handler';
import { parseXml, buildEncryptedReplyXml } from './utils/xml-parser';
import { getBeijingISOString } from './utils/datetime';
import { WeComMessage } from './types';

// 初始化服务
function initializeServices() {
  const cryptService = new WeComCryptService(
    config.wecom.token,
    config.wecom.corpId,
    config.wecom.encodingAesKey
  );

  const wecomApi = new WeComApiService(config.wecom);
  const openclaw = new OpenClawService(config.openclaw);
  const messageHandler = new MessageHandler(wecomApi, openclaw);

  return { cryptService, wecomApi, openclaw, messageHandler };
}

// 创建 Express 应用
function createApp() {
  const app = express();
  const { cryptService, wecomApi, messageHandler } = initializeServices();

  // 中间件
  app.use(express.text({ type: 'text/xml' }));
  app.use(express.json());

  // 健康检查
  app.get('/', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'WeCom Bot',
      version: '2.0.0',
      pendingTasks: messageHandler.getPendingCount(),
    });
  });

  // 企业微信 URL 验证
  app.get('/wecom', (req: Request, res: Response) => {
    const { msg_signature, timestamp, nonce, echostr } = req.query as Record<string, string>;

    if (!echostr) {
      return res.status(400).send('Missing echostr');
    }

    try {
      const isValid = cryptService.verifySignature(
        msg_signature,
        timestamp,
        nonce,
        echostr
      );

      if (!isValid) {
        console.log('Signature verification failed');
        return res.status(403).send('Forbidden');
      }

      const decrypted = cryptService.decrypt(echostr);
      res.type('text/plain').send(decrypted);
    } catch (error) {
      console.error('URL verification failed:', error);
      res.status(500).send('Error');
    }
  });

  // 接收企业微信消息
  app.post('/wecom', async (req: Request, res: Response) => {
    console.log('Received message:', getBeijingISOString());

    try {
      const parsed = parseXml(req.body);

      if (!parsed.Encrypt) {
        return res.status(200).send('success');
      }

      const decryptedXml = cryptService.decrypt(parsed.Encrypt);
      const messageData = parseXml(decryptedXml);
      const message: WeComMessage = {
        FromUserName: messageData.FromUserName,
        ToUserName: messageData.ToUserName,
        MsgType: messageData.MsgType as WeComMessage['MsgType'],
        Content: messageData.Content,
        MsgId: messageData.MsgId,
        PicUrl: messageData.PicUrl,
        MediaId: messageData.MediaId,
        Format: messageData.Format,
        Recognition: messageData.Recognition,
        CreateTime: messageData.CreateTime,
      };

      console.log('Message from', message.FromUserName, 'type:', message.MsgType);

      // 立即返回 success（异步模式）
      res.status(200).send('success');

      // 异步处理消息
      messageHandler.handleMessage(message);
    } catch (error) {
      console.error('Message handling error:', error);
      // 即使出错也返回 success，避免企业微信重试
      res.status(200).send('success');
    }
  });

  // 手动发送消息 API
  app.post('/api/send', async (req: Request, res: Response) => {
    const { userId, message } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ error: 'Missing userId or message' });
    }

    try {
      await wecomApi.sendTextMessage(userId, message);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  return app;
}

// 启动服务器
function startServer() {
  try {
    validateConfig();
  } catch (error) {
    console.error('Configuration error:', error);
    process.exit(1);
  }

  const app = createApp();

  app.listen(config.port, () => {
    console.log(`\n🚀 WeCom Bot v2.0.0 started`);
    console.log(`📡 Listening on port ${config.port}`);
    console.log(`🔗 Webhook URL: http://your-domain/wecom`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ WeCom: ${config.wecom.corpId.slice(0, 8)}...`);
    console.log(`✅ OpenClaw: ${config.openclaw.baseUrl}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  });
}

startServer();
