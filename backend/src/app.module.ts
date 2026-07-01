import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { configuration } from './config/app.config';
import { PrismaModule } from './database/prisma.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProcurementsModule } from './modules/procurements/procurements.module';
import { VendorModule } from './modules/vendor/vendor.module';
import { VendorInvitationModule } from './modules/vendor-invitation/vendor-invitation.module';
import { RfqSubmissionModule } from './modules/rfq-submission/rfq-submission.module';
import { EbiddingModule } from './modules/ebidding/ebidding.module';
import { EvaluationModule } from './modules/evaluation/evaluation.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { ResultsModule } from './modules/results/results.module';
import { AuditModule } from './modules/audit/audit.module';
import { TimelineModule } from './modules/timeline/timeline.module';
import { FilesModule } from './modules/files/files.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { NotificationsGateway } from './common/gateway/notifications.gateway';
import { NotificationsService } from './modules/notifications/notifications.service';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 100 }]),
    JwtModule.registerAsync({
      useFactory: (config: ConfigService) => ({
        secret: config.get('jwt.secret'),
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProcurementsModule,
    VendorModule,
    VendorInvitationModule,
    RfqSubmissionModule,
    EbiddingModule,
    EvaluationModule,
    ApprovalModule,
    ResultsModule,
    AuditModule,
    TimelineModule,
    FilesModule,
    HealthModule,
    NotificationsModule,
    AnalyticsModule,
    AiModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    NotificationsGateway,
    {
      provide: 'APP_INITIALIZER',
      useFactory: (gateway: NotificationsGateway, notifService: NotificationsService) => {
        notifService.setGateway(gateway);
        return () => {};
      },
      inject: [NotificationsGateway, NotificationsService],
    },
  ],
})
export class AppModule {}
