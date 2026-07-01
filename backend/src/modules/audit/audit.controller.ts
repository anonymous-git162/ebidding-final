import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('audit')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get(':procurementId')
  @Roles(UserRole.ADMIN, UserRole.PROCUREMENT, UserRole.APPROVER)
  @ApiOperation({ summary: 'Get audit logs for procurement' })
  findByProcurement(@Param('procurementId') procurementId: string, @Query('page') page?: number) {
    return this.auditService.findByProcurement(procurementId, page || 1);
  }
}
