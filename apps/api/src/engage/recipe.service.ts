import { Injectable } from '@nestjs/common';
import { TRPCError } from '@trpc/server';
import { trSlug } from '@rc/shared';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 86_400_000;

export interface RecipeInput {
  title: string;
  subtitle?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  category: string;
  prepMinutes: number;
  servings: number;
  difficulty: 'kolay' | 'orta' | 'zor';
  ingredients: string[];
  steps: string[];
  tip?: string | null;
  isActive?: boolean;
}

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

  async adminList() {
    const rows = await this.prisma.recipe.findMany({ orderBy: [{ createdAt: 'desc' }] });
    return rows.map((r) => ({ ...this.shape(r), isActive: r.isActive }));
  }

  async adminGet(id: string) {
    const r = await this.prisma.recipe.findUnique({ where: { id } });
    if (!r) throw new TRPCError({ code: 'NOT_FOUND', message: 'Reçete bulunamadı.' });
    return { ...this.shape(r), isActive: r.isActive };
  }

  private clean(i: RecipeInput) {
    return {
      title: i.title.trim(),
      subtitle: i.subtitle?.trim() || null,
      description: i.description?.trim() || null,
      imageUrl: i.imageUrl?.trim() || null,
      category: i.category.trim(),
      prepMinutes: i.prepMinutes,
      servings: i.servings,
      difficulty: i.difficulty,
      ingredients: i.ingredients.map((x) => x.trim()).filter(Boolean),
      steps: i.steps.map((x) => x.trim()).filter(Boolean),
      tip: i.tip?.trim() || null,
      ...(i.isActive === undefined ? {} : { isActive: i.isActive }),
    };
  }

  async create(input: RecipeInput) {
    const data = this.clean(input);
    if (data.ingredients.length === 0 || data.steps.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'En az bir malzeme ve bir adım girin.' });
    }
    const base = trSlug(data.title) || 'recete';
    let slug = base;
    for (let n = 2; await this.prisma.recipe.findUnique({ where: { slug } }); n++) slug = `${base}-${n}`;
    const r = await this.prisma.recipe.create({ data: { ...data, slug } });
    return { id: r.id };
  }

  async update(id: string, input: RecipeInput) {
    const data = this.clean(input);
    if (data.ingredients.length === 0 || data.steps.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'En az bir malzeme ve bir adım girin.' });
    }
    await this.prisma.recipe.update({ where: { id }, data });
    return { id };
  }

  async remove(id: string) {
    await this.prisma.recipe.delete({ where: { id } });
    return { ok: true };
  }

  // ── İpuçları ──
  async tipToday() {
    const rows = await this.prisma.tip.findMany({ where: { isActive: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    if (rows.length === 0) return null;
    const day = Math.floor((Date.now() + 3 * 3_600_000) / DAY_MS);
    const t = rows[day % rows.length]!;
    return { id: t.id, title: t.title, body: t.body };
  }

  async tipList() {
    return this.prisma.tip.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, title: true, body: true, isActive: true } });
  }

  async tipCreate(input: { title?: string | null; body: string }) {
    const t = await this.prisma.tip.create({ data: { title: input.title?.trim() || null, body: input.body.trim() } });
    return { id: t.id };
  }

  async tipSetActive(id: string, isActive: boolean) {
    await this.prisma.tip.update({ where: { id }, data: { isActive } });
    return { ok: true };
  }

  async tipRemove(id: string) {
    await this.prisma.tip.delete({ where: { id } });
    return { ok: true };
  }
}
