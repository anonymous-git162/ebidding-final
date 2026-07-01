import { Controller, Get, Post, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ResultsService } from './results.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Results')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('results')
export class ResultsController {
  constructor(private resultsService: ResultsService) {}

  @Post('announce')
  @Roles(UserRole.PROCUREMENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Announce winner' })
  announce(@Body() body: { procurementId: string; winningVendorId: string; announcementText: string }, @Request() req: any) {
    return this.resultsService.announceWinner(body.procurementId, body.winningVendorId, body.announcementText, req.user.id);
  }

  @Get(':procurementId')
  @ApiOperation({ summary: 'Get procurement result' })
  getResult(@Param('procurementId') procurementId: string, @Request() req: any) {
    return this.resultsService.getResult(procurementId, req.user.id, req.user.role, req.user.id);
  }

  @Post(':procurementId/close')
  @Roles(UserRole.PROCUREMENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Close procurement case' })
  closeCase(@Param('procurementId') procurementId: string, @Request() req: any) {
    return this.resultsService.closeCase(procurementId, req.user.id);
  }
}
