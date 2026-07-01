import { Controller, Get, Post, Put, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VendorInvitationService } from './vendor-invitation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Vendor Invitations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('vendor-invitations')
export class VendorInvitationController {
  constructor(private invitationService: VendorInvitationService) {}

  @Post()
  @Roles(UserRole.PROCUREMENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Invite vendors to a procurement' })
  invite(@Body() body: { procurementId: string; vendorIds: string[]; deadline?: string }, @Request() req: any) {
    return this.invitationService.invite(body.procurementId, body.vendorIds, req.user.id, body.deadline);
  }

  @Get()
  @Roles(UserRole.PROCUREMENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all invitations (procurement/admin view)' })
  findAll() {
    return this.invitationService.findAll();
  }

  @Get('procurement/:procurementId')
  @Roles(UserRole.PROCUREMENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get invitations for a procurement' })
  findByProcurement(@Param('procurementId') procurementId: string) {
    return this.invitationService.findByProcurement(procurementId);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get current vendor invitations' })
  myInvitations(@Request() req: any) {
    return this.invitationService.findMyInvitations(req.user.id);
  }

  @Put(':id/accept')
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Accept invitation' })
  accept(@Param('id') id: string, @Request() req: any) {
    return this.invitationService.accept(id, req.user.id);
  }

  @Put(':id/decline')
  @Roles(UserRole.VENDOR)
  @ApiOperation({ summary: 'Decline invitation' })
  decline(@Param('id') id: string, @Request() req: any) {
    return this.invitationService.decline(id, req.user.id);
  }
}
