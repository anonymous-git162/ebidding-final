import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.lockedUntil && new Date() < user.lockedUntil) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      const attempts = user.failedLoginAttempts + 1;
      const updateData: any = { failedLoginAttempts: attempts };

      if (attempts >= 5) {
        updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }

      await this.prisma.user.update({ where: { id: user.id }, data: updateData });

      throw new UnauthorizedException('Invalid email or password');
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0) {
      await this.prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async register(dto: RegisterDto) {
    dto.role = 'REQUESTER';

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new UnauthorizedException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role || 'REQUESTER',
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('refreshToken.secret'),
      });

      const tokenHash = this.sha256(token);
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
      });

      if (!storedToken || storedToken.revokedAt !== null || storedToken.expiresAt <= new Date()) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, isActive: true },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      const tokens = await this.generateTokens(user.id, user.email, user.role);
      await this.storeRefreshToken(user.id, tokens.refreshToken);

      return tokens;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out successfully' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true },
    });
    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!newPassword || newPassword.length < 8 || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      throw new BadRequestException('Password must be at least 8 characters with uppercase, lowercase, and a number');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Revoke all refresh tokens on password change
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    });

    return { message: 'Password changed successfully' };
  }

  private sha256(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const jti = crypto.randomUUID();
    const payload = { sub: userId, email, role, jti };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.secret'),
      expiresIn: this.configService.get('jwt.expiresIn'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('refreshToken.secret'),
      expiresIn: this.configService.get('refreshToken.expiresIn'),
    });

    return { accessToken, refreshToken };
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)\s*(s|m|h|d)$/);
    if (!match) return 7;
    const value = parseInt(match[1]);
    const unit = match[2];
    switch (unit) {
      case 's': return value / 86400;
      case 'm': return value / 1440;
      case 'h': return value / 24;
      case 'd': return value;
      default: return 7;
    }
  }

  private async storeRefreshToken(userId: string, token: string) {
    const tokenHash = this.sha256(token);
    const expiresIn = this.configService.get('refreshToken.expiresIn') || '7d';
    const days = this.parseDuration(expiresIn);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });
  }
}
