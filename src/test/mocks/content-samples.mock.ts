import { ContentType } from '../../common/enums/content-type.enum';

export const contentSamples = {
  cleanText: 'This is a perfectly normal and friendly message.',
  toxicText:
    'This is hate speech and very toxic content that should be blocked.',
  spamText: 'URGENT!!! CLICK HERE NOW!!! AMAZING OFFER!!!',
  borderlineText:
    'This content might be questionable but not clearly violating.',

  cleanImageUrl: 'https://example.com/clean-image.jpg',
  violatingImageUrl: 'https://example.com/adult-content.jpg',

  testCases: [
    {
      id: 'clean-text-1',
      contentType: ContentType.TEXT,
      content: 'This is a perfectly normal and friendly message.',
      expectedViolation: false,
      expectedEscalation: 'low',
    },
    {
      id: 'toxic-text-1',
      contentType: ContentType.TEXT,
      content: 'This is hate speech and very toxic content.',
      expectedViolation: true,
      expectedEscalation: 'high',
    },
    {
      id: 'spam-text-1',
      contentType: ContentType.TEXT,
      content: 'URGENT!!! CLICK HERE NOW!!! AMAZING OFFER!!!',
      expectedViolation: true,
      expectedEscalation: 'medium',
    },
  ],
};
