import React, { useState } from 'react';
import { Product } from '../types';
import { 
  Package, 
  Search, 
  Plus, 
  Minus, 
  AlertTriangle, 
  Check, 
  X, 
  Tag, 
  Barcode,
  Layers,
  ArrowUpDown
} from 'lucide-react';

interface InventoryModuleProps {
  products: Product[];
  onUpdateProductStock: (id: string, delta: number) => void;
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  exchangeRate: number;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  products,
  onUpdateProductStock,
  onAddProduct,
  exchangeRate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [showAddModal, setShowAddModal] = useState(false);

  // New product form state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<Product['category']>('Licores');
  const [newSKU, setNewSKU] = useState('');
  const [newStock, setNewStock] = useState('12');
  const [newMinStock, setNewMinStock] = useState('4');
  const [newCostUSD, setNewCostUSD] = useState('15.00');
  const [newPriceUSD, setNewPriceUSD] = useState('22.00');
  const [newUnit, setNewUnit] = useState('Botella');

  const categories = ['Todos', 'Licores', 'Cervezas', 'Vinos', 'Bebidas', 'Snacks'];

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode.includes(searchTerm);
    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const totalValueUSD = products.reduce((acc, p) => acc + (p.stock * p.priceUSD), 0);
  const totalStockItems = products.reduce((acc, p) => acc + p.stock, 0);
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    onAddProduct({
      name: newName.trim(),
      category: newCategory,
      sku: newSKU.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      stock: parseInt(newStock) || 0,
      minStock: parseInt(newMinStock) || 2,
      costUSD: parseFloat(newCostUSD) || 0,
      priceUSD: parseFloat(newPriceUSD) || 0,
      unit: newUnit,
      barcode: `759${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    });

    setNewName('');
    setNewSKU('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Inventory KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block mb-1">Valoración en Almacén</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-amber-400 tabular-nums">
              ${totalValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
            </span>
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            ≈ {(totalValueUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block mb-1">Unidades Totales</span>
          <div className="text-xl font-bold font-mono text-white tabular-nums">
            {totalStockItems} <span className="text-xs font-normal text-slate-400">unidades en cava</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {products.length} productos registrados
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <span className="text-xs text-slate-400 block mb-1">Alertas de Reposición</span>
          <div className="flex items-center gap-2">
            <span className={`text-xl font-bold font-mono tabular-nums ${lowStockCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {lowStockCount}
            </span>
            <span className="text-xs text-slate-400">ítems en o bajo el mínimo</span>
          </div>
          <span className="text-xs text-slate-500">
            {lowStockCount > 0 ? 'Requieren compra a distribuidor' : 'Stock en niveles óptimos'}
          </span>
        </div>
      </div>

      {/* Filter and Actions Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por licor, marca, código de barras o SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Add Product Button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar Producto</span>
        </button>
      </div>

      {/* Category Segmented Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Inventory Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Producto & SKU</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4 text-right">Costo (USD)</th>
                <th className="py-3 px-4 text-right">Precio Venta</th>
                <th className="py-3 px-4 text-center">Stock / Cava</th>
                <th className="py-3 px-4 text-right">Acción Rápida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No se encontraron productos coincidentes.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLowStock = p.stock <= p.minStock;
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">{p.name}</div>
                        <div className="text-xs text-slate-400 font-mono">
                          {p.sku} · {p.barcode}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-300">{p.category}</span>
                        <span className="text-slate-500 block text-xs">Unidad: {p.unit}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400 tabular-nums">
                        ${p.costUSD.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono font-bold text-amber-400 tabular-nums">
                          ${p.priceUSD.toFixed(2)} USD
                        </span>
                        <span className="block text-xs font-mono text-slate-400 tabular-nums">
                          {(p.priceUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          {isLowStock && (
                            <span title="Stock bajo">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            </span>
                          )}
                          <span
                            className={`font-mono font-bold tabular-nums ${
                              isLowStock ? 'text-amber-400 font-extrabold' : 'text-white'
                            }`}
                          >
                            {p.stock}
                          </span>
                          <span className="text-xs text-slate-500">/ min {p.minStock}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800">
                          <button
                            onClick={() => onUpdateProductStock(p.id, -1)}
                            disabled={p.stock <= 0}
                            className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Restar 1 unidad (salida/merma)"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="px-2 font-mono text-xs text-slate-400">Stock</span>
                          <button
                            onClick={() => onUpdateProductStock(p.id, 1)}
                            className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded"
                            title="Sumar 1 unidad (entrada/compra)"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add Product */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-lg font-display">Registrar Nuevo Producto</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Nombre del Producto / Licor</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Ron Añejo Especial (750ml)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Categoría</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as Product['category'])}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Licores">Licores</option>
                    <option value="Cervezas">Cervezas</option>
                    <option value="Vinos">Vinos</option>
                    <option value="Bebidas">Bebidas</option>
                    <option value="Snacks">Snacks</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Unidad</label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Botella">Botella</option>
                    <option value="Caja">Caja</option>
                    <option value="Fardo">Fardo</option>
                    <option value="Lata">Lata</option>
                    <option value="Bolsa">Bolsa</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Costo Compra (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCostUSD}
                    onChange={(e) => setNewCostUSD(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Precio Venta (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newPriceUSD}
                    onChange={(e) => setNewPriceUSD(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono"
                  />
                  <span className="text-[10px] text-amber-400 font-mono mt-0.5 block">
                    ≈ {(parseFloat(newPriceUSD || '0') * exchangeRate).toFixed(2)} Bs.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Stock Inicial</label>
                  <input
                    type="number"
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Mínimo Alerta</label>
                  <input
                    type="number"
                    value={newMinStock}
                    onChange={(e) => setNewMinStock(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                >
                  Guardar en Almacén
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
