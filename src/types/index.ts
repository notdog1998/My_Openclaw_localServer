// 企业微信消息类型
export interface WeComMessage {
  FromUserName: string;
  ToUserName: string;
  MsgType: 'text' | 'image' | 'voice' | 'video' | 'location' | 'link';
  Content?: string;
  MsgId?: string;
  PicUrl?: string;
  MediaId?: string;
  Format?: string;
  Recognition?: string;
  CreateTime?: string;
}

// 企业微信图片消息扩展
export interface WeComImageMessage extends WeComMessage {
  MsgType: 'image';
  PicUrl: string;
  MediaId: string;
}

// 企业微信语音消息扩展
export interface WeComVoiceMessage extends WeComMessage {
  MsgType: 'voice';
  MediaId: string;
  Format: string;
  Recognition?: string;
}

// 企业微信配置
export interface WeComConfig {
  corpId: string;
  agentId: string;
  secret: string;
  token: string;
  encodingAesKey: string;
}

// OpenClaw 配置
export interface OpenClawConfig {
  baseUrl: string;
  token: string;
  agentId: string;
}

// 应用配置
export interface AppConfig {
  port: number;
  wecom: WeComConfig;
  openclaw: OpenClawConfig;
}

// OpenClaw 请求
export interface OpenClawRequest {
  model: string;
  input: string;
  user: string;
}

// OpenClaw 响应
export interface OpenClawResponse {
  output?: Array<{
    type: string;
    content?: Array<{ text?: string }>;
  }>;
}

// 异步任务
export interface PendingTask {
  userId: string;
  message: string;
  messageType: 'text' | 'image' | 'voice';
  mediaUrl?: string;
  timestamp: number;
}

// 企业微信 access_token 响应
export interface AccessTokenResponse {
  access_token: string;
  expires_in: number;
  errcode?: number;
  errmsg?: string;
}

// 企业微信媒体文件响应
export interface MediaResponse {
  errcode?: number;
  errmsg?: string;
  [key: string]: unknown;
}

// 企业微信消息发送响应
export interface MessageSendResponse {
  errcode: number;
  errmsg: string;
  invaliduser?: string;
}
