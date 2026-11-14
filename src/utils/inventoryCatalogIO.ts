import { Product } from '../types';

export interface PortableInventoryItem {
  nombre: string;
  descripcion: string;
  foto: string;
  precioUSD: number;
  costoUSD: number;
  stock: number;
  minStock: number;
  calificacion: number;
  categoria: string;
  sku: string;
  unidad: string;
  codigoBarras: string;
  rotacion?: 'Alta' | 'Media' | 'Baja';
  ubicacion?: string;
  proveedor?: string;
}

function escapeCsvCell(value: string | number | undefined): string {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportInventoryCatalogCSV(products: Product[]): void {
  const headers = [
    'nombre',
    'descripcion',
    'foto',
    'precioUSD',
    'costoUSD',
    'stock',
    'minStock',
    'calificacion',
    'categoria',
    'sku',
    'unidad',
    'codigoBarras',
    'rotacion',
    'ubicacion',
    'proveedor',
  ];

  const rows = products.map((p) =>
    [
      escapeCsvCell(p.name),
      escapeCsvCell(p.description || ''),
      escapeCsvCell(p.image || ''),
      escapeCsvCell(p.priceUSD.toFixed(2)),
      escapeCsvCell(p.costUSD.toFixed(2)),
      escapeCsvCell(p.stock),
      escapeCsvCell(p.minStock),
      escapeCsvCell((p.rating ?? 5).toFixed(1)),
      escapeCsvCell(p.category),
      escapeCsvCell(p.sku),
      escapeCsvCell(p.unit),
      escapeCsvCell(p.barcode),
      escapeCsvCell(p.turnoverRate || 'Media'),
      escapeCsvCell(p.location || 'Cava Principal'),
      escapeCsvCell(p.supplier || ''),
    ].join(',')
  );

  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `catalogo_inventario_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportInventoryCatalogJSON(products: Product[]): void {
  const payload = {
    plataforma: 'Smith Solutions E-Commerce',
    exportadoEl: new Date().toISOString(),
    totalProductos: products.length,
    productos: products.map<PortableInventoryItem>((p) => ({
      nombre: p.name,
      descripcion: p.description || '',
      foto: p.image || '',
      precioUSD: p.priceUSD,
      costoUSD: p.costUSD,
      stock: p.stock,
      minStock: p.minStock,
      calificacion: p.rating ?? 5,
      categoria: p.category,
      sku: p.sku,
      unidad: p.unit,
      codigoBarras: p.barcode,
      rotacion: p.turnoverRate || 'Media',
      ubicacion: p.location || 'Cava Principal',
      proveedor: p.supplier || '',
    })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `catalogo_inventario_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadInventoryCSVTemplate(): void {
  const headers =
    'nombre,descripcion,foto,precioUSD,costoUSD,stock,minStock,calificacion,categoria,sku,unidad,codigoBarras,rotacion,ubicacion,proveedor';
  const sample1 =
    '"Ron Santa Teresa 1796 (750ml)","Ron solera premium añejado en barricas de roble","https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400",48.00,32.00,18,5,5.0,"Licores","RON-1796","Botella","7591234567890","Alta","Cava Principal","C.A. Ron Santa Teresa"';
  const sample2 =
    '"Cerveza Artesanal IPA Pack 6","Pack de 6 cervezas IPA con lúpulo cítrico","",14.50,9.20,24,6,4.7,"Cervezas","CER-IPA6","Caja","7591234567891","Alta","Barra Central","Cervecería Artesanal"';

  const csv = '\uFEFF' + [headers, sample1, sample2].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plantilla_catalogo_inventario.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell);
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
  }
  return rows;
}

function normalizeLocation(val: string): Product['location'] {
  const valid: NonNullable<Product['location']>[] = [
    'Cava Principal',
    'Barra Central',
    'Estantería Premium',
    'Depósito Seco',
  ];
  const found = valid.find((v) => v.toLowerCase() === val.trim().toLowerCase());
  return found || 'Cava Principal';
}

function normalizeTurnover(val: string): 'Alta' | 'Media' | 'Baja' {
  const v = val.trim().toLowerCase();
  if (v === 'alta') return 'Alta';
  if (v === 'baja') return 'Baja';
  return 'Media';
}

