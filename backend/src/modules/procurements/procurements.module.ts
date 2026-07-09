import { Module } from '@nestjs/common';
import { ProcurementsController } from './procurements.controller';
import { ProcurementsService } from './procurements.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { ApprovalModule } from '../approval/approval.module';
import { EvaluationModule } from '../evaluation/evaluation.module';

@Module({
  imports: [NotificationsModule, ApprovalModule, EvaluationModule],
  controllers: [ProcurementsController],
  providers: [ProcurementsService],
  exports: [ProcurementsService],
})
export class ProcurementsModule {}
