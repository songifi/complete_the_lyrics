import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly key = crypto.randomBytes(32);

  encrypt(text: string): { encrypted: string; iv: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      Buffer.from(this.key),
      iv,
    );
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return {
      iv: iv.toString('hex'),
      encrypted: encrypted.toString('hex'),
    };
  }

  decrypt(encrypted: { iv: string; encrypted: string }): string {
    const iv = Buffer.from(encrypted.iv, 'hex');
    const encryptedText = Buffer.from(encrypted.encrypted, 'hex');
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      Buffer.from(this.key),
      iv,
    );
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }
}
