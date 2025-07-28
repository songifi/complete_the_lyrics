import * as Joi from 'joi';

export const createPlayerStatsSchema = Joi.object({
  playerId: Joi.string().uuid().required(),
  category: Joi.string().valid('combat', 'exploration', 'social', 'achievement').required(),
  metrics: Joi.object({
    kills: Joi.number().integer().min(0),
    deaths: Joi.number().integer().min(0),
    score: Joi.number().min(0),
    experience: Joi.number().min(0),
    level: Joi.number().integer().min(1),
    wins: Joi.number().integer().min(0),
    losses: Joi.number().integer().min(0),
    accuracy: Joi.number().min(0).max(100),
    damageDealt: Joi.number().min(0),
    damageReceived: Joi.number().min(0),
    itemsCollected: Joi.number().integer().min(0),
    questsCompleted: Joi.number().integer().min(0),
    socialInteractions: Joi.number().integer().min(0),
    timePlayedMinutes: Joi.number().min(0)
  }).required(),
  metadata: Joi.object({
    gameMode: Joi.string(),
    sessionId: Joi.string().uuid(),
    location: Joi.string(),
    difficulty: Joi.string().valid('easy', 'normal', 'hard', 'expert')
  }).optional()
});

export const leaderboardQuerySchema = Joi.object({
  category: Joi.string().valid('combat', 'exploration', 'social', 'achievement', 'overall').required(),
  timeframe: Joi.string().valid('daily', 'weekly', 'monthly', 'all-time').default('all-time'),
  limit: Joi.number().integer().min(1).max(100).default(50),
  offset: Joi.number().integer().min(0).default(0)
});
