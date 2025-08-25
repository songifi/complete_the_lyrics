import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { AUTH_ERRORS } from '../constants/auth.constants';
import { RegisterDto, LoginDto } from '../dto/auth.dto';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: Repository<User>;
  let refreshTokenRepository: Repository<RefreshToken>;
  let jwtService: JwtService;
  let emailService: EmailService;
  let configService: ConfigService;

  const mockUserRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockRefreshTokenRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockEmailService = {
    sendVerificationEmail: jest.fn(),
    sendPasswordResetEmail: jest.fn(),
    sendWelcomeEmail: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    refreshTokenRepository = module.get<Repository<RefreshToken>>(getRepositoryToken(RefreshToken));
    jwtService = module.get<JwtService>(JwtService);
    emailService = module.get<EmailService>(EmailService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'User',
    };

    it('should register a new user successfully', async () => {
      // Mock user not existing
      mockUserRepository.findOne.mockResolvedValue(null);
      
      // Mock user creation
      const mockUser = {
        id: 'user-id',
        ...registerDto,
        password: 'hashedPassword',
        isEmailVerified: false,
        emailVerificationToken: 'token',
        emailVerificationExpires: new Date(),
      };
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      // Mock JWT token generation
      mockJwtService.sign.mockReturnValue('mock-token');
      mockRefreshTokenRepository.create.mockReturnValue({});
      mockRefreshTokenRepository.save.mockResolvedValue({});

      // Mock email service
      mockEmailService.sendVerificationEmail.mockResolvedValue(undefined);

      const result = await service.register(registerDto);

      expect(result).toBeDefined();
      expect(result.user.email).toBe(registerDto.email);
      expect(result.user.username).toBe(registerDto.username);
      expect(mockUserRepository.findOne).toHaveBeenCalled();
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('should throw error if user already exists with same email', async () => {
      const existingUser = { email: registerDto.email, username: 'different' };
      mockUserRepository.findOne.mockResolvedValue(existingUser);

      await expect(service.register(registerDto)).rejects.toThrow(AUTH_ERRORS.EMAIL_TAKEN);
    });

    it('should throw error if user already exists with same username', async () => {
      const existingUser = { email: 'different@example.com', username: registerDto.username };
      mockUserRepository.findOne.mockResolvedValue(existingUser);

      await expect(service.register(registerDto)).rejects.toThrow(AUTH_ERRORS.USERNAME_TAKEN);
    });

    it('should throw error for weak password', async () => {
      const weakPasswordDto = { ...registerDto, password: 'weak', username: 'uniqueuser' };
      mockUserRepository.findOne.mockResolvedValue(null); // No existing user

      await expect(service.register(weakPasswordDto)).rejects.toThrow(AUTH_ERRORS.WEAK_PASSWORD);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      identifier: 'test@example.com',
      password: 'TestPass123!',
    };

    const mockUser = {
      id: 'user-id',
      email: 'test@example.com',
      username: 'testuser',
      password: 'hashedPassword',
      isLockedOut: jest.fn().mockReturnValue(false),
      incrementLoginAttempts: jest.fn(),
      resetLoginAttempts: jest.fn(),
      lastLoginAt: null,
      lastLoginIp: null,
    };

    it('should login user successfully with valid credentials', async () => {
      // Mock user found
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      
      // Mock password validation
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true);
      
      // Mock JWT token generation
      mockJwtService.sign.mockReturnValue('mock-token');
      mockRefreshTokenRepository.create.mockReturnValue({});
      mockRefreshTokenRepository.save.mockResolvedValue({});

      const result = await service.login(loginDto);

      expect(result).toBeDefined();
      expect(result.user.email).toBe(mockUser.email);
      expect(mockUser.resetLoginAttempts).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should throw error for invalid credentials', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(AUTH_ERRORS.INVALID_CREDENTIALS);
      expect(mockUser.incrementLoginAttempts).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(AUTH_ERRORS.INVALID_CREDENTIALS);
    });

    it('should throw error if account is locked', async () => {
      mockUser.isLockedOut.mockReturnValue(true);
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.login(loginDto)).rejects.toThrow(AUTH_ERRORS.ACCOUNT_LOCKED);
    });
  });

  describe('validatePasswordStrength', () => {
    it('should accept strong password', () => {
      const strongPassword = 'StrongPass123!';
      expect(() => service['validatePasswordStrength'](strongPassword)).not.toThrow();
    });

    it('should reject weak password', () => {
      const weakPassword = 'weak';
      expect(() => service['validatePasswordStrength'](weakPassword)).toThrow(AUTH_ERRORS.WEAK_PASSWORD);
    });

    it('should reject password without special character', () => {
      const passwordWithoutSpecial = 'StrongPass123';
      expect(() => service['validatePasswordStrength'](passwordWithoutSpecial)).toThrow();
    });
  });
});
