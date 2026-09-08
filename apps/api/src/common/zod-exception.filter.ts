import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { ZodError } from 'zod';

/** Controller/procedure'da .parse() başarısızsa 400 + alan bazlı mesaj döndür. */
@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
  catch(exception: ZodError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<FastifyReply>();
    res.status(HttpStatus.BAD_REQUEST).send({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'ValidationError',
      message: 'Girdi geçersiz.',
      issues: exception.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
}
