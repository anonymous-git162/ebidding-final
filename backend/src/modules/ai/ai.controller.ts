import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('write-tor')
  @ApiOperation({ summary: 'Generate Terms of Reference using AI' })
  writeTor(@Body() body: { requestType: string; category: string; title: string; description: string }) {
    return this.aiService.writeTor(body as any);
  }

  @Post('score-vendor')
  @ApiOperation({ summary: 'Score a vendor proposal using AI' })
  scoreVendor(@Body() body: {
    vendorName: string;
    price: number;
    proposalText: string;
    allVendorPrices: number[];
    procurementTitle: string;
  }) {
    return this.aiService.scoreVendor(body);
  }
}
