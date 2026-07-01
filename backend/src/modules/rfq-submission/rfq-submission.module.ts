import { Module } from '@nestjs/common';
import { RfqSubmissionController } from './rfq-submission.controller';
import { RfqSubmissionService } from './rfq-submission.service';

@Module({
  controllers: [RfqSubmissionController],
  providers: [RfqSubmissionService],
  exports: [RfqSubmissionService],
})
export class RfqSubmissionModule {}
