import { Module } from '@nestjs/common';
import { EbiddingController } from './ebidding.controller';
import { EbiddingService } from './ebidding.service';

@Module({
  controllers: [EbiddingController],
  providers: [EbiddingService],
  exports: [EbiddingService],
})
export class EbiddingModule {}
