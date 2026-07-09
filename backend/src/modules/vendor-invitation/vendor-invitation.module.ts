import { Module } from '@nestjs/common';
import { VendorInvitationController } from './vendor-invitation.controller';
import { VendorInvitationService } from './vendor-invitation.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [VendorInvitationController],
  providers: [VendorInvitationService],
  exports: [VendorInvitationService],
})
export class VendorInvitationModule {}
