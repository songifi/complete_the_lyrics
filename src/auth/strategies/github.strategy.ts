import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private configService: ConfigService) {
    const isTestEnv = configService.get<string>('NODE_ENV') === 'test' || configService.get<string>('IS_TEST') === 'true';

    const clientIDFromEnv = configService.get<string>('GITHUB_CLIENT_ID');
    if (!clientIDFromEnv && !isTestEnv) {
      throw new Error('GITHUB_CLIENT_ID is not set. Please configure it in environment variables.');
    }
    const clientID = clientIDFromEnv ?? 'mock_client_id';

    const clientSecretFromEnv = configService.get<string>('GITHUB_CLIENT_SECRET');
    if (!clientSecretFromEnv && !isTestEnv) {
      throw new Error('GITHUB_CLIENT_SECRET is not set. Please configure it in environment variables.');
    }
    const clientSecret = clientSecretFromEnv ?? 'mock_client_secret';

    const callbackURLFromEnv = configService.get<string>('GITHUB_CALLBACK_URL');
    if (!callbackURLFromEnv && !isTestEnv) {
      throw new Error('GITHUB_CALLBACK_URL is not set. Please configure it in environment variables.');
    }
    const callbackURL = callbackURLFromEnv ?? 'http://localhost:3000/auth/github/callback';
    
    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['user:email'],
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: any) {
    return {
      provider: 'github',
      providerId: profile.id,
      email: profile.emails?.[0]?.value,
      username: profile.username || profile.emails?.[0]?.value?.split('@')[0],
      firstName: profile.displayName?.split(' ')[0],
      lastName: profile.displayName?.split(' ').slice(1).join(' '),
      avatar: profile.photos?.[0]?.value,
    };
  }
}

