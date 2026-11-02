import { Injectable } from '@nestjs/common';
import { UOMS, type Uom } from '@rc/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService, type CatalogActor } from './catalog.service';
import { StockService } from './stock.service';

/** Tablo satırı — bir varyant = bir satır. Telefon dosyayı ayrıştırıp bu biçimde gönderir. */
export interface SheetRow {
  productCode: string;
  productName: string;
  category?: string;
  brand?: string;
  description?: string;
  variantCode: string;
  variantName: string;
  uom: string;
  price: number;
  stock?: number;
  minQty?: number;
  qtyStep?: number;
  active?: boolean;
}

export interface RowResult {
  row: number;
  variantCode: string;
  action: 'create' | 'update' | 'error';
  message?: string;
}

function slug(s: string): string {
  return s
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

@Injectable()
export class CatalogSheetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly stock: StockService,
  ) {}

  async exportRows(): Promise<SheetRow[]> {
    const variants = await this.prisma.productVariant.findMany({
      orderBy: [{ product: { name: 'asc' } }, { code: 'asc' }],
      include: { product: { include: { category: { select: { name: true } } } } },
    });
    const balances = await this.stock.balances(variants.map((v) => v.id));
    return variants.map((v) => ({
      productCode: v.product.code,
      productName: v.product.name,
      category: v.product.category?.name,
      brand: v.product.brand ?? undefined,
      description: v.product.description ?? undefined,
      variantCode: v.code,
      variantName: v.name,
      uom: v.orderUom,
      price: Number(v.basePrice),
      stock: balances.get(v.id) ?? 0,
      minQty: Number(v.minOrderQty),
      qtyStep: Number(v.qtyStep),
      active: v.isActive && v.product.isActive,
    }));
  }

  private validate(r: SheetRow): string | null {
    if (!r.productCode?.trim()) return 'Ürün kodu boş.';
    if (!r.productName?.trim()) return 'Ürün adı boş.';
    if (!r.variantCode?.trim()) return 'Varyant kodu boş.';
    if (!r.variantName?.trim()) return 'Varyant adı boş.';
    if (!(UOMS as readonly string[]).includes(r.uom)) return `Birim geçersiz: ${r.uom}`;
    if (!Number.isFinite(r.price) || r.price < 0) return 'Fiyat geçersiz.';
    if (r.stock != null && !Number.isFinite(r.stock)) return 'Stok geçersiz.';
    if (r.minQty != null && !(r.minQty > 0)) return 'Asgari miktar geçersiz.';
    if (r.qtyStep != null && !(r.qtyStep > 0)) return 'Adım geçersiz.';
    return null;
  }

  private async categoryId(name: string | undefined, create: boolean): Promise<string | null> {
    const n = name?.trim();
    if (!n) return null;
    const s = slug(n);
    if (!s) return null;
    const found = await this.prisma.category.findUnique({ where: { slug: s } });
    if (found) return found.id;
    if (!create) return null;
    return (await this.prisma.category.create({ data: { name: n, slug: s } })).id;
  }

  /**
   * `apply=false` yalnız doğrular ve ne olacağını döner (önizleme). Satırlar bağımsız
   * işlenir: hatalı satır diğerlerini durdurmaz.
   */
  async importRows(rows: SheetRow[], apply: boolean, actor: CatalogActor): Promise<RowResult[]> {
    const results: RowResult[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      const rowNo = i + 2; // 1. satır başlık
      const code = r.variantCode?.trim() ?? '';
      const invalid = this.validate(r);
      if (invalid) {
        results.push({ row: rowNo, variantCode: code, action: 'error', message: invalid });
        continue;
      }
      try {
        const productCode = r.productCode.trim();
        const product = await this.prisma.product.findUnique({ where: { code: productCode } });
        const variant = await this.prisma.productVariant.findUnique({ where: { code } });
        if (variant && variant.productId !== product?.id) {
          results.push({
            row: rowNo,
            variantCode: code,
            action: 'error',
            message: 'Bu varyant kodu başka bir üründe kullanılıyor.',
          });
          continue;
        }
        if (apply) await this.applyRow(r, productCode, product?.id, variant?.id, actor);
        results.push({ row: rowNo, variantCode: code, action: variant ? 'update' : 'create' });
      } catch (e) {
        results.push({
          row: rowNo,
          variantCode: code,
          action: 'error',
          message: (e as { message?: string }).message?.slice(0, 160) ?? 'Beklenmeyen hata.',
        });
      }
    }
    return results;
  }

  private async applyRow(
    r: SheetRow,
    productCode: string,
    existingProductId: string | undefined,
    existingVariantId: string | undefined,
    actor: CatalogActor,
  ): Promise<void> {
    const categoryId = await this.categoryId(r.category, true);
    const brand = r.brand?.trim() || undefined;
    const description = r.description?.trim() || undefined;

    let productId = existingProductId;
    if (!productId) {
      productId = (
        await this.catalog.createProduct(
          {
            code: productCode,
            name: r.productName.trim(),
            categoryId: categoryId ?? undefined,
            brand,
            description,
          },
          actor,
        )
      ).id;
    } else {
      await this.catalog.updateProduct(
        {
          id: productId,
          name: r.productName.trim(),
          categoryId,
          brand: brand ?? null,
          description: description ?? null,
          ...(r.active != null ? { isActive: r.active } : {}),
        },
        actor,
      );
    }

    let variantId = existingVariantId;
    if (!variantId) {
      variantId = (
        await this.catalog.createVariant(
          {
            productId,
            code: r.variantCode.trim(),
            name: r.variantName.trim(),
            orderUom: r.uom as Uom,
            basePrice: r.price,
            minOrderQty: r.minQty,
            qtyStep: r.qtyStep,
          },
          actor,
        )
      ).id;
    } else {
      await this.catalog.updateVariant(
        {
          id: variantId,
          name: r.variantName.trim(),
          orderUom: r.uom as Uom,
          basePrice: r.price,
          ...(r.minQty ? { minOrderQty: r.minQty } : {}),
          ...(r.qtyStep ? { qtyStep: r.qtyStep } : {}),
          ...(r.active != null ? { isActive: r.active } : {}),
        },
        actor,
      );
    }

    // Tablodaki stok hedef bakiyedir; farkı düzeltme hareketi olarak yaz.
    if (r.stock != null) {
      const current = (await this.stock.balances([variantId])).get(variantId) ?? 0;
      const delta = Math.round((r.stock - current) * 1000) / 1000;
      if (delta !== 0) {
        await this.stock.adjust(
          { variantId, delta, reason: 'adjustment', note: 'Excel aktarımı' },
          actor,
        );
      }
    }
  }
}
