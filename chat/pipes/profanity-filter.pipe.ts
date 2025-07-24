// src/chat/pipes/profanity-filter.pipe.ts
import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { ModerationService } from '../services/moderation.service';

@Injectable()
export class ProfanityFilterPipe implements PipeTransform {
  constructor(private readonly moderationService: ModerationService) {}

  transform(value: any, metadata: ArgumentMetadata) {
    if (metadata.type === 'body' && value.content) {
      const { filtered, hasProfanity } = this.moderationService.filterProfanity(
        value.content,
      );
      value.content = filtered;
      value.filteredContent = filtered;
      value.hasProfanity = hasProfanity;
    }
    return value;
  }
}
