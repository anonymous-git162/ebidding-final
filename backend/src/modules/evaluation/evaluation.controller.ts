import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EvaluationService } from './evaluation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Evaluation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('evaluation')
export class EvaluationController {
  constructor(private evaluationService: EvaluationService) {}

  @Get('assignments')
  @Roles(UserRole.EVALUATOR, UserRole.LEAD_EVALUATOR)
  @ApiOperation({ summary: 'Get my evaluation assignments' })
  getMyAssignments(@Request() req: any) {
    return this.evaluationService.getMyAssignments(req.user.id);
  }

  @Post('assignments')
  @Roles(UserRole.PROCUREMENT, UserRole.LEAD_EVALUATOR)
  @ApiOperation({ summary: 'Assign evaluators to a procurement' })
  assign(@Body() body: { procurementId: string; evaluatorIds: string[]; leadEvaluatorId: string }) {
    return this.evaluationService.assignEvaluators(body.procurementId, body.evaluatorIds, body.leadEvaluatorId);
  }

  @Post('reviews')
  @Roles(UserRole.EVALUATOR, UserRole.LEAD_EVALUATOR)
  @ApiOperation({ summary: 'Submit evaluator review' })
  submitReview(@Body() body: { procurementId: string; vendorId: string; score: number; comment?: string }, @Request() req: any) {
    return this.evaluationService.submitReview(req.user.id, body.procurementId, body.vendorId, body.score, body.comment);
  }

  @Get('reviews/:procurementId')
  @ApiOperation({ summary: 'Get all reviews for a procurement' })
  getReviews(@Param('procurementId') procurementId: string) {
    return this.evaluationService.getReviews(procurementId);
  }

  @Post('calculate/:procurementId')
  @Roles(UserRole.LEAD_EVALUATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Calculate aggregated scores' })
  calculate(@Param('procurementId') procurementId: string) {
    return this.evaluationService.calculateScores(procurementId);
  }

  @Post('consolidate/:procurementId')
  @Roles(UserRole.LEAD_EVALUATOR)
  @ApiOperation({ summary: 'Lead evaluator submits consolidation' })
  consolidate(
    @Param('procurementId') procurementId: string,
    @Body() body: { recommendation: string; leadCommentary: string },
    @Request() req: any,
  ) {
    return this.evaluationService.consolidate(procurementId, req.user.id, body.recommendation, body.leadCommentary);
  }

  @Get('consolidation/:procurementId')
  @ApiOperation({ summary: 'Get evaluation consolidation' })
  getConsolidation(@Param('procurementId') procurementId: string) {
    return this.evaluationService.getConsolidation(procurementId);
  }
}
