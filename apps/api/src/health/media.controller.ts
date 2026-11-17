import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { PrismaService } from '../prisma/prisma.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Yüklenen ürün görselleri — herkese açık, değişmez (id içerik başına benzersiz), uzun süre önbelleklenir. */
@Controller('media')
export class MediaController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id')
  async get(@Param('id') id: string, @Res() reply: FastifyReply): Promise<void> {
    if (!UUID_RE.test(id)) throw new NotFoundException();
    const a = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!a) throw new NotFoundException();
    void reply
      .header('Content-Type', a.mime)
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .header('Cross-Origin-Resource-Policy', 'cross-origin')
      .send(Buffer.from(a.data));
  }
}
