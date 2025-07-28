export const moderationConfig = {
  queues: {
    moderation: {
      concurrency: 10,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
    appeals: {
      concurrency: 5,
      attempts: 2,
      backoff: {
        type: 'fixed',
        delay: 5000,
      },
    },
  },
  analysis: {
    textAnalysis: {
      enabled: true,
      toxicityThreshold: 0.5,
      spamThreshold: 0.6,
    },
    imageAnalysis: {
      enabled: true,
      safeSearchThreshold: 0.7,
      adultContentThreshold: 0.8,
    },
  },
  escalation: {
    autoApproveThreshold: 0.3,
    autoRejectThreshold: 0.7,
    escalationThreshold: 0.8,
  },
  cache: {
    rulesCacheTTL: 300, // 5 minutes
    analysisCacheTTL: 3600, // 1 hour
  },
};