export function parseInventoryImportFile(
  rawText: string,
  fileName: string
): Omit<Product, 'id'>[] {
  const clean = rawText.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];

  if (fileName.toLowerCase().endsWith('.json') || clean.startsWith('{') || clean.startsWith('[')) {
    const parsed = JSON.parse(clean);
    const list: Record<string, unknown>[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.productos)
        ? parsed.productos
        : Array.isArray(parsed.products)
          ? parsed.products
          : [];

    return list
      .map((item, idx): Omit<Product, 'id'> => {
        const name = String(item.nombre || item.name || item.producto || '').trim();
        const priceUSD = Math.max(
          0,
          Number(item.precioUSD ?? item.precio ?? item.priceUSD ?? item.price ?? 0) || 0
        );
        const costUSD = Math.max(
          0,
          Number(item.costoUSD ?? item.costo ?? item.costUSD ?? priceUSD * 0.65) || 0
        );
        const rating = Math.max(
          1,
          Math.min(
            5,
            Number(
              item.calificacion ??
                item.calificacionEstrellas ??
                item.rating ??
                item.estrellas ??
                5
            ) || 5
          )
        );
        return {
          name,
          description: String(item.descripcion || item.description || '').trim() || undefined,
          image: String(item.foto || item.image || item.imageUrl || item.imagen || '').trim() || undefined,
          priceUSD,
          costUSD,
          stock: Math.max(0, Math.floor(Number(item.stock ?? item.cantidad ?? 10) || 0)),
          minStock: Math.max(0, Math.floor(Number(item.minStock ?? item.minimo ?? 3) || 0)),
          rating: Number(rating.toFixed(1)),
          category: String(item.categoria || item.category || 'General').trim() || 'General',
          sku: String(item.sku || `SKU-IMP-${Date.now().toString().slice(-4)}-${idx}`).trim(),
          unit: String(item.unidad || item.unit || 'und').trim() || 'und',
          barcode:
            String(item.codigoBarras || item.barcode || '').trim() ||
            `759${Math.floor(1000000000 + Math.random() * 9000000000)}`,
          turnoverRate: normalizeTurnover(String(item.rotacion || item.turnoverRate || 'Media')),
          location: normalizeLocation(String(item.ubicacion || item.location || 'Cava Principal')),
          supplier: String(item.proveedor || item.supplier || '').trim() || undefined,
        };
      })
      .filter((p) => p.name.length > 0);
  }

  // CSV format
  const matrix = parseCsvMatrix(clean);
  if (matrix.length < 2) return [];
  const headers = matrix[0].map((h) => h.trim().toLowerCase());
  const findCol = (keys: string[]) =>
    headers.findIndex((h) => keys.some((k) => h === k || h.includes(k)));

  const cName = findCol(['nombre', 'name', 'producto']);
  const cDesc = findCol(['descripcion', 'description']);
  const cPhoto = findCol(['foto', 'imageurl', 'image', 'imagen']);
  const cPrice = findCol(['preciousd', 'precio', 'priceusd', 'price']);
  const cCost = findCol(['costousd', 'costo', 'costusd']);
  const cStock = findCol(['stock', 'cantidad', 'existencia']);
  const cMin = findCol(['minstock', 'minimo']);
  const cRating = findCol(['calificacion', 'rating', 'estrellas']);
  const cCat = findCol(['categoria', 'category']);
  const cSku = findCol(['sku', 'codigo']);
  const cUnit = findCol(['unidad', 'unit']);
  const cBar = findCol(['codigobarras', 'barcode']);
  const cRot = findCol(['rotacion', 'turnover']);
  const cLoc = findCol(['ubicacion', 'location']);
  const cSup = findCol(['proveedor', 'supplier']);

  return matrix
    .slice(1)
    .map((cols, idx): Omit<Product, 'id'> => {
      const val = (index: number) => (index >= 0 && index < cols.length ? cols[index].trim() : '');
      const name = val(cName >= 0 ? cName : 0);
      const priceUSD = Math.max(0, Number(val(cPrice).replace(',', '.')) || 0);
      const costRaw = val(cCost);
      const costUSD = costRaw
        ? Math.max(0, Number(costRaw.replace(',', '.')) || 0)
        : Number((priceUSD * 0.65).toFixed(2));
      const rating = Math.max(
        1,
        Math.min(5, Number((val(cRating) || '5').replace(',', '.')) || 5)
      );

      return {
        name,
        description: val(cDesc) || undefined,
        image: val(cPhoto) || undefined,
        priceUSD,
        costUSD,
        stock: Math.max(0, Math.floor(Number(val(cStock) || '10') || 0)),
        minStock: Math.max(0, Math.floor(Number(val(cMin) || '3') || 0)),
        rating: Number(rating.toFixed(1)),
        category: val(cCat) || 'General',
        sku: val(cSku) || `SKU-IMP-${Date.now().toString().slice(-4)}-${idx}`,
        unit: val(cUnit) || 'und',
        barcode:
          val(cBar) || `759${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        turnoverRate: normalizeTurnover(val(cRot)),
        location: normalizeLocation(val(cLoc)),
        supplier: val(cSup) || undefined,
      };
    })
    .filter((p) => p.name.length > 0);
}
