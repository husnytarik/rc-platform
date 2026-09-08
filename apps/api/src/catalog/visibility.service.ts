import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Ürün görünürlüğü. Varsayılan: görünür. Bir `deny` kuralı gizler, daha özel bir
 * `allow` onu geri açar. Özgüllük: organization > customer_group > all.
 * Üretici tarafı kullanıcıları her şeyi görür (kural uygulanmaz).
 */
@Injectable()
export class VisibilityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Verilen org için gizlenmiş ürün id'leri. Üretici görünümünde boş küme. */
  async hiddenProductIds(orgId: string | null, groupIds: string[]): Promise<string[]> {
    if (!orgId) return [];

    const or: Prisma.VisibilityRuleWhereInput[] = [
      { subjectType: 'all' },
      { subjectType: 'organization', subjectId: orgId },
    ];
    if (groupIds.length) {
      or.push({ subjectType: 'customer_group', subjectId: { in: groupIds } });
    }

    const rules = await this.prisma.visibilityRule.findMany({
      where: { OR: or },
      select: { productId: true, subjectType: true, effect: true },
    });

    const rank: Record<string, number> = { organization: 3, customer_group: 2, all: 1 };
    const best = new Map<string, { rank: number; effect: string }>();

    for (const r of rules) {
      const cur = best.get(r.productId);
      const rr = rank[r.subjectType] ?? 0;
      if (!cur || rr > cur.rank) best.set(r.productId, { rank: rr, effect: r.effect });
    }

    return [...best.entries()].filter(([, v]) => v.effect === 'deny').map(([id]) => id);
  }
}
