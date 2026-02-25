import dotenv from 'dotenv';
import { AppConfig } from '../types';

dotenv.config();

function getEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

export const config: AppConfig = {
  port: parseInt(getEnv('PORT', '3456'), 10),
  wecom: {
    corpId: getEnv('WECOM_CORP_ID'),
    agentId: getEnv('WECOM_AGENT_ID'),
    secret: getEnv('WECOM_SECRET'),
    token: getEnv('WECOM_TOKEN'),
    encodingAesKey: getEnv('WECOM_ENCODING_AES_KEY'),
  },
  openclaw: {
    baseUrl: getEnv('OPENCLAW_URL', 'http://127.0.0.1:18789'),
    token: getEnv('OPENCLAW_TOKEN'),
    agentId: getEnv('OPENCLAW_AGENT_ID', 'main'),
  },
};

export function validateConfig(): void {
  const required = [
    'WECOM_CORP_ID',
    'WECOM_AGENT_ID',
    'WECOM_SECRET',
    'WECOM_TOKEN',
    'WECOM_ENCODING_AES_KEY',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
