import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  UseGuards,
  Req,
  Res,
  Query,
  HttpCode,
  HttpStatus,
  Ip,
  ValidationPipe,
  Param,
  Delete,
  BadRequestException,
  DefaultValuePipe,
  ParseBoolPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
    email: string;
    username: string;
    roles?: string[];
    tokenId?: string;
  };
};
import { AuthService } from '../services/auth.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ResendVerificationDto,
  ChangePasswordDto,
  UpdateProfileDto,
  AuthResponseDto,
  NativeAuthResponseDto,
} from '../dto/auth.dto';
import { JwtAccessGuard } from '../guards/jwt-auth.guard';
import { FacebookAuthGuard } from '../guards/facebook-auth.guard';
import { AUTH_MESSAGES, AUTH_CONSTANTS } from '../constants/auth.constants';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'User registration' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(
    @Body(ValidationPipe) registerDto: RegisterDto,
    @Ip() ipAddress: string,
    @Res({ passthrough: true }) res: Response,
    @Query('native') native?: string,
  ): Promise<AuthResponseDto | NativeAuthResponseDto> {
    const result = await this.authService.register(registerDto, ipAddress);

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRES_IN * 1000,
    });

    const baseBody: AuthResponseDto = {
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      user: result.user,
    };

    if (native) {
      return { ...baseBody, refreshToken: result.refreshToken } as NativeAuthResponseDto;
    }

    return baseBody;
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 423, description: 'Account locked' })
  async login(
    @Body(ValidationPipe) loginDto: LoginDto,
    @Ip() ipAddress: string,
    @Res({ passthrough: true }) res: Response,
    @Query('native') native?: string,
  ): Promise<AuthResponseDto | NativeAuthResponseDto> {
    const result = await this.authService.login(loginDto, ipAddress);

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: (loginDto.rememberMe ? AUTH_CONSTANTS.REMEMBER_ME_EXPIRES_IN : AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRES_IN) * 1000,
    });

    const baseBody: AuthResponseDto = {
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      user: result.user,
    };

    if (native) {
      return { ...baseBody, refreshToken: result.refreshToken } as NativeAuthResponseDto;
    }

    return baseBody;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({ type: RefreshTokenDto, required: false })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(
    @Req() req: Request & { cookies?: Record<string, string | undefined> },
    @Res({ passthrough: true }) res: Response,
    @Query('native', new DefaultValuePipe(false), ParseBoolPipe) native: boolean,
    @Body(ValidationPipe) refreshTokenDto?: RefreshTokenDto,
  ): Promise<AuthResponseDto | NativeAuthResponseDto> {
    const cookieToken = req.cookies?.['refresh_token'];
    const token = native ? refreshTokenDto?.refreshToken : cookieToken || refreshTokenDto?.refreshToken;
    if (!token) {
      throw new BadRequestException('Refresh token is required');
    }
    const result = await this.authService.refreshToken({ refreshToken: token as string });

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRES_IN * 1000,
    });

    const baseBody: AuthResponseDto = {
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      user: result.user,
    };

    if (native) {
      return { ...baseBody, refreshToken: result.refreshToken } as NativeAuthResponseDto;
    }

    return baseBody;
  }

  @Post('logout')
  @UseGuards(JwtAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User logout' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.authService.logout(req.user.id);
    res.clearCookie('refresh_token', { path: '/auth/refresh' });
    return { message: AUTH_MESSAGES.LOGOUT_SUCCESS };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset email sent' })
  async forgotPassword(
    @Body(ValidationPipe) forgotPasswordDto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.forgotPassword(forgotPasswordDto);
    return { message: AUTH_MESSAGES.PASSWORD_RESET_SENT };
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password reset successful' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(
    @Body(ValidationPipe) resetPasswordDto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(resetPasswordDto);
    return { message: AUTH_MESSAGES.PASSWORD_RESET_SUCCESS };
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address' })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(
    @Body(ValidationPipe) verifyEmailDto: VerifyEmailDto,
  ): Promise<{ message: string }> {
    await this.authService.verifyEmail(verifyEmailDto);
    return { message: AUTH_MESSAGES.EMAIL_VERIFICATION_SUCCESS };
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend email verification' })
  @ApiBody({ type: ResendVerificationDto })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  @ApiResponse({ status: 400, description: 'Email already verified' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resendVerification(
    @Body(ValidationPipe) resendVerificationDto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    await this.authService.resendVerification(resendVerificationDto);
    return { message: AUTH_MESSAGES.EMAIL_VERIFICATION_SENT };
  }

  @Put('change-password')
  @UseGuards(JwtAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user password' })
  @ApiBearerAuth()
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid current password or weak new password' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body(ValidationPipe) changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(req.user.id, changePasswordDto);
    return { message: AUTH_MESSAGES.PASSWORD_CHANGED };
  }

  @Get('profile')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: 'Get user profile' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getProfile(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user.id);
  }

  @Put('profile')
  @UseGuards(JwtAccessGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update user profile' })
  @ApiBearerAuth()
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Username already taken' })
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body(ValidationPipe) updateProfileDto: UpdateProfileDto,
  ): Promise<{ message: string }> {
    await this.authService.updateProfile(req.user.id, updateProfileDto);
    return { message: AUTH_MESSAGES.PROFILE_UPDATED };
  }

  @Get('health')
  @ApiOperation({ summary: 'Authentication service health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async healthCheck(): Promise<{ 
    status: string; 
    timestamp: string;
    emailService: string;
    emailConfigured: boolean;
  }> {
    const emailService = this.authService.getEmailServiceStatus();
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      emailService: emailService,
      emailConfigured: this.authService.isEmailServiceConfigured(),
    };
  }

  // OAuth Routes
  @Get('google')
  @ApiOperation({ summary: 'Google OAuth authentication' })
  @ApiResponse({ status: 200, description: 'Redirects to Google OAuth' })
  @UseGuards(AuthGuard('google'))
  async googleAuth() {}

  @Get('google/callback')
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({ status: 200, description: 'Google OAuth successful' })
  @UseGuards(AuthGuard('google'))
  async googleAuthCallback(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
    @Query('native') native?: string,
  ) {
    const user = await this.authService.findOrCreateOAuthUser('google', req.user);
    const result = await this.authService.generateTokens(user);

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRES_IN * 1000,
    });

    const baseBody: AuthResponseDto = {
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
      },
    };

    if (native === 'true') {
      return { ...baseBody, refreshToken: result.refreshToken } as NativeAuthResponseDto;
    }

    return baseBody;
  }

  @Get('facebook')
  @ApiOperation({ summary: 'Facebook OAuth authentication' })
  @ApiResponse({ status: 200, description: 'Redirects to Facebook OAuth' })
  @UseGuards(FacebookAuthGuard)
  async facebookAuth() {}

  @Get('facebook/callback')
  @ApiOperation({ summary: 'Facebook OAuth callback' })
  @ApiResponse({ status: 200, description: 'Facebook OAuth successful' })
  @UseGuards(FacebookAuthGuard)
  async facebookAuthCallback(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
    @Query('native') native?: string,
  ) {
    const user = await this.authService.findOrCreateOAuthUser('facebook', req.user);
    const result = await this.authService.generateTokens(user);

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRES_IN * 1000,
    });

    const baseBody: AuthResponseDto = {
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
      },
    };

    if (native === 'true') {
      return { ...baseBody, refreshToken: result.refreshToken } as NativeAuthResponseDto;
    }

    return baseBody;
  }

  @Get('github')
  @ApiOperation({ summary: 'GitHub OAuth authentication' })
  @ApiResponse({ status: 200, description: 'Redirects to GitHub OAuth' })
  @UseGuards(AuthGuard('github'))
  async githubAuth() {}

  @Get('github/callback')
  @ApiOperation({ summary: 'GitHub OAuth callback' })
  @ApiResponse({ status: 200, description: 'GitHub OAuth successful' })
  @UseGuards(AuthGuard('github'))
  async githubAuthCallback(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
    @Query('native') native?: string,
  ) {
    const user = await this.authService.findOrCreateOAuthUser('github', req.user);
    const result = await this.authService.generateTokens(user);

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRES_IN * 1000,
    });

    const baseBody: AuthResponseDto = {
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
      },
    };

    if (native === 'true') {
      return { ...baseBody, refreshToken: result.refreshToken } as NativeAuthResponseDto;
    }

    return baseBody;
  }

  @Get('twitter')
  @ApiOperation({ summary: 'Twitter OAuth authentication' })
  @ApiResponse({ status: 200, description: 'Redirects to Twitter OAuth' })
  @UseGuards(AuthGuard('twitter'))
  async twitterAuth() {}

  @Get('twitter/callback')
  @ApiOperation({ summary: 'Twitter OAuth callback' })
  @ApiResponse({ status: 200, description: 'Twitter OAuth successful' })
  @UseGuards(AuthGuard('twitter'))
  async twitterAuthCallback(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
    @Query('native') native?: string,
  ) {
    const user = await this.authService.findOrCreateOAuthUser('twitter', req.user);
    const result = await this.authService.generateTokens(user);

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refresh_token', result.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRES_IN * 1000,
    });

    const baseBody: AuthResponseDto = {
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      expiresIn: result.expiresIn,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
      },
    };

    if (native === 'true') {
      return { ...baseBody, refreshToken: result.refreshToken } as NativeAuthResponseDto;
    }

    return baseBody;
  }

  // OAuth Account Management
  @Get('oauth/accounts')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: 'Get linked OAuth accounts' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'OAuth accounts retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getLinkedOAuthAccounts(@Req() req: AuthenticatedRequest) {
    return this.authService.getLinkedOAuthAccounts(req.user.id);
  }

  @Delete('oauth/accounts/:provider')
  @UseGuards(JwtAccessGuard)
  @ApiOperation({ summary: 'Unlink OAuth account' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'OAuth account unlinked' })
  @ApiResponse({ status: 400, description: 'Cannot unlink OAuth account' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async unlinkOAuthAccount(
    @Req() req: AuthenticatedRequest,
    @Param('provider') provider: string,
  ): Promise<{ message: string }> {
    await this.authService.unlinkOAuthAccount(req.user.id, provider);
    return { message: `${provider} OAuth account unlinked successfully` };
  }
}
