import axios, { AxiosInstance } from 'axios';
import { OpenClawConfig, OpenClawRequest, OpenClawResponse } from '../types';

export class OpenClawService {
  private readonly httpClient: AxiosInstance;

  constructor(private readonly config: OpenClawConfig) {
    this.httpClient = axios.create({
      baseURL: config.baseUrl,
      timeout: 600000,
      headers: {
        'Content-Type': 'application/json',
        'x-openclaw-agent-id': config.agentId,
      },
    });

    if (config.token) {
      this.httpClient.defaults.headers.common['Authorization'] = `Bearer ${config.token}`;
    }
  }

  async generateResponse(message: string, userId: string): Promise<string | null> {
    const request: OpenClawRequest = {
      model: `openclaw:${this.config.agentId}`,
      input: message,
      user: userId,
    };

    try {
      const response = await this.httpClient.post<OpenClawResponse>('/v1/responses', request);

      if (response.data.output) {
        for (const item of response.data.output) {
          if (item.type === 'message' && item.content) {
            return item.content.map((c) => c.text || '').join('');
          }
        }
      }

      return null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.error('OpenClaw call failed:', {
          status: error.response.status,
          data: error.response.data,
          request: request,
        });
      } else {
        console.error('OpenClaw call failed:', error instanceof Error ? error.message : String(error));
      }
      return null;
    }
  }
}
