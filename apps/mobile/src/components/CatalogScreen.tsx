import type { AppRouter } from '@rc/api/app-router';
import { isCustomerRole } from '@rc/shared';
import type { inferRouterOutputs } from '@trpc/server';
import { useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/providers/auth-context';
import { useCart, type CartLine } from '@/providers/cart-context';
import { colors, radius, spacing } from '@/theme';

type Variant = inferRouterOutputs<AppRouter>['catalog']['list']['items'][number]['variants'][number];

const STOCK_LABEL_TR: Record<string, string> = {
  out: 'Stokta yok',
  low: 'Sınırlı stok',
  preorder: 'Ön sipariş',
};

function ProductCard({ productId, productName, categoryName, variants }: {
  productId: string;
  productName: string;
  categoryName: string | null;
  variants: Variant[];
}) {
  const cart = useCart();
  const [variantId, setVariantId] = useState(variants[0]?.id);
  const variant = variants.find((v) => v.id === variantId) ?? variants[0];
  const [qty, setQty] = useState<number>(variant?.minOrderQty ?? 1);

  const selectVariant = (v: Variant): void => {
    setVariantId(v.id);
    setQty(v.minOrderQty);
  };

  const step = variant?.qtyStep ?? 1;
  const min = variant?.minOrderQty ?? 1;
  const stockLabel = variant?.stock.badge && variant.stock.badge !== 'in' ? STOCK_LABEL_TR[variant.stock.badge] : null;
  const disabled = variant?.stock.badge === 'out';

  const onAdd = (): void => {
    if (!variant) return;
    const line: Omit<CartLine, 'qty'> = {
      variantId: variant.id,
      productName,
      variantName: variant.name,
      orderUomLabel: variant.orderUomLabel,
      minOrderQty: variant.minOrderQty,
      qtyStep: variant.qtyStep,
      unitPrice: variant.price?.unitPrice ?? null,
      currency: variant.price?.currency ?? null,
    };
    cart.addLine(line, qty);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{productName}</Text>
      <Text style={styles.cardMeta}>{categoryName ?? '—'}</Text>

      {variants.length > 1 && (
        <View style={styles.variantRow}>
          {variants.map((v) => (
            <TouchableOpacity
              key={v.id}
              style={[styles.variantChip, v.id === variant?.id && styles.variantChipActive]}
              onPress={() => selectVariant(v)}
            >
              <Text style={[styles.variantChipText, v.id === variant?.id && styles.variantChipTextActive]}>
                {v.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.cardBottom}>
        <Text style={styles.cardPrice}>
          {variant?.price ? `${variant.price.unitPrice} ${variant.price.currency}` : 'Fiyat yok'}
        </Text>
        {stockLabel && <Text style={styles.stockLabel}>{stockLabel}</Text>}
      </View>

      <View style={styles.addRow}>
        <View style={styles.stepper}>
          <TouchableOpacity
            style={styles.stepperButton}
            disabled={qty <= min}
            onPress={() => setQty((q) => Math.max(min, Number((q - step).toFixed(3))))}
          >
            <Text style={styles.stepperButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepperValue}>
            {qty} {variant?.orderUomLabel}
          </Text>
          <TouchableOpacity
            style={styles.stepperButton}
            onPress={() => setQty((q) => Number((q + step).toFixed(3)))}
          >
            <Text style={styles.stepperButtonText}>+</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.addButton, disabled && styles.addButtonDisabled]}
          disabled={disabled}
          onPress={onAdd}
        >
          <Text style={styles.addButtonText}>Sepete ekle</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Ürün listesi — üretici ve müşteri tarafında aynı görünüm; fiyat/stok sunucu tarafından belirlenir. Sepete ekleme yalnızca müşteri rollerinde gösterilir. */
export function CatalogScreen() {
  const { identity } = useAuth();
  const canOrder = identity?.roles.some(isCustomerRole) ?? false;
  const products = trpc.catalog.list.useQuery({ limit: 30 });

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.listContent}
      data={products.data?.items ?? []}
      keyExtractor={(p) => p.id}
      refreshing={products.isFetching}
      onRefresh={() => void products.refetch()}
      ListEmptyComponent={
        products.isLoading ? (
          <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
        ) : (
          <Text style={styles.empty}>Katalogda ürün yok.</Text>
        )
      }
      renderItem={({ item }) => {
        if (!canOrder || item.variants.length === 0) {
          const price = item.variants[0]?.price;
          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>{item.categoryName ?? '—'}</Text>
              <Text style={styles.cardPrice}>
                {price ? `${price.unitPrice} ${price.currency}` : 'Fiyat yok'}
              </Text>
            </View>
          );
        }
        return (
          <ProductCard
            productId={item.id}
            productName={item.name}
            categoryName={item.categoryName}
            variants={item.variants}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  listContent: { padding: spacing(5), gap: spacing(2.5) },
  empty: { textAlign: 'center', color: colors.inkMuted, marginTop: spacing(6) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(3.5),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(2),
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  cardMeta: { fontSize: 12, color: colors.inkMuted, marginTop: -spacing(1) },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPrice: { fontSize: 14, color: colors.accent, fontWeight: '700' },
  stockLabel: { fontSize: 12, color: colors.danger, fontWeight: '600' },
  variantRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1.5) },
  variantChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1),
  },
  variantChipActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  variantChipText: { fontSize: 12, color: colors.inkMuted, fontWeight: '600' },
  variantChipTextActive: { color: colors.accent },
  addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing(2) },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  stepperButton: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperButtonText: { fontSize: 16, color: colors.ink, fontWeight: '700' },
  stepperValue: { fontSize: 13, color: colors.ink, fontWeight: '600', minWidth: 64, textAlign: 'center' },
  addButton: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: spacing(4), paddingVertical: spacing(2.5) },
  addButtonDisabled: { backgroundColor: colors.border },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
