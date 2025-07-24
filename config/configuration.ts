// src/config/configuration.ts
export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '60s',
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-system',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  elasticsearch: {
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
  },
  rateLimiting: {
    messageLimit: parseInt(process.env.MESSAGE_RATE_LIMIT, 10) || 30,
    windowSeconds: parseInt(process.env.MESSAGE_RATE_WINDOW, 10) || 60,
  },
});
