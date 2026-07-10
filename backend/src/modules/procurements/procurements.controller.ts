import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ProcurementsService } from './procurements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateProcurementDto,
  UpdateProcurementDto,
  QueryProcurementDto,
  ReviewDto,
  PublishDto,
} from './dto/procurement.dto';

@ApiTags('Procurements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('procurements')
export class ProcurementsController {
  constructor(private procurementsService: ProcurementsService) {}

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Get procurement statistics and analytics' })
  getStats() {
    return this.procurementsService.getStats();
  }

  @Get('currencies')
  @ApiOperation({ summary: 'Get distinct currencies used in procurements' })
  getCurrencies() {
    return this.procurementsService.getCurrencies();
  }

  @Post()
  @Roles(UserRole.REQUESTER, UserRole.PROCUREMENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new procurement request' })
  create(@Body() dto: CreateProcurementDto, @Request() req: any) {
    return this.procurementsService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List procurements with filters' })
  findAll(@Query() dto: QueryProcurementDto, @Request() req: any) {
    return this.procurementsService.findAll(dto, req.user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get procurement detail' })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.procurementsService.findById(id, req.user);
  }

  @Patch(':id')
  @Roles(UserRole.REQUESTER, UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Update procurement draft' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProcurementDto,
    @Request() req: any,
  ) {
    return this.procurementsService.update(id, dto, req.user.id);
  }

  @Patch(':id/approver')
  @Roles(UserRole.PROCUREMENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Reassign approver for procurement' })
  reassignApprover(
    @Param('id') id: string,
    @Body() body: { approverId: string },
  ) {
    return this.procurementsService.reassignApprover(id, body.approverId);
  }

  @Post(':id/submit')
  @Roles(UserRole.REQUESTER, UserRole.PROCUREMENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Submit procurement for review' })
  submit(@Param('id') id: string, @Request() req: any) {
    return this.procurementsService.submit(id, req.user.id);
  }

  @Post(':id/review/start')
  @Roles(UserRole.PROCUREMENT)
  @ApiOperation({
    summary: 'Start procurement review (SUBMITTED → UNDER_PROCUREMENT_REVIEW)',
  })
  startReview(@Param('id') id: string, @Request() req: any) {
    return this.procurementsService.startReview(id, req.user.id);
  }

  @Post(':id/review/approve')
  @Roles(UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Approve procurement review' })
  approveReview(
    @Param('id') id: string,
    @Body() dto: ReviewDto,
    @Request() req: any,
  ) {
    return this.procurementsService.approveReview(id, req.user.id, dto.comment);
  }

  @Post(':id/review/return')
  @Roles(UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Return procurement for revision' })
  returnReview(
    @Param('id') id: string,
    @Body() dto: ReviewDto,
    @Request() req: any,
  ) {
    return this.procurementsService.returnReview(id, req.user.id, dto.reason);
  }

  @Post(':id/review/reject')
  @Roles(UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Reject procurement' })
  rejectReview(
    @Param('id') id: string,
    @Body() dto: ReviewDto,
    @Request() req: any,
  ) {
    return this.procurementsService.rejectReview(id, req.user.id, dto.reason);
  }

  @Post(':id/publish')
  @Roles(UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Publish procurement for vendor participation' })
  publish(
    @Param('id') id: string,
    @Body() dto: PublishDto,
    @Request() req: any,
  ) {
    return this.procurementsService.publish(
      id,
      req.user.id,
      dto.submissionDeadline,
    );
  }

  @Post(':id/cancel')
  @Roles(UserRole.REQUESTER, UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Cancel procurement' })
  cancel(@Param('id') id: string, @Body() dto: ReviewDto, @Request() req: any) {
    return this.procurementsService.cancel(id, req.user.id, dto.reason);
  }

  @Post(':id/rfp/publish')
  @Roles(UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Publish RFP from RFP_DRAFTING' })
  publishRfp(
    @Param('id') id: string,
    @Body() dto: PublishDto,
    @Request() req: any,
  ) {
    return this.procurementsService.publishRfp(id, req.user.id, dto.submissionDeadline);
  }

  @Post(':id/rfi/start-collection')
  @Roles(UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Start RFI collection period' })
  startRfiCollection(@Param('id') id: string, @Request() req: any) {
    return this.procurementsService.startRfiCollection(id, req.user.id);
  }

  @Post(':id/rfi/close')
  @Roles(UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Close RFI collection period' })
  closeRfi(@Param('id') id: string, @Request() req: any) {
    return this.procurementsService.closeRfi(id, req.user.id);
  }

  @Post(':id/rfp/draft')
  @Roles(UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Start drafting RFP from RFI results' })
  draftRfp(@Param('id') id: string, @Request() req: any) {
    return this.procurementsService.draftRfp(id, req.user.id);
  }

  @Post(':id/vendor-response/complete')
  @Roles(UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Close vendor response period' })
  completeVendorResponse(@Param('id') id: string, @Request() req: any) {
    return this.procurementsService.completeVendorResponse(id, req.user.id);
  }

  @Post(':id/ebidding/start')
  @Roles(UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Start eBidding phase' })
  startEbidding(@Param('id') id: string, @Request() req: any) {
    return this.procurementsService.startEbidding(id, req.user.id);
  }

  @Post(':id/ebidding/complete')
  @Roles(UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Close eBidding and move to evaluation' })
  completeEbidding(@Param('id') id: string, @Request() req: any) {
    return this.procurementsService.completeEbidding(id, req.user.id);
  }

  @Post(':id/evaluation/complete')
  @Roles(UserRole.PROCUREMENT, UserRole.EVALUATOR, UserRole.LEAD_EVALUATOR)
  @ApiOperation({ summary: 'Complete evaluation and send for approval' })
  completeEvaluation(@Param('id') id: string, @Request() req: any) {
    return this.procurementsService.completeEvaluation(id, req.user.id);
  }

  @Post(':id/approval/approve')
  @Roles(UserRole.APPROVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve procurement (final approval)' })
  approveProcurement(
    @Param('id') id: string,
    @Body() dto: ReviewDto,
    @Request() req: any,
  ) {
    return this.procurementsService.approveProcurement(
      id,
      req.user.id,
      dto.comment,
    );
  }

  @Post(':id/award/announce')
  @Roles(UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Announce award winner' })
  announceAward(
    @Param('id') id: string,
    @Body() body: { winningVendorId: string; announcementText: string },
    @Request() req: any,
  ) {
    return this.procurementsService.announceAward(
      id,
      req.user.id,
      body.winningVendorId,
      body.announcementText,
    );
  }

  @Post(':id/approval/resubmit')
  @Roles(UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Resubmit for approval after revision' })
  resubmitForApproval(@Param('id') id: string, @Request() req: any) {
    return this.procurementsService.resubmitForApproval(id, req.user.id);
  }

  @Post(':id/contract/send')
  @Roles(UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Send contract to winning vendor' })
  sendContract(@Param('id') id: string, @Request() req: any) {
    return this.procurementsService.sendContract(id, req.user.id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a procurement (admin only)' })
  remove(@Param('id') id: string) {
    return this.procurementsService.remove(id);
  }

  @Post(':id/award/complete')
  @Roles(UserRole.PROCUREMENT, UserRole.APPROVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Mark procurement as completed' })
  completeProcurement(@Param('id') id: string, @Request() req: any) {
    return this.procurementsService.completeProcurement(id, req.user.id);
  }
}
