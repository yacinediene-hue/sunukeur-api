import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentRequest } from './entities/payment-request.entity';
import { PaymentAttachment } from './entities/payment-attachment.entity';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { OtpService } from './otp.service';
import { PaydunyaService } from './paydunya.service';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentRequest, PaymentAttachment])],
  controllers: [PaymentsController],
  providers: [PaymentsService, OtpService, PaydunyaService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
