export interface RoomConfiguration {
  maxCapacity: number;
  isVoiceEnabled: boolean;
  isVideoEnabled: boolean;
  allowSpectators: boolean;
  allowGuestUsers: boolean;
  moderationSettings: {
    autoModeration: boolean;
    wordFilter: boolean;
    linkFilter: boolean;
    spamProtection: boolean;
    muteNewUsers: boolean;
  };
  gameSettings: {
    difficultyLevel: 'easy' | 'medium' | 'hard' | 'expert';
    timeLimit: number; // in seconds
    allowHints: boolean;
    scoreMultiplier: number;
    customRules: Record<string, any>;
  };
  customFields: Record<string, any>;
}
