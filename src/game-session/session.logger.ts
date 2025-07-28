import { createLogger, format, transports } from 'winston';

export const sessionLogger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json(),
    format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level}] ${message} ${JSON.stringify(meta)}`;
    })
  ),
  defaultMeta: { service: 'game-session' },
  transports: [
    new transports.Console(),
  ],
});
