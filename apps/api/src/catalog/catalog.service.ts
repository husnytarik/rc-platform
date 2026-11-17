import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { isProducerRole, UOM_LABELS_TR, type Role, type Uom } from '@rc/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PriceService, type ResolvedPrice } from './price.service';
import { StockService, type VariantStock } from './stock.service';
import { VisibilityService } from './visibility.service';

export interface ViewContext {
  producerView: boolean;
  orgId: string | null;
  groupIds: string[];
}

interface CallerMembership {
  orgId: string;
  role: Role;
}

export interface CatalogActor {
  id: string;
  roles: Role[];
}

function slugify(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export interface CatalogListInput {
  categorySlug?: string;
  search?: string;
  limit?: number;
  cursor?: string;
}

const uomLabel = (u: Uom): string => UOM_LABELS_TR[u];

function shapeVariant(
  v: {
    id: string;
    code: string;
    name: string;
    orderUom: Uom;
    minOrderQty: Prisma.Decimal;
    qtyStep: Prisma.Decimal;
    contentAmount: Prisma.Decimal | null;
    contentUom: Uom | null;
  },
  price: ResolvedPrice | undefined,
  stock: VariantStock | undefined,
) {
  return {
    id: v.id,
    code: v.code,
    name: v.name,
    orderUom: v.orderUom,
    orderUomLabel: uomLabel(v.orderUom),
    minOrderQty: Number(v.minOrderQty),
    qtyStep: Number(v.qtyStep),
    content:
      v.contentAmount != null && v.contentUom
        ? {
            amount: Number(v.contentAmount),
            uom: v.contentUom,
            uomLabel: uomLabel(v.contentUom),
          }
        : null,
    price: price ?? null,
    stock: stock ?? { badge: 'in' as const, available: null },
  };
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prices: PriceService,
    private readonly stock: StockService,
    private readonly visibility: VisibilityService,
  ) {}

  /** ctx.user'dan görünüm bağlamı: üretici mi, hangi org, hangi gruplar. */
  async viewContext(memberships: CallerMembership[], roles: Role[]): Promise<ViewContext> {
    if (roles.some(isProducerRole)) {
      return { producerView: true, orgId: null, groupIds: [] };
    }
    const orgId = memberships.find((m) => !isProducerRole(m.role))?.orgId ?? null;
    if (!orgId) return { producerView: false, orgId: null, groupIds: [] };
    const groups = await this.prisma.customerGroupMember.findMany({
      where: { orgId },
      select: { groupId: true },
    });
    return { producerView: false, orgId, groupIds: groups.map((g) => g.groupId) };
  }

  async list(input: CatalogListInput, view: ViewContext) {
    const limit = Math.min(Math.max(input.limit ?? 30, 1), 100);
    const hidden = await this.visibility.hiddenProductIds(view.orgId, view.groupIds);

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      isService: false,
      ...(hidden.length ? { id: { notIn: hidden } } : {}),
      ...(input.categorySlug ? { category: { slug: input.categorySlug } } : {}),
      ...(input.search ? { name: { contains: input.search, mode: 'insensitive' } } : {}),
      variants: { some: { isActive: true } },
    };

    const rows = await this.prisma.product.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      include: {
        category: { select: { slug: true, name: true } },
        variants: { where: { isActive: true }, orderBy: { basePrice: 'asc' } },
      },
    });

    const hasMore = rows.length > limit;
    const products = hasMore ? rows.slice(0, limit) : rows;

    const variantIds = products.flatMap((p) => p.variants.map((v) => v.id));
    const qtyByVariant = new Map<string, number>();
    for (const p of products) {
      for (const v of p.variants) qtyByVariant.set(v.id, Number(v.minOrderQty));
    }

    const [priceMap, stockMap] = await Promise.all([
      this.prices.resolveForOrg(variantIds, view.orgId, view.groupIds, qtyByVariant),
      this.stock.badges(variantIds, view.producerView),
    ]);

    return {
      items: products.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        slug: p.slug,
        brand: p.brand,
        description: p.description,
        imageUrl: p.imageUrl,
        categorySlug: p.category?.slug ?? null,
        categoryName: p.category?.name ?? null,
        allowPreorder: p.allowPreorder,
        variants: p.variants.map((v) =>
          shapeVariant(v, priceMap.get(v.id), stockMap.get(v.id)),
        ),
      })),
      nextCursor: hasMore ? products[products.length - 1]?.id ?? null : null,
    };
  }

  async product(idOrSlug: { id?: string; slug?: string }, view: ViewContext) {
    const p = await this.prisma.product.findFirst({
      where: {
        isActive: true,
        ...(idOrSlug.id ? { id: idOrSlug.id } : {}),
        ...(idOrSlug.slug ? { slug: idOrSlug.slug } : {}),
      },
      include: {
        category: { select: { slug: true, name: true } },
        variants: { where: { isActive: true }, orderBy: { basePrice: 'asc' } },
      },
    });
    if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ürün bulunamadı.' });

    // Görünürlük: müşteri gizli bir ürünü doğrudan çekemesin.
    if (!view.producerView) {
      const hidden = await this.visibility.hiddenProductIds(view.orgId, view.groupIds);
      if (hidden.includes(p.id)) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ürün bulunamadı.' });
    }

    const variantIds = p.variants.map((v) => v.id);
    const qtyByVariant = new Map(p.variants.map((v) => [v.id, Number(v.minOrderQty)]));
    const [priceMap, stockMap] = await Promise.all([
      this.prices.resolveForOrg(variantIds, view.orgId, view.groupIds, qtyByVariant),
      this.stock.badges(variantIds, view.producerView),
    ]);

    return {
      id: p.id,
      code: p.code,
      name: p.name,
      slug: p.slug,
      brand: p.brand,
      description: p.description,
      imageUrl: p.imageUrl,
      categorySlug: p.category?.slug ?? null,
      categoryName: p.category?.name ?? null,
      allowPreorder: p.allowPreorder,
      variants: p.variants.map((v) => shapeVariant(v, priceMap.get(v.id), stockMap.get(v.id))),
    };
  }

  async categories() {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, slug: true, name: true, parentId: true, sortOrder: true },
    });
    return rows;
  }

  private async customerList(orgId: string, create: boolean) {
    const found = await this.prisma.priceList.findFirst({ where: { scope: 'customer', orgId } });
    if (found) {
      if (!found.isActive && create) await this.prisma.priceList.update({ where: { id: found.id }, data: { isActive: true } });
      return found;
    }
    if (!create) return null;
    const org = await this.prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } });
    if (!org) throw new TRPCError({ code: 'NOT_FOUND', message: 'Firma bulunamadı.' });
    return this.prisma.priceList.create({ data: { name: `${org.name} özel fiyat`, scope: 'customer', orgId } });
  }

  /** Yönetici: bir firmaya özel fiyatlar (varyant bazında liste fiyatı + firmaya özel fiyat). */
  async customerPrices(input: { orgId: string; search?: string; categoryId?: string }) {
    const list = await this.customerList(input.orgId, false);
    const overrides = list
      ? await this.prisma.priceListItem.findMany({ where: { priceListId: list.id, minQty: 1 }, select: { variantId: true, price: true } })
      : [];
    const ov = new Map(overrides.map((o) => [o.variantId, o.price.toFixed(2)]));
    const variants = await this.prisma.productVariant.findMany({
      where: {
        isActive: true,
        product: {
          isActive: true,
          ...(input.categoryId ? { categoryId: input.categoryId } : {}),
          ...(input.search ? { name: { contains: input.search, mode: 'insensitive' } } : {}),
        },
      },
      orderBy: [{ product: { name: 'asc' } }, { name: 'asc' }],
      take: 200,
      select: { id: true, name: true, basePrice: true, product: { select: { name: true } } },
    });
    return variants.map((v) => ({
      variantId: v.id,
      productName: v.product.name,
      variantName: v.name,
      basePrice: v.basePrice.toFixed(2),
      customPrice: ov.get(v.id) ?? null,
    }));
  }

  /** Tek varyant için firmaya özel fiyat; price=null özel fiyatı kaldırır. */
  async setCustomerPrice(input: { orgId: string; variantId: string; price: number | null }): Promise<{ ok: true }> {
    if (input.price === null) {
      const list = await this.customerList(input.orgId, false);
      if (list) await this.prisma.priceListItem.deleteMany({ where: { priceListId: list.id, variantId: input.variantId, minQty: 1 } });
      return { ok: true };
    }
    const list = await this.customerList(input.orgId, true);
    await this.prisma.priceListItem.upsert({
      where: { priceListId_variantId_minQty: { priceListId: list!.id, variantId: input.variantId, minQty: 1 } },
      create: { priceListId: list!.id, variantId: input.variantId, minQty: 1, price: input.price },
      update: { price: input.price },
    });
    return { ok: true };
  }

  /** Kategorideki tüm ürün varyantlarına liste fiyatından % indirim uygular (pct=0 → özel fiyatları kaldırır). */
  async setCustomerCategoryDiscount(input: { orgId: string; categoryId: string; pct: number }): Promise<{ count: number }> {
    const variants = await this.prisma.productVariant.findMany({
      where: { isActive: true, product: { categoryId: input.categoryId } },
      select: { id: true, basePrice: true },
    });
    if (input.pct === 0) {
      const list = await this.customerList(input.orgId, false);
      if (list) await this.prisma.priceListItem.deleteMany({ where: { priceListId: list.id, variantId: { in: variants.map((v) => v.id) }, minQty: 1 } });
      return { count: variants.length };
    }
    const list = await this.customerList(input.orgId, true);
    for (const v of variants) {
      const price = Math.round(Number(v.basePrice) * (100 - input.pct)) / 100;
      await this.prisma.priceListItem.upsert({
        where: { priceListId_variantId_minQty: { priceListId: list!.id, variantId: v.id, minQty: 1 } },
        create: { priceListId: list!.id, variantId: v.id, minQty: 1, price },
        update: { price },
      });
    }
    return { count: variants.length };
  }

  /** Yüklenen (istemcide küçültülmüş) görseli DB'ye yazar; herkese açık `/media/:id` yolunu döndürür. */
  async saveImage(base64: string): Promise<string> {
    const data = Buffer.from(base64, 'base64');
    if (data.length > 600_000) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Görsel çok büyük.' });
    const isJpeg = data[0] === 0xff && data[1] === 0xd8;
    const isPng = data[0] === 0x89 && data[1] === 0x50;
    if (!isJpeg && !isPng) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Yalnızca JPEG/PNG görsel yüklenebilir.' });
    }
    const a = await this.prisma.mediaAsset.create({ data: { mime: isJpeg ? 'image/jpeg' : 'image/png', data } });
    return `/media/${a.id}`;
  }

  /** Yönetim listesi: pasif ürünler ve servisler dahil, düzenleme ekranı için özet alanlar. */
  async adminList(input: { search?: string; categoryId?: string; limit?: number; cursor?: string }) {
    const limit = Math.min(Math.max(input.limit ?? 30, 1), 100);
    const rows = await this.prisma.product.findMany({
      where: {
        ...(input.search
          ? {
              OR: [
                { name: { contains: input.search, mode: 'insensitive' } },
                { code: { contains: input.search, mode: 'insensitive' } },
                { brand: { contains: input.search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      include: {
        category: { select: { name: true } },
        variants: { select: { isActive: true } },
      },
    });
    const hasMore = rows.length > limit;
    const products = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: products.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        categoryName: p.category?.name ?? null,
        imageUrl: p.imageUrl,
        isActive: p.isActive,
        isService: p.isService,
        variantCount: p.variants.length,
        activeVariantCount: p.variants.filter((v) => v.isActive).length,
      })),
      nextCursor: hasMore ? (products[products.length - 1]?.id ?? null) : null,
    };
  }

  /** Yönetim detayı: pasif varyantlar dahil, düzenleme formu için ham alanlar. */
  /** Ana sayfa vitrini: en son eklenen aktif ürünler (fiyatsız). */
  async newest(limit = 8) {
    const rows = await this.prisma.product.findMany({
      where: { isActive: true, isService: false },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, name: true, brand: true, imageUrl: true },
    });
    return rows;
  }

  async adminProduct(id: string) {
    const p = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: { orderBy: { createdAt: 'asc' } } },
    });
    if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ürün bulunamadı.' });
    const balances = await this.stock.balances(p.variants.map((v) => v.id));
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      slug: p.slug,
      description: p.description,
      categoryId: p.categoryId,
      brand: p.brand,
      imageUrl: p.imageUrl,
      isActive: p.isActive,
      isService: p.isService,
      allowPreorder: p.allowPreorder,
      variants: p.variants.map((v) => ({
        id: v.id,
        code: v.code,
        name: v.name,
        orderUom: v.orderUom,
        basePrice: Number(v.basePrice),
        minOrderQty: Number(v.minOrderQty),
        qtyStep: Number(v.qtyStep),
        contentAmount: v.contentAmount != null ? Number(v.contentAmount) : null,
        contentUom: v.contentUom,
        lowStockThreshold: v.lowStockThreshold != null ? Number(v.lowStockThreshold) : null,
        isActive: v.isActive,
        stockQty: balances.get(v.id) ?? 0,
      })),
    };
  }

  private async logCatalog(
    actor: CatalogActor,
    action: string,
    entityType: string,
    entityId: string,
    after: Prisma.InputJsonValue,
  ) {
    await this.prisma.activityLog.create({
      data: { actorId: actor.id, actorRole: actor.roles[0], action, entityType, entityId, after },
    });
  }

  async createProduct(
    input: {
      code: string;
      name: string;
      categoryId?: string;
      brand?: string;
      description?: string;
      imageUrl?: string;
      allowPreorder?: boolean;
      isService?: boolean;
    },
    actor: CatalogActor,
  ) {
    const existing = await this.prisma.product.findUnique({ where: { code: input.code } });
    if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Bu ürün kodu zaten kullanılıyor.' });

    const product = await this.prisma.product.create({
      data: {
        code: input.code,
        name: input.name,
        slug: slugify(input.name) || input.code.toLowerCase(),
        categoryId: input.categoryId ?? null,
        brand: input.brand ?? null,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        allowPreorder: input.allowPreorder ?? false,
        isService: input.isService ?? false,
      },
    });
    await this.logCatalog(actor, 'catalog.product_create', 'product', product.id, { code: product.code });
    return { id: product.id };
  }

  async updateProduct(
    input: {
      id: string;
      name?: string;
      categoryId?: string | null;
      brand?: string | null;
      description?: string | null;
      imageUrl?: string | null;
      allowPreorder?: boolean;
      isActive?: boolean;
      isService?: boolean;
    },
    actor: CatalogActor,
  ) {
    const before = await this.prisma.product.findUnique({ where: { id: input.id } });
    if (!before) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ürün bulunamadı.' });

    const { id, ...fields } = input;
    await this.prisma.product.update({
      where: { id },
      data: {
        ...fields,
        ...(fields.name ? { slug: slugify(fields.name) || before.code.toLowerCase() } : {}),
      },
    });
    await this.logCatalog(actor, 'catalog.product_update', 'product', id, fields);
    return { id };
  }

  async createVariant(
    input: {
      productId: string;
      code: string;
      name: string;
      orderUom: Uom;
      basePrice: number;
      minOrderQty?: number;
      qtyStep?: number;
      contentAmount?: number;
      contentUom?: Uom;
      lowStockThreshold?: number;
    },
    actor: CatalogActor,
  ) {
    const product = await this.prisma.product.findUnique({ where: { id: input.productId } });
    if (!product) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ürün bulunamadı.' });
    const existing = await this.prisma.productVariant.findUnique({ where: { code: input.code } });
    if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Bu varyant kodu zaten kullanılıyor.' });

    const variant = await this.prisma.productVariant.create({
      data: {
        productId: input.productId,
        code: input.code,
        name: input.name,
        orderUom: input.orderUom,
        basePrice: input.basePrice,
        minOrderQty: input.minOrderQty ?? 1,
        qtyStep: input.qtyStep ?? 1,
        contentAmount: input.contentAmount ?? null,
        contentUom: input.contentUom ?? null,
        lowStockThreshold: input.lowStockThreshold ?? null,
      },
    });
    await this.logCatalog(actor, 'catalog.variant_create', 'product_variant', variant.id, {
      productId: input.productId,
      code: variant.code,
    });
    return { id: variant.id };
  }

  async updateVariant(
    input: {
      id: string;
      name?: string;
      orderUom?: Uom;
      basePrice?: number;
      minOrderQty?: number;
      qtyStep?: number;
      contentAmount?: number | null;
      contentUom?: Uom | null;
      lowStockThreshold?: number | null;
      isActive?: boolean;
    },
    actor: CatalogActor,
  ) {
    const before = await this.prisma.productVariant.findUnique({ where: { id: input.id } });
    if (!before) throw new TRPCError({ code: 'NOT_FOUND', message: 'Varyant bulunamadı.' });

    const { id, ...fields } = input;
    await this.prisma.productVariant.update({ where: { id }, data: fields });
    await this.logCatalog(actor, 'catalog.variant_update', 'product_variant', id, fields);
    return { id };
  }
}
