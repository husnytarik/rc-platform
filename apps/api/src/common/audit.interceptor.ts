import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Observable, tap } from 'rxjs';

/**
 * Hafif erişim günlüğü: her HTTP isteği tek satır log. İş seviyesi denetim
 * (kim neyi değiştirdi) ayrıca servis katmanında activity_log'a yazılır.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('http');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const started = Date.now();
    const { method, url } = req;

    return next.handle().pipe(
      tap({
        next: () => this.logger.log(`${method} ${url} ${Date.now() - started}ms`),
        error: (err) =>
          this.logger.warn(`${method} ${url} ${Date.now() - started}ms -> ${err?.status ?? 500}`),
      }),
    );
  }
}
