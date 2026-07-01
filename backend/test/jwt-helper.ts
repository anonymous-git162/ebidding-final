import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export function createJwtHelper() {
  const configService = new ConfigService({
    JWT_SECRET: 'test-jwt-secret-for-testing-only',
    JWT_EXPIRY: '15m',
    REFRESH_TOKEN_SECRET: 'test-refresh-secret-for-testing-only',
    REFRESH_TOKEN_EXPIRY: '7d',
  });

  const jwtService = new JwtService({
    secret: configService.get('jwt.secret'),
  });

  return {
    configService,
    jwtService,
    generateAccessToken(user: { id: string; email: string; role: string }) {
      return jwtService.sign(
        { sub: user.id, email: user.email, role: user.role, jti: 'test-jti' },
        { secret: configService.get('jwt.secret'), expiresIn: configService.get('jwt.expiresIn') },
      );
    },
    generateRefreshToken(user: { id: string; email: string; role: string }) {
      return jwtService.sign(
        { sub: user.id, email: user.email, role: user.role, jti: 'test-jti' },
        { secret: configService.get('refreshToken.secret'), expiresIn: configService.get('refreshToken.expiresIn') },
      );
    },
  };
}
