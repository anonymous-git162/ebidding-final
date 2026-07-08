import { Module } from '@nestjs/common';
import { EbiddingController } from './ebidding.controller';
import { EbiddingService } from './ebidding.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [EbiddingController],
  providers: [EbiddingService],
  exports: [EbiddingService],
})
export class EbiddingModule {}
