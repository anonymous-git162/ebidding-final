import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class HealthService {
  constructor(private prisma: PrismaService) {}

  async check() {
    let dbStatus = 'healthy';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = 'unhealthy';
    }

    return {
      status: dbStatus === 'healthy' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
      },
    };
  }
}
