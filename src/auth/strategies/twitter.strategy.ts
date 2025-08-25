import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-twitter';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TwitterStrategy extends PassportStrategy(Strategy, 'twitter') {
  constructor(private configService: ConfigService) {
    const isTestEnv = configService.get<string>('NODE_ENV') === 'test' || configService.get<string>('IS_TEST') === 'true';

    const consumerKeyFromEnv = configService.get<string>('TWITTER_CONSUMER_KEY');
    if (!consumerKeyFromEnv && !isTestEnv) {
      throw new Error('TWITTER_CONSUMER_KEY is not set. Please configure it in environment variables.');
    }
    const consumerKey = consumerKeyFromEnv ?? 'mock_consumer_key';

    const consumerSecretFromEnv = configService.get<string>('TWITTER_CONSUMER_SECRET');
    if (!consumerSecretFromEnv && !isTestEnv) {
      throw new Error('TWITTER_CONSUMER_SECRET is not set. Please configure it in environment variables.');
    }
    const consumerSecret = consumerSecretFromEnv ?? 'mock_consumer_secret';

    const callbackURLFromEnv = configService.get<string>('TWITTER_CALLBACK_URL');
    if (!callbackURLFromEnv && !isTestEnv) {
      throw new Error('TWITTER_CALLBACK_URL is not set. Please configure it in environment variables.');
    }
    const callbackURL = callbackURLFromEnv ?? 'http://localhost:3000/auth/twitter/callback';
    
    super({
      consumerKey,
      consumerSecret,
      callbackURL,
      includeEmail: true,
      state: true,
    });
  }

  async validate(token: string, tokenSecret: string, profile: any) {
    return {
      provider: 'twitter',
      providerId: profile.id,
      email: profile.emails?.[0]?.value,
      username: profile.username || profile.emails?.[0]?.value?.split('@')[0],
      firstName: profile.displayName?.split(' ')[0],
      lastName: profile.displayName?.split(' ').slice(1).join(' '),
      avatar: profile.photos?.[0]?.value,
    };
  }
}

