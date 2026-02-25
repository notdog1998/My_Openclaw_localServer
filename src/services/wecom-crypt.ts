import crypto from 'crypto';

export class WeComCryptService {
  private readonly aesKey: Buffer;

  constructor(
    private readonly token: string,
    private readonly corpId: string,
    encodingAesKey: string
  ) {
    this.aesKey = Buffer.from(encodingAesKey + '=', 'base64');
  }

  generateSignature(timestamp: string, nonce: string, msgEncrypt: string): string {
    const arr = [this.token, timestamp, nonce, msgEncrypt].sort();
    const str = arr.join('');
    return crypto.createHash('sha1').update(str).digest('hex');
  }

  decrypt(encryptedBase64: string): string {
    const encrypted = Buffer.from(encryptedBase64, 'base64');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      this.aesKey.slice(0, 32),
      this.aesKey.slice(0, 16)
    );
    decipher.setAutoPadding(false);

    let decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    const padLen = decrypted[decrypted.length - 1];
    if (padLen > 0 && padLen <= 32) {
      decrypted = decrypted.slice(0, decrypted.length - padLen);
    }

    if (decrypted.length < 20) {
      throw new Error('Decrypted data too short');
    }

    const msgLen = decrypted.readUInt32BE(16);
    if (msgLen < 0 || msgLen > decrypted.length - 20) {
      throw new Error(`Invalid message length: ${msgLen}`);
    }

    const msg = decrypted.slice(20, 20 + msgLen).toString('utf8');
    const appId = decrypted.slice(20 + msgLen).toString('utf8');

    if (appId !== this.corpId) {
      console.warn(`CorpID mismatch: received ${appId}, expected ${this.corpId}`);
    }

    return msg;
  }

  encrypt(plainText: string): string {
    const randomBytes = crypto.randomBytes(16);
    const msgLenBuffer = Buffer.alloc(4);
    msgLenBuffer.writeUInt32BE(Buffer.byteLength(plainText, 'utf8'), 0);

    const contentBuffer = Buffer.concat([
      randomBytes,
      msgLenBuffer,
      Buffer.from(plainText, 'utf8'),
      Buffer.from(this.corpId, 'utf8'),
    ]);

    const blockSize = 32;
    const padLen = blockSize - (contentBuffer.length % blockSize);
    const padBuffer = Buffer.alloc(padLen, padLen);
    const finalBuffer = Buffer.concat([contentBuffer, padBuffer]);

    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      this.aesKey.slice(0, 32),
      this.aesKey.slice(0, 16)
    );
    cipher.setAutoPadding(false);

    const encrypted = Buffer.concat([cipher.update(finalBuffer), cipher.final()]);
    return encrypted.toString('base64');
  }

  verifySignature(signature: string, timestamp: string, nonce: string, echostr: string): boolean {
    const calcSign = this.generateSignature(timestamp, nonce, echostr);
    return calcSign === signature;
  }
}
