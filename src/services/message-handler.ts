import { PendingTask, WeComMessage, WeComImageMessage, WeComVoiceMessage } from '../types';
import { WeComApiService } from './wecom-api';
import { OpenClawService } from './openclaw';

export class MessageHandler {
  private pendingTasks = new Map<string, PendingTask>();

  constructor(
    private readonly wecomApi: WeComApiService,
    private readonly openclaw: OpenClawService
  ) {}

  async handleMessage(message: WeComMessage): Promise<void> {
    const { FromUserName, MsgType } = message;

    switch (MsgType) {
      case 'text':
        await this.handleTextMessage(message);
        break;
      case 'image':
        await this.handleImageMessage(message as WeComImageMessage);
        break;
      case 'voice':
        await this.handleVoiceMessage(message as WeComVoiceMessage);
        break;
      default:
        await this.wecomApi.sendTextMessage(FromUserName, `暂不支持 ${MsgType} 类型消息`);
    }
  }

  private async handleTextMessage(message: WeComMessage): Promise<void> {
    const { FromUserName, Content } = message;

    if (!Content) {
      console.log('No Content field in message from', FromUserName);
      return;
    }

    // 创建异步任务
    const taskId = `${FromUserName}_${Date.now()}`;
    this.pendingTasks.set(taskId, {
      userId: FromUserName,
      message: Content,
      messageType: 'text',
      timestamp: Date.now(),
    });

    // 异步处理
    this.processTask(taskId);
  }

  private async handleImageMessage(message: WeComImageMessage): Promise<void> {
    const { FromUserName, MediaId, PicUrl } = message;

    const taskId = `${FromUserName}_${Date.now()}`;
    this.pendingTasks.set(taskId, {
      userId: FromUserName,
      message: '[图片]',
      messageType: 'image',
      mediaUrl: PicUrl,
      timestamp: Date.now(),
    });

    // 异步处理
    this.processImageTask(taskId, MediaId);
  }

  private async handleVoiceMessage(message: WeComVoiceMessage): Promise<void> {
    const { FromUserName, MediaId, Recognition } = message;

    const taskId = `${FromUserName}_${Date.now()}`;
    this.pendingTasks.set(taskId, {
      userId: FromUserName,
      message: Recognition || '[语音]',
      messageType: 'voice',
      timestamp: Date.now(),
    });

    // 如果有语音识别结果，直接使用
    if (Recognition) {
      this.processTask(taskId);
    } else {
      // 否则下载语音文件处理
      this.processVoiceTask(taskId, MediaId);
    }
  }

  private async processTask(taskId: string): Promise<void> {
    const task = this.pendingTasks.get(taskId);
    if (!task) return;

    try {
      // 先发送"处理中"提示
      await this.wecomApi.sendTextMessage(task.userId, '🤔 正在思考，请稍候...');

      // 调用 OpenClaw
      const response = await this.openclaw.generateResponse(task.message, task.userId);

      // 发送回复
      const replyContent = response || '抱歉，处理超时，请稍后再试。';
      await this.wecomApi.sendTextMessage(task.userId, replyContent);
    } catch (error) {
      console.error(`Task ${taskId} failed:`, error);
      await this.wecomApi.sendTextMessage(
        task.userId,
        '处理消息时出错，请稍后再试。'
      );
    } finally {
      this.pendingTasks.delete(taskId);
    }
  }

  private async processImageTask(taskId: string, mediaId: string): Promise<void> {
    const task = this.pendingTasks.get(taskId);
    if (!task) return;

    try {
      await this.wecomApi.sendTextMessage(task.userId, '👁️ 正在识别图片内容，请稍候...');

      // 获取媒体文件URL
      const mediaUrl = await this.wecomApi.getMediaUrl(mediaId);
      const prompt = `请分析这张图片: ${mediaUrl}`;

      // 调用 OpenClaw
      const response = await this.openclaw.generateResponse(prompt, task.userId);

      const replyContent = response || '图片分析失败，请稍后再试。';
      await this.wecomApi.sendTextMessage(task.userId, replyContent);
    } catch (error) {
      console.error(`Image task ${taskId} failed:`, error);
      await this.wecomApi.sendTextMessage(task.userId, '图片处理失败，请稍后再试。');
    } finally {
      this.pendingTasks.delete(taskId);
    }
  }

  private async processVoiceTask(taskId: string, mediaId: string): Promise<void> {
    const task = this.pendingTasks.get(taskId);
    if (!task) return;

    try {
      await this.wecomApi.sendTextMessage(task.userId, '🎤 正在处理语音，请稍候...');

      // 下载语音文件
      const voiceData = await this.wecomApi.downloadMedia(mediaId);
      console.log(`Downloaded voice: ${voiceData.length} bytes`);

      // 由于语音转文字需要额外的 ASR 服务，这里提示用户
      // 实际项目中可以集成讯飞、百度等 ASR 服务
      const prompt = `[用户发送了一段语音，语音数据大小: ${voiceData.length} 字节]`;

      const response = await this.openclaw.generateResponse(prompt, task.userId);
      const replyContent = response || '语音处理失败，请尝试发送文字消息。';

      await this.wecomApi.sendTextMessage(task.userId, replyContent);
    } catch (error) {
      console.error(`Voice task ${taskId} failed:`, error);
      await this.wecomApi.sendTextMessage(task.userId, '语音处理失败，请稍后再试。');
    } finally {
      this.pendingTasks.delete(taskId);
    }
  }

  getPendingCount(): number {
    return this.pendingTasks.size;
  }

  cleanupOldTasks(maxAgeMs: number = 300000): void {
    const now = Date.now();
    for (const [taskId, task] of this.pendingTasks.entries()) {
      if (now - task.timestamp > maxAgeMs) {
        this.pendingTasks.delete(taskId);
      }
    }
  }
}
