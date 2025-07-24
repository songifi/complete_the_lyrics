// src/chat/interceptors/message-encryption.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as crypto from 'crypto';
import { IChatMessage } from 'shared/interfaces';

@Injectable()
export class MessageEncryptionInterceptor implements NestInterceptor {
  private readonly algorithm = 'aes-256-cbc';
  private readonly encryptionKey: Buffer;

  constructor() {
    // In production, get this from config service
    this.encryptionKey = crypto.randomBytes(32);
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<IChatMessage> {
    return next.handle().pipe(
      map((data: IChatMessage) => {
        if (data.isPrivate && data.content) {
          return this.encryptMessage(data);
        }
        return data;
      }),
    );
  }

  private encryptMessage(message: IChatMessage): IChatMessage {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      this.encryptionKey,
      iv,
    );

    let encrypted = cipher.update(message.content, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      ...message,
      content: '', // Clear original content
      encryptedContent: encrypted,
      encryptionIv: iv.toString('hex'),
    };
  }
}
