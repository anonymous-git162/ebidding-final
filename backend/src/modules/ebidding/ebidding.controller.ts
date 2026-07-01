import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EbiddingService } from './ebidding.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('E-Bidding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ebidding')
export class EbiddingController {
  constructor(private ebiddingService: EbiddingService) {}

  @Post('rounds')
  @Roles(UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Create a new bidding round' })
  createRound(@Body() body: { procurementId: string }, @Request() req: any) {
    return this.ebiddingService.createRound(body.procurementId, req.user.id);
  }

  @Post('rounds/:id/open')
  @Roles(UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Open a bidding round' })
  openRound(@Param('id') id: string, @Request() req: any) {
    return this.ebiddingService.openRound(id, req.user.id);
  }

  @Post('rounds/:id/close')
  @Roles(UserRole.PROCUREMENT)
  @ApiOperation({ summary: 'Close a bidding round' })
  closeRound(@Param('id') id: string, @Request() req: any) {
    return this.ebiddingService.closeRound(id, req.user.id);
  }

  @Post('bid')
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Place or update a bid' })
  placeBid(@Body() body: { roundId: string; bidAmount: number; fileIds?: string[] }, @Request() req: any) {
    return this.ebiddingService.placeBid(body.roundId, req.user.id, body.bidAmount);
  }

  @Get('rounds/procurement/:procurementId')
  @ApiOperation({ summary: 'Get all rounds for a procurement' })
  getRounds(@Param('procurementId') procurementId: string, @Request() req: any) {
    return this.ebiddingService.getRounds(procurementId, req.user);
  }

  @Get('vendor-count/:procurementId')
  @ApiOperation({ summary: 'Get accepted vendor count for a procurement' })
  async getVendorCount(@Param('procurementId') procurementId: string) {
    return this.ebiddingService.getAcceptedVendorCount(procurementId);
  }

  @Get('my-bids')
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Get all my bids across all rounds' })
  getAllMyBids(@Request() req: any) {
    return this.ebiddingService.getAllMyBids(req.user.id);
  }

  @Get('rounds/:id/bids')
  @Roles(UserRole.PROCUREMENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all bids for a round (procurement view)' })
  getBids(@Param('id') id: string) {
    return this.ebiddingService.getRoundBids(id);
  }

  @Get('rounds/:id/my-bids')
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Get my bids for a round (vendor view)' })
  getMyBids(@Param('id') id: string, @Request() req: any) {
    return this.ebiddingService.getMyBids(id, req.user.id);
  }

  @Delete('bids/:id')
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Delete a bid (vendor only, round must be OPEN)' })
  deleteBid(@Param('id') id: string, @Request() req: any) {
    return this.ebiddingService.deleteBid(id, req.user.id);
  }
}
