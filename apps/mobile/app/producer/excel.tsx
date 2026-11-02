import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as XLSX from 'xlsx';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

type Row = {
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
};

/** Sütun başlığı ↔ alan. İçe aktarımda başlık büyük/küçük harf ve boşluktan bağımsız eşleşir. */
const COLUMNS: { key: keyof Row; header: string }[] = [
  { key: 'productCode', header: 'Ürün Kodu' },
  { key: 'productName', header: 'Ürün Adı' },
  { key: 'category', header: 'Kategori' },
  { key: 'brand', header: 'Marka' },
  { key: 'description', header: 'Açıklama' },
  { key: 'variantCode', header: 'Varyant Kodu' },
  { key: 'variantName', header: 'Varyant Adı' },
  { key: 'uom', header: 'Birim' },
  { key: 'price', header: 'Fiyat' },
  { key: 'stock', header: 'Stok' },
  { key: 'minQty', header: 'Asgari Miktar' },
  { key: 'qtyStep', header: 'Adım' },
  { key: 'active', header: 'Aktif' },
];

const norm = (s: string): string => s.toLocaleLowerCase('tr').replace(/\s+/g, '');
const HEADER_TO_KEY = new Map(COLUMNS.map((c) => [norm(c.header), c.key]));

const str = (v: unknown): string => (v == null ? '' : String(v).trim());
const num = (v: unknown): number | undefined => {
  const s = str(v).replace(',', '.');
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
};
const bool = (v: unknown): boolean | undefined => {
  const s = norm(str(v));
  if (s === '') return undefined;
  return ['evet', 'e', '1', 'true', 'aktif', 'yes'].includes(s);
};

function parseSheet(base64: string): Row[] {
  const wb = XLSX.read(base64, { type: 'base64' });
  const first = wb.SheetNames[0];
  const ws = first ? wb.Sheets[first] : undefined;
  if (!ws) return [];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  return raw
    .map((r) => {
      const o: Record<string, unknown> = {};
      for (const [h, v] of Object.entries(r)) {
        const k = HEADER_TO_KEY.get(norm(h));
        if (k) o[k] = v;
      }
      return o;
    })
    .filter((o) => Object.values(o).some((v) => str(v) !== ''))
    .map((o) => ({
      productCode: str(o.productCode),
      productName: str(o.productName),
      category: str(o.category) || undefined,
      brand: str(o.brand) || undefined,
      description: str(o.description) || undefined,
      variantCode: str(o.variantCode),
      variantName: str(o.variantName),
      uom: str(o.uom).toLowerCase(),
      price: num(o.price) ?? Number.NaN,
      stock: num(o.stock),
      minQty: num(o.minQty),
      qtyStep: num(o.qtyStep),
      active: bool(o.active),
    }));
}

const ACTION_LABEL = { create: 'Yeni', update: 'Güncelle', error: 'Hata' } as const;

