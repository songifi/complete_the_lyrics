// src/chat/services/moderation.service.ts
import { Injectable } from '@nestjs/common';
import { Filter } from 'bad-words';
import * as badWords from 'bad-words/array';
import { ChatMessage } from '../entities/chat-message.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class ModerationService {
  private profanityFilter: Filter;

  constructor(
    @InjectModel(ChatMessage.name) private messageModel: Model<ChatMessage>,
  ) {
    this.profanityFilter = new Filter({ placeHolder: '█' });
    this.profanityFilter.addWords(...badWords);
  }

  filterProfanity(text: string): { filtered: string; hasProfanity: boolean } {
    const original = text;
    const filtered = this.profanityFilter.clean(original);
    return {
      filtered,
      hasProfanity: filtered !== original,
    };
  }

  async flagMessage(messageId: string, reason: string): Promise<ChatMessage> {
    return this.messageModel
      .findByIdAndUpdate(
        messageId,
        { isFlagged: true, flaggedReason: reason },
        { new: true },
      )
      .exec();
  }

  async unflagMessage(messageId: string): Promise<ChatMessage> {
    return this.messageModel
      .findByIdAndUpdate(
        messageId,
        { isFlagged: false, flaggedReason: null },
        { new: true },
      )
      .exec();
  }

  async getFlaggedMessages(): Promise<ChatMessage[]> {
    return this.messageModel
      .find({ isFlagged: true })
      .populate('sender', 'username email')
      .exec();
  }
}
