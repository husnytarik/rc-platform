import { Module } from '@nestjs/common';
import { MembershipService } from './membership.service';

/** PrismaModule global; başvuru inceleme (onay/red) servisi. */
@Module({
  providers: [MembershipService],
  exports: [MembershipService],
})
export class MembershipModule {}