export default function ExcelScreen() {
  const utils = trpc.useUtils();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);

  const importM = trpc.sheet.import.useMutation();

  const doExport = async (): Promise<void> => {
    setBusy(true);
    try {
      const data = await utils.sheet.export.fetch();
      const aoa = [
        COLUMNS.map((c) => c.header),
        ...data.map((d) =>
          COLUMNS.map((c) => {
            const v = d[c.key];
            if (c.key === 'active') return v === false ? 'Hayır' : 'Evet';
            return v ?? '';
          }),
        ),
      ];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = COLUMNS.map((c) => ({ wch: Math.max(12, c.header.length + 2) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Katalog');
      const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
      const uri = `${FileSystem.cacheDirectory}katalog.xlsx`;
      await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Paylaşım yok', 'Bu cihazda dosya paylaşımı kullanılamıyor.');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Katalog',
        UTI: 'org.openxmlformats.spreadsheetml.sheet',
      });
    } catch (e) {
      Alert.alert('Dışa aktarılamadı', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pick = async (): Promise<void> => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          '*/*',
        ],
      });
      if (res.canceled || !res.assets[0]) return;
      const asset = res.assets[0];
      setBusy(true);
      const b64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const parsed = parseSheet(b64);
      if (parsed.length === 0) {
        Alert.alert('Boş dosya', 'Dosyada okunabilir satır bulunamadı. Önce "Excel olarak dışa aktar" ile şablonu alın.');
        return;
      }
      if (parsed.length > 500) {
        Alert.alert('Çok fazla satır', 'Tek seferde en fazla 500 satır içe aktarılabilir.');
        return;
      }
      setRows(parsed);
      setFileName(asset.name);
      importM.reset();
      await runImport(parsed, false);
    } catch (e) {
      Alert.alert('Dosya okunamadı', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runImport = async (r: Row[], apply: boolean): Promise<void> => {
    try {
      await importM.mutateAsync({ rows: r.map(clean), apply });
      if (apply) {
        void utils.catalog.invalidate();
        void utils.stock.invalidate();
      }
    } catch (e) {
      Alert.alert('İçe aktarılamadı', (e as Error).message);
    }
  };

  const results = importM.data;
  const errors = results?.filter((x) => x.action === 'error') ?? [];
  const okCount = (results?.length ?? 0) - errors.length;
  const applied = importM.variables?.apply === true && importM.isSuccess;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Dışa aktar</Text>
        <Text style={styles.muted}>
          Tüm ürün ve varyantları tek bir Excel dosyası olarak indirin. Aynı dosya içe aktarım şablonudur.
        </Text>
        <TouchableOpacity style={styles.primary} onPress={() => void doExport()} disabled={busy}>
          <Text style={styles.primaryText}>Excel olarak dışa aktar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>İçe aktar</Text>
        <Text style={styles.muted}>
          Varyant kodu mevcutsa güncellenir, yoksa yeni eklenir. Stok sütunu hedef bakiyedir. Birimler: g, kg, ml, cl, l,
          adet, paket, kutu, koli, cuval. Önce önizleme gösterilir, onaylamadan hiçbir şey değişmez.
        </Text>
        <TouchableOpacity style={styles.secondary} onPress={() => void pick()} disabled={busy}>
          <Text style={styles.secondaryText}>Excel dosyası seç</Text>
        </TouchableOpacity>
      </View>

      {(busy || importM.isPending) && <ActivityIndicator color={colors.accent} />}

      {rows && results && (
        <View style={styles.card}>
          <Text style={styles.title}>{applied ? 'Aktarım tamamlandı' : 'Önizleme'}</Text>
          <Text style={styles.muted}>
            {fileName} · {rows.length} satır · {okCount} geçerli · {errors.length} hatalı
          </Text>

          {errors.slice(0, 30).map((e) => (
            <Text key={e.row} style={styles.error}>
              Satır {e.row}
              {e.variantCode ? ` (${e.variantCode})` : ''}: {e.message}
            </Text>
          ))}
          {errors.length > 30 && <Text style={styles.muted}>… ve {errors.length - 30} hata daha</Text>}

          {!applied && (
            <>
              <Text style={styles.muted}>
                {results.filter((x) => x.action === 'create').length} {ACTION_LABEL.create.toLowerCase()},{' '}
                {results.filter((x) => x.action === 'update').length} {ACTION_LABEL.update.toLowerCase()} yapılacak.
                Hatalı satırlar atlanır.
              </Text>
              <TouchableOpacity
                style={[styles.primary, (okCount === 0 || importM.isPending) && styles.disabled]}
                disabled={okCount === 0 || importM.isPending}
                onPress={() =>
                  Alert.alert('İçe aktar', `${okCount} satır uygulanacak. Onaylıyor musunuz?`, [
                    { text: 'Vazgeç', style: 'cancel' },
                    { text: 'Uygula', onPress: () => void runImport(rows, true) },
                  ])
                }
              >
                <Text style={styles.primaryText}>{okCount} satırı uygula</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

/** NaN JSON'a null olarak gider ve zod'u kırar; sunucu doğrulaması için güvenli bir sayıya çevir. */
function clean(r: Row): Row {
  const f = (n: number | undefined): number | undefined => (n === undefined || Number.isNaN(n) ? undefined : n);
  return { ...r, price: Number.isNaN(r.price) ? -1 : r.price, stock: f(r.stock), minQty: f(r.minQty), qtyStep: f(r.qtyStep) };
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(3) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(4),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(2.5),
  },
  title: { fontSize: 16, fontWeight: '700', color: colors.ink },
  muted: { fontSize: 13, color: colors.inkMuted, lineHeight: 18 },
  error: { fontSize: 12, color: '#b3261e' },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing(3.5),
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondary: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingVertical: spacing(3.5),
    alignItems: 'center',
  },
  secondaryText: { color: colors.accent, fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.5 },
});
