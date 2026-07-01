import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TimelineService } from './timeline.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Timeline')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('timeline')
export class TimelineController {
  constructor(private timelineService: TimelineService) {}

  @Get(':procurementId')
  @ApiOperation({ summary: 'Get procurement timeline' })
  findByProcurement(@Param('procurementId') procurementId: string) {
    return this.timelineService.findByProcurement(procurementId);
  }
}
