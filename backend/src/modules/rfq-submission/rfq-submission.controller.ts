import { Controller, Get, Post, Put, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RfqSubmissionService } from './rfq-submission.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('RFQ Submissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rfq-submissions')
export class RfqSubmissionController {
  constructor(private submissionService: RfqSubmissionService) {}

  @Post()
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Create a new submission' })
  create(@Body() body: { procurementId: string; vendorId: string; price: number; proposalText?: string; fileIds?: string[] }) {
    return this.submissionService.create(body.procurementId, body.vendorId, body.price, body.proposalText);
  }

  @Put(':id')
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Update a draft submission' })
  update(@Param('id') id: string, @Body() body: { price?: number; proposalText?: string }, @Request() req: any) {
    return this.submissionService.update(id, req.user.id, body.price, body.proposalText);
  }

  @Put(':id/submit')
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Submit a proposal' })
  submit(@Param('id') id: string, @Request() req: any) {
    return this.submissionService.submit(id, req.user.id);
  }

  @Get('procurement/:procurementId')
  @Roles(UserRole.PROCUREMENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get submissions for procurement (procurement role)' })
  findByProcurement(@Param('procurementId') procurementId: string) {
    return this.submissionService.findByProcurement(procurementId);
  }

  @Get('procurement/:procurementId/my')
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Get my submission for a procurement' })
  findMy(@Param('procurementId') procurementId: string, @Request() req: any) {
    return this.submissionService.findMySubmission(procurementId, req.user.id);
  }
}
