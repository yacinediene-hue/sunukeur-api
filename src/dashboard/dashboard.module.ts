import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { Project } from '../projects/entities/project.entity';
import { PaymentRequest } from '../payments/entities/payment-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Project, PaymentRequest])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
