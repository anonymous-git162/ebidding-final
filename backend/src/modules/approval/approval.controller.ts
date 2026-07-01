import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ApprovalService } from './approval.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Approval')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('approval')
export class ApprovalController {
  constructor(private approvalService: ApprovalService) {}

  @Post(':procurementId/submit')
  @Roles(UserRole.REQUESTER, UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Submit procurement for approval' })
  submit(@Param('procurementId') procurementId: string, @Request() req: any) {
    return this.approvalService.submitForApproval(procurementId, req.user.id);
  }

  @Get('inbox')
  @Roles(UserRole.APPROVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get approval inbox' })
  getInbox(@Request() req: any) {
    return this.approvalService.getInbox(req.user.id);
  }

  @Post(':procurementId/approve')
  @Roles(UserRole.APPROVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve procurement' })
  approve(@Param('procurementId') procurementId: string, @Body() body: { comment?: string }, @Request() req: any) {
    return this.approvalService.approve(procurementId, req.user.id, body.comment);
  }

  @Post(':procurementId/return')
  @Roles(UserRole.APPROVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Return procurement' })
  returnProc(@Param('procurementId') procurementId: string, @Body() body: { reason?: string }, @Request() req: any) {
    return this.approvalService.return(procurementId, req.user.id, body.reason);
  }

  @Post(':procurementId/reject')
  @Roles(UserRole.APPROVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Reject procurement' })
  reject(@Param('procurementId') procurementId: string, @Body() body: { reason?: string }, @Request() req: any) {
    return this.approvalService.reject(procurementId, req.user.id, body.reason);
  }

  @Get('overdue')
  @Roles(UserRole.APPROVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get overdue approvals' })
  getOverdue() {
    return this.approvalService.getOverdueApprovals();
  }

  @Post(':procurementId/escalate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Escalate overdue approval' })
  escalate(@Param('procurementId') procurementId: string) {
    return this.approvalService.escalateApproval(procurementId);
  }
}
