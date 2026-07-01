import { Module } from '@nestjs/common';
import { VendorInvitationController } from './vendor-invitation.controller';
import { VendorInvitationService } from './vendor-invitation.service';

@Module({
  controllers: [VendorInvitationController],
  providers: [VendorInvitationService],
  exports: [VendorInvitationService],
})
export class VendorInvitationModule {}
