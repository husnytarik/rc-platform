import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

/**
 * SMS gönderimi. development'ta OTP_DEV_ECHO=true iken gerçek SMS atılmaz,
 * kod log'a yazılır. Prod'da Netgsm HTTP API.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  async sendOtp(phone: string, code: string): Promise<void> {
    const devEcho = this.config.get('OTP_DEV_ECHO', { infer: true });
    const userCode = this.config.get('NETGSM_USERCODE', { infer: true });

    if (devEcho || !userCode) {
      this.logger.warn(`[DEV] OTP ${phone} => ${code}`);
      return;
    }

    const password = this.config.get('NETGSM_PASSWORD', { infer: true });
    const sender = this.config.get('NETGSM_SENDER', { infer: true });
    const message = `RoasteryClub dogrulama kodunuz: ${code}. Kimseyle paylasmayin.`;

    const params = new URLSearchParams({
      usercode: userCode,
      password: password ?? '',
      gsmno: phone.replace('+', ''),
      message,
      msgheader: sender ?? '',
      dil: 'TR',
    });

    const res = await fetch('https://api.netgsm.com.tr/sms/send/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const text = await res.text();
    // Netgsm "00" veya "01" ile başlarsa başarılı
    if (!/^0[012]/.test(text.trim())) {
      this.logger.error(`Netgsm SMS hatası: ${text}`);
      throw new Error('SMS gönderilemedi');
    }
  }
}
