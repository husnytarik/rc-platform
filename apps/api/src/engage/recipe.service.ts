import { Injectable } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 86_400_000;

@Injectable()
export class RecipeService {
  constructor(private readonly prisma: PrismaService) {}

  private shape(r: {
    id: string; slug: string; title: string; subtitle: string | null; description: string | null;
    imageUrl: string | null; category: string; prepMinutes: number; servings: number; difficulty: string;
    ingredients: unknown; steps: unknown; tip: string | null; productCode: string | null;
  }) {
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      subtitle: r.subtitle,
      description: r.description,
      imageUrl: r.imageUrl,
      category: r.category,
      prepMinutes: r.prepMinutes,
      servings: r.servings,
      difficulty: r.difficulty,
      ingredients: (r.ingredients as string[]) ?? [],
      steps: (r.steps as string[]) ?? [],
      tip: r.tip,
      productCode: r.productCode,
    };
  }

  async list() {
    const rows = await this.prisma.recipe.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
    return rows.map((r) => this.shape(r));
  }

  /** Günün reçetesi: aktif reçeteler arasında takvim gününe göre döner (Türkiye saati). */
  async today() {
    const rows = await this.prisma.recipe.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    if (rows.length === 0) return null;
    const day = Math.floor((Date.now() + 3 * 3_600_000) / DAY_MS);
    return this.shape(rows[day % rows.length]!);
  }

  async get(id: string) {
    const r = await this.prisma.recipe.findFirst({ where: { id, isActive: true } });
    if (!r) throw new TRPCError({ code: 'NOT_FOUND', message: 'Reçete bulunamadı.' });
    return this.shape(r);
  }
}
