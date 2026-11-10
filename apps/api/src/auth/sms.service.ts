import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

/**
 * SMS gönderimi (Netgsm HTTP API). Kimlik bilgileri ortam değişkenindedir:
 * NETGSM_USERCODE, NETGSM_PASSWORD, NETGSM_HEADER (onaylı mesaj başlığı).
 * Tanımlı değilse üretimde gönderim reddedilir; geliştirmede kod log'a yazılır.
 */
@Injectable()
export class SmsService {
  private readonly log = new Logger(SmsService.name);

  get configured(): boolean {
    return !!(process.env.NETGSM_USERCODE && process.env.NETGSM_PASSWORD && process.env.NETGSM_HEADER);
  }

  async send(e164: string, message: string): Promise<void> {
    if (!this.configured) {
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException('SMS servisi henüz yapılandırılmadı.');
      }
      this.log.warn(`[DEV SMS → ${e164}] ${message}`);
      return;
    }

    const params = new URLSearchParams({
      usercode: process.env.NETGSM_USERCODE!,
      password: process.env.NETGSM_PASSWORD!,
      gsmno: e164.replace(/^\+90/, ''),
      message,
      msgheader: process.env.NETGSM_HEADER!,
      dil: 'TR',
    });

    let body: string;
    try {
      const res = await fetch(`https://api.netgsm.com.tr/sms/send/get/?${params.toString()}`, {
        signal: AbortSignal.timeout(10_000),
      });
      body = (await res.text()).trim();
    } catch {
      throw new ServiceUnavailableException('SMS gönderilemedi. Biraz sonra tekrar deneyin.');
    }

    // Netgsm başarıda "00 <işNo>" (veya "01"/"02") döner; diğer kodlar hatadır.
    const code = body.split(/\s+/)[0] ?? '';
    if (!['00', '01', '02'].includes(code)) {
      this.log.error(`Netgsm hata kodu: ${code}`); // numara/mesaj log'lanmaz
      throw new ServiceUnavailableException('SMS gönderilemedi. Biraz sonra tekrar deneyin.');
    }
  }
}
