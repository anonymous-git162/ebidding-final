import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { configuration } from '../../config/app.config';
import { PrismaService } from '../../database/prisma.service';
import { mockPrisma, MockPrisma } from '../../../test/prisma-mock';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: MockPrisma;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: '',
    fullName: 'Test User',
    role: 'REQUESTER',
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    createdAt: new Date(),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.JWT_EXPIRY = '15m';
    process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
    process.env.REFRESH_TOKEN_EXPIRY = '7d';
    mockUser.passwordHash = await bcrypt.hash('TestPass1', 10);
  });

  const mockConfigService = {
    get: (key: string) => {
      const config = configuration();
      const paths = key.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let value: any = config;
      for (const p of paths) {
        value = value?.[p];
      }
      return value;
    },
  };

  beforeEach(async () => {
    prisma = mockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfigService },
        JwtService,
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should return tokens and user on valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await service.login({ email: 'test@example.com', password: 'TestPass1' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.role).toBe('REQUESTER');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);

      await expect(
        service.login({ email: 'test@example.com', password: 'WrongPass1' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return generic error for non-existent email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nonexistent@example.com', password: 'TestPass1' }),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should return generic error for deactivated account', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(
        service.login({ email: 'test@example.com', password: 'TestPass1' }),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should return generic error for locked account', async () => {
      const futureLock = new Date(Date.now() + 60 * 60 * 1000);
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, lockedUntil: futureLock });

      await expect(
        service.login({ email: 'test@example.com', password: 'TestPass1' }),
      ).rejects.toThrow('Invalid email or password');
    });

    it('should increment failed login attempts', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);

      await expect(
        service.login({ email: 'test@example.com', password: 'WrongPass1' }),
      ).rejects.toThrow();

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ failedLoginAttempts: 1 }),
        }),
      );
    });

    it('should lock account after 5 failed attempts', async () => {
      const userWith4Attempts = { ...mockUser, failedLoginAttempts: 4 };
      prisma.user.findUnique.mockResolvedValue(userWith4Attempts);
      prisma.user.update.mockResolvedValue(userWith4Attempts);

      await expect(
        service.login({ email: 'test@example.com', password: 'WrongPass1' }),
      ).rejects.toThrow();

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            failedLoginAttempts: 5,
            lockedUntil: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('register', () => {
    it('should create user with REQUESTER role and return tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

      const result = await service.register({
        email: 'new@example.com',
        password: 'TestPass1',
        fullName: 'New User',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.role).toBe('REQUESTER');
    });

    it('should throw error if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'TestPass1',
          fullName: 'Test User',
        }),
      ).rejects.toThrow();
    });

    it('should always force REQUESTER role regardless of input', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      let capturedData: any;
      prisma.user.create.mockImplementation((args: any) => {
        capturedData = args.data;
        return Promise.resolve(mockUser);
      });
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });

      await service.register({
        email: 'new@example.com',
        password: 'TestPass1',
        fullName: 'New User',
        role: 'ADMIN' as any,
      });

      expect(capturedData.role).toBe('REQUESTER');
    });
  });

  describe('changePassword', () => {
    it('should reject passwords shorter than 8 characters', async () => {
      await expect(
        service.changePassword('user-1', 'OldPass1', 'Short1a'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject passwords without uppercase', async () => {
      await expect(
        service.changePassword('user-1', 'OldPass1', 'lowercase1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject passwords without lowercase', async () => {
      await expect(
        service.changePassword('user-1', 'OldPass1', 'UPPERCASE1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject passwords without a number', async () => {
      await expect(
        service.changePassword('user-1', 'OldPass1', 'NoNumbersA'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should change password and revoke refresh tokens on valid request', async () => {
      const passwordHash = await bcrypt.hash('OldPass1', 10);
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash });
      prisma.user.update.mockResolvedValue(mockUser);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.changePassword('user-1', 'OldPass1', 'NewPass123');

      expect(result).toEqual({ message: 'Password changed successfully' });
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'user-1' } }),
      );
    });
  });

  describe('refreshToken', () => {
    it('should rotate refresh token', async () => {
      const { JwtService } = require('@nestjs/jwt');
      const jwtService = new JwtService({ secret: process.env.REFRESH_TOKEN_SECRET });
      const refreshToken = jwtService.sign(
        { sub: 'user-1', email: 'test@example.com', role: 'REQUESTER' },
        { secret: process.env.REFRESH_TOKEN_SECRET, expiresIn: '7d' },
      );

      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: 'some-hash',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
      });
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt-2' });

      const result = await service.refreshToken(refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.accessToken).not.toBe(refreshToken);
    });
  });
});
