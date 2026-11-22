import { SupportedLanguage } from '../i18n/translations';

interface CategoryTranslationEntry {
  aliases: string[];
  labels: Record<SupportedLanguage, string>;
}

const CATEGORY_CATALOG: CategoryTranslationEntry[] = [
  {
    aliases: [
      'moda y ropa',
      'ropa y moda',
      'ropa',
      'moda',
      'apparel & fashion',
      'apparel',
      'fashion',
      'clothing',
      '服装与时尚',
      '服装',
      '服饰',
    ],
    labels: {
      es: 'Moda y Ropa',
      en: 'Apparel & Fashion',
      zh: '服装与时尚',
    },
  },
  {
    aliases: [
      'calzado y accesorios',
      'calzado',
      'zapatos',
      'footwear & accessories',
      'footwear',
      'shoes',
      '鞋靴与配饰',
      '鞋靴',
    ],
    labels: {
      es: 'Calzado y Accesorios',
      en: 'Footwear & Accessories',
      zh: '鞋靴与配饰',
    },
  },
  {
    aliases: [
      'comercio general',
      'tienda general',
      'general store',
      'general retail',
      'general',
      '综合百货',
      '百货',
      '普通商店',
    ],
    labels: {
      es: 'Comercio General',
      en: 'General Store',
      zh: '综合百货',
    },
  },
  {
    aliases: [
      'bodegón & licores',
      'bodegon & licores',
      'bodegón y licores',
      'bodegon',
      'bodegón',
      'licores',
      'market & spirits',
      'minimarket',
      'groceries',
      '精品酒水超市',
      '酒水超市',
      '超市',
    ],
    labels: {
      es: 'Bodegón & Licores',
      en: 'Market & Spirits',
      zh: '精品酒水超市',
    },
  },
  {
    aliases: [
      'tecnología',
      'tecnologia',
      'electrónica',
      'electronica',
      'technology',
      'electronics',
      'tech',
      '数码电子',
      '科技数码',
      '电子产品',
    ],
    labels: {
      es: 'Tecnología',
      en: 'Technology',
      zh: '数码电子',
    },
  },
  {
    aliases: [
      'alimentos',
      'alimentos y bebidas',
      'comida',
      'víveres',
      'viveres',
      'food & beverages',
      'food',
      '食品与饮料',
      '食品',
      '粮油食品',
    ],
    labels: {
      es: 'Alimentos y Bebidas',
      en: 'Food & Beverages',
      zh: '食品与饮料',
    },
  },
  {
    aliases: [
      'bebidas',
      'beverages',
      'drinks',
      '饮品',
      '饮料',
    ],
    labels: {
      es: 'Bebidas',
      en: 'Beverages',
      zh: '饮品',
    },
  },
  {
    aliases: [
      'salud y belleza',
      'belleza',
      'cosméticos',
      'cosmeticos',
      'farmacia',
      'health & beauty',
      'beauty',
      'pharmacy',
      '美妆与健康',
      '美妆个护',
    ],
    labels: {
      es: 'Salud y Belleza',
      en: 'Health & Beauty',
      zh: '美妆与健康',
    },
  },
  {
    aliases: [
      'hogar y ferretería',
      'hogar y ferreteria',
      'hogar',
      'ferretería',
      'ferreteria',
      'home & hardware',
      'home',
      'hardware',
      '家居与五金',
      '家居百货',
    ],
    labels: {
      es: 'Hogar y Ferretería',
      en: 'Home & Hardware',
      zh: '家居与五金',
    },
  },
  {
    aliases: [
      'accesorios',
      'accessories',
      '配饰',
      '配件',
    ],
    labels: {
      es: 'Accesorios',
      en: 'Accessories',
      zh: '配饰配件',
    },
  },
  {
    aliases: [
      'deportes',
      'ropa deportiva',
      'sports',
      'sportswear',
      '运动户外',
      '体育用品',
    ],
    labels: {
      es: 'Deportes',
      en: 'Sports & Activewear',
      zh: '运动户外',
    },
  },
  {
    aliases: [
      'repuestos',
      'repuestos automotrices',
      'automotriz',
      'auto parts',
      '汽车配件',
      '零配件',
    ],
    labels: {
      es: 'Repuestos',
      en: 'Auto Parts',
      zh: '汽车零配件',
    },
  },
  {
    aliases: [
      'infantil',
      'niños',
      'kids',
      'baby & kids',
      '母婴童装',
      '童装',
    ],
    labels: {
      es: 'Infantil',
      en: 'Kids & Baby',
      zh: '母婴童装',
    },
  },
  {
    aliases: [
      'papelería',
      'papeleria',
      'oficina',
      'stationery',
      'office supplies',
      '文具办公',
    ],
    labels: {
      es: 'Papelería y Oficina',
      en: 'Stationery & Office',
      zh: '文具办公',
    },
  },
  {
    aliases: ['cervezas', 'cerveza', 'beers', 'beer', '啤酒'],
    labels: { es: 'Cervezas', en: 'Beers', zh: '啤酒' },
  },
  {
    aliases: ['vinos', 'vino', 'wines', 'wine', '葡萄酒', '红酒'],
    labels: { es: 'Vinos', en: 'Wines', zh: '葡萄酒' },
  },
  {
    aliases: ['destilados', 'spirits', 'liquors', '烈酒'],
    labels: { es: 'Destilados', en: 'Spirits', zh: '烈酒' },
  },
  {
    aliases: ['espumantes', 'sparkling', 'sparkling wines', '起泡酒', '香槟'],
    labels: { es: 'Espumantes', en: 'Sparkling Wines', zh: '起泡酒' },
  },
  {
    aliases: ['ron', 'rum', '朗姆酒'],
    labels: { es: 'Ron', en: 'Rum', zh: '朗姆酒' },
  },
  {
    aliases: ['whisky', 'whiskey', '威士忌'],
    labels: { es: 'Whisky', en: 'Whiskey', zh: '威士忌' },
  },
  {
    aliases: ['snacks', 'botanas', 'pasapalos', '零食小吃'],
    labels: { es: 'Snacks', en: 'Snacks', zh: '零食小吃' },
  },
  {
    aliases: ['pantalones', 'jeans', 'pants', 'trousers', '裤装'],
    labels: { es: 'Pantalones', en: 'Pants & Jeans', zh: '裤装牛仔' },
  },
  {
    aliases: ['franelas', 'camisas', 'shirts', 't-shirts', '上衣衬衫'],
    labels: { es: 'Franelas y Camisas', en: 'Shirts & Tops', zh: 'T恤与上衣' },
  },
  {
    aliases: ['sin categoría', 'sin categoria', 'uncategorized', '未分类'],
    labels: { es: 'Sin Categoría', en: 'Uncategorized', zh: '未分类' },
  },
];

const ALIAS_LOOKUP = new Map<string, Record<SupportedLanguage, string>>();
for (const entry of CATEGORY_CATALOG) {
  for (const alias of entry.aliases) {
    ALIAS_LOOKUP.set(alias.toLowerCase(), entry.labels);
  }
}

/**
 * Translates common store/product categories registered in any language (ES, EN, or ZH)
 * into the active viewer's selected UI language while keeping unknown custom strings intact.
 */
export function translateCategoryLabel(
  rawCategory: string | undefined | null,
  lang: SupportedLanguage
): string {
  const cleaned = (rawCategory || '').trim();
  if (!cleaned) return '';
  const exact = ALIAS_LOOKUP.get(cleaned.toLowerCase());
  if (exact) {
    return exact[lang] || exact.es;
  }
  return cleaned;
}
