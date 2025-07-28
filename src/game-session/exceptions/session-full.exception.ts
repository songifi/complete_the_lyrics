import { BadRequestException } from '@nestjs/common';

export class SessionFullException extends BadRequestException {
  constructor(sessionId: string) {
    super(`Session with ID ${sessionId} is full.`);
  }
}
