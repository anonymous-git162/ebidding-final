import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RfqSubmissionService } from './rfq-submission.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('RFQ Submissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rfq-submissions')
export class RfqSubmissionController {
  constructor(
    private submissionService: RfqSubmissionService,
    private prisma: PrismaService,
  ) {}

  @Post()
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Create a new submission' })
  async create(
    @Body()
    body: {
      procurementId: string;
      price: number;
      proposalText?: string;
      fileIds?: string[];
    },
    @Request() req: any,
  ) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { userId: req.user.id },
    });
    if (!vendor) throw new BadRequestException('Vendor profile not found');
     return this.submissionService.create(
       body.procurementId,
       vendor.id,
       body.price,
       body.proposalText,
       body.fileIds,
     );
   }


  @Put(':id')
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Update a draft submission' })
  update(
    @Param('id') id: string,
    @Body() body: { price?: number; proposalText?: string; fileIds?: string[] },
    @Request() req: any,
  ) {
    return this.submissionService.update(
      id,
      req.user.id,
      body.price,
      body.proposalText,
      body.fileIds,
    );
  }

  @Put(':id/submit')
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Submit a proposal' })
  submit(@Param('id') id: string, @Request() req: any) {
    return this.submissionService.submit(id, req.user.id);
  }

  @Get('procurement/:procurementId')
  @Roles(UserRole.PROCUREMENT, UserRole.ADMIN, UserRole.EVALUATOR, UserRole.LEAD_EVALUATOR)
  @ApiOperation({
    summary: 'Get submissions for procurement',
  })
  findByProcurement(@Param('procurementId') procurementId: string) {
    return this.submissionService.findByProcurement(procurementId);
  }

  @Get('procurement/:procurementId/my')
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Get my submission for a procurement' })
  findMy(@Param('procurementId') procurementId: string, @Request() req: any) {
    return this.submissionService.findMySubmission(procurementId, req.user.id);
  }

  @Get('my')
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Get all my submissions' })
  findMyAll(@Request() req: any) {
    return this.submissionService.findAllMySubmissions(req.user.id);
  }
}
