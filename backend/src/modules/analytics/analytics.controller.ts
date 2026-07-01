import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Get('vendor')
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Get vendor analytics dashboard data' })
  getVendorAnalytics(@Request() req: any) {
    return this.analyticsService.getVendorAnalytics(req.user.id);
  }

  @Get('vendor/performance')
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Get vendor performance metrics' })
  getVendorPerformance(@Request() req: any) {
    return this.analyticsService.getVendorPerformance(req.user.id);
  }
}
