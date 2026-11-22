import { SupportedLanguage } from '../i18n/translations';

export interface SizePresetPack {
  id: 'apparel_alpha' | 'pants_numeric' | 'footwear' | 'kids' | 'universal';
  label: Record<SupportedLanguage, string>;
  sizes: string[];
}

export const CLOTHING_SIZE_PRESETS: SizePresetPack[] = [
  {
    id: 'apparel_alpha',
    label: {
      es: 'Camisas / Franela / Vestidos',
      en: 'Tops / Dresses / Streetwear',
      zh: '上衣 / 连衣裙 / 通用尺码',
    },
    sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
  },
  {
    id: 'pants_numeric',
    label: {
      es: 'Pantalones / Jeans (Numérico)',
      en: 'Pants / Jeans (Numeric)',
      zh: '裤装 / 牛仔裤 (数字码)',
    },
    sizes: ['26', '28', '30', '32', '34', '36', '38', '40', '42'],
  },
  {
    id: 'footwear',
    label: {
      es: 'Calzado (EU 35–44)',
      en: 'Footwear (EU 35–44)',
      zh: '鞋靴 (欧码 35–44)',
    },
    sizes: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44'],
  },
  {
    id: 'kids',
    label: {
      es: 'Infantil / Juvenil',
      en: 'Kids / Youth',
      zh: '童装 / 青少年',
    },
    sizes: ['2', '4', '6', '8', '10', '12', '14', '16'],
  },
  {
    id: 'universal',
    label: {
      es: 'Talla Única / Ajustable',
      en: 'One Size / Adjustable',
      zh: '均码 / 可调节',
    },
    sizes: ['Única', 'OS', 'Ajustable'],
  },
];

export const MAX_CLOTHING_SIZES = 40;
export const MAX_SIZE_LABEL_LEN = 24;

export function sanitizeSizeToken(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_SIZE_LABEL_LEN);
  if (!cleaned) return '';
  if (/^(xs|s|m|l|xl|xxl|xxxl|2xl|3xl|4xl|os)$/i.test(cleaned)) {
    return cleaned.toUpperCase();
  }
  return cleaned;
}

export function normalizeSizeList(input?: unknown): string[] {
  if (!input) return [];
  const rawList: string[] = Array.isArray(input)
    ? input.map((v) => String(v ?? ''))
    : typeof input === 'string'
      ? input.split(/[,;|/\n]+/)
      : [];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of rawList) {
    const token = sanitizeSizeToken(raw);
    if (!token) continue;
    const dedupeKey = token.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push(token);
    if (result.length >= MAX_CLOTHING_SIZES) break;
  }

  return result;
}

export function parseSizesFromText(rawText: string): string[] {
  return normalizeSizeList(rawText);
}

export function formatSizesCsv(sizes?: string[]): string {
  return normalizeSizeList(sizes).join(' | ');
}

export function isFashionOrApparelCategory(category?: string): boolean {
  const c = (category || '').toLowerCase();
  return /ropa|moda|calzado|zapato|boutique|textil|prenda|camisa|franela|pantalon|jean|vestido|fashion|apparel|clothing|shoes|服装|服饰|鞋/.test(
    c
  );
}

export function buildCartLineKey(productId: string, selectedSize?: string): string {
  const cleanSize = sanitizeSizeToken(selectedSize || '').toLowerCase();
  return cleanSize ? `${productId}::${cleanSize}` : productId;
}
