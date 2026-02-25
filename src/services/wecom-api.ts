import axios, { AxiosInstance } from 'axios';
import { AccessTokenResponse, MessageSendResponse, MediaResponse, WeComConfig } from '../types';

export class WeComApiService {
  private accessToken: string | null = null;
  private tokenExpireTime = 0;
  private readonly httpClient: AxiosInstance;

  constructor(private readonly config: WeComConfig) {
    this.httpClient = axios.create({
      timeout: 30000,
    });
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpireTime) {
      return this.accessToken;
    }

    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken`;
    const response = await this.httpClient.get<AccessTokenResponse>(url, {
      params: {
        corpid: this.config.corpId,
        corpsecret: this.config.secret,
      },
    });

    if (response.data.errcode && response.data.errcode !== 0) {
      throw new Error(`Failed to get access token: ${response.data.errmsg}`);
    }

    this.accessToken = response.data.access_token;
    this.tokenExpireTime = Date.now() + (response.data.expires_in - 300) * 1000;
    return this.accessToken;
  }

  async sendTextMessage(userId: string, content: string): Promise<void> {
    const token = await this.getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`;

    const response = await this.httpClient.post<MessageSendResponse>(url, {
      touser: userId,
      msgtype: 'text',
      agentid: parseInt(this.config.agentId, 10),
      text: { content },
    });

    if (response.data.errcode !== 0) {
      throw new Error(`Failed to send message: ${response.data.errmsg}`);
    }
  }

  async sendImageMessage(userId: string, mediaId: string): Promise<void> {
    const token = await this.getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`;

    const response = await this.httpClient.post<MessageSendResponse>(url, {
      touser: userId,
      msgtype: 'image',
      agentid: parseInt(this.config.agentId, 10),
      image: { media_id: mediaId },
    });

    if (response.data.errcode !== 0) {
      throw new Error(`Failed to send image: ${response.data.errmsg}`);
    }
  }

  async uploadMedia(type: 'image' | 'voice' | 'video' | 'file', mediaData: Buffer, filename: string): Promise<string> {
    const token = await this.getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/media/upload?access_token=${token}&type=${type}`;

    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('media', mediaData, filename);

    const response = await this.httpClient.post<MediaResponse>(url, form, {
      headers: form.getHeaders(),
    });

    if (response.data.errcode && response.data.errcode !== 0) {
      throw new Error(`Failed to upload media: ${response.data.errmsg}`);
    }

    return (response.data as { media_id: string }).media_id;
  }

  async downloadMedia(mediaId: string): Promise<Buffer> {
    const token = await this.getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/media/get`;

    const response = await this.httpClient.get(url, {
      params: {
        access_token: token,
        media_id: mediaId,
      },
      responseType: 'arraybuffer',
    });

    return Buffer.from(response.data as ArrayBuffer);
  }

  async getMediaUrl(mediaId: string): Promise<string> {
    const token = await this.getAccessToken();
    return `https://qyapi.weixin.qq.com/cgi-bin/media/get?access_token=${token}&media_id=${mediaId}`;
  }
}
