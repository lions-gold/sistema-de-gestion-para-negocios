import React, { useState } from 'react';
import { 
  Product, 
  Sale, 
  EmailAlertConfig, 
  StockAlertEmailLog, 
  InventoryAuditLog, 
  InventoryAuditType, 
  ProductBatchTrace, 
  TraceabilityStep 
} from '../types';
import { 
  INITIAL_INVENTORY_AUDITS, 
  INITIAL_BATCH_TRACES 
} from '../data/mockData';
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
  ArrowUpDown, 
  Camera, 
  Mail, 
  Bell, 
  ShieldAlert, 
  TrendingDown, 
  Truck, 
  FileCheck, 
  ArrowRight, 
  Clock, 
  ClipboardList, 
  RotateCw, 
  Building2, 
  Download, 
  Share2, 
  Flame, 
  History, 
  Calendar, 
  DollarSign, 
  FileSpreadsheet, 
  CheckCircle2, 
  Filter, 
  ShoppingCart,
  MapPin,
  Upload,
  Star,
  Image as ImageIcon
} from 'lucide-react';
import { EmailAlertConfigModal } from './EmailAlertConfigModal';
import {
  getStoredEmailConfig,
  saveStoredEmailConfig,
  getStoredEmailLogs,
  saveStoredEmailLogs,
  recordSimulatedEmailDispatch,
} from '../utils/alertNotifications';
import { 
  exportInventoryAuditCSV, 
  exportInventoryAuditPDF 
} from '../utils/seniatExport';
import {
  exportInventoryCatalogCSV,
  exportInventoryCatalogJSON,
  downloadInventoryCSVTemplate,
  parseInventoryImportFile,
} from '../utils/inventoryCatalogIO';
import { compressImageFileToDataURL } from '../services/saasService';

interface InventoryModuleProps {
  products: Product[];
  onUpdateProductStock: (id: string, delta: number) => void;
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onImportProducts?: (products: Omit<Product, 'id'>[], mergeBySku?: boolean) => void;
  exchangeRate: number;
  onOpenScanner?: () => void;
  sales?: Sale[];
}

const AUDITS_STORAGE_KEY = 'lions_gold_inventory_audits';
const TRACES_STORAGE_KEY = 'lions_gold_inventory_traces';

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  products,
  onUpdateProductStock,
  onAddProduct,
  onImportProducts,
  exchangeRate,
  onOpenScanner,
  sales = [],
}) => {
  // Main Sub-Tab: 'catalog' | 'audit' | 'traceability'
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'audit' | 'traceability'>('catalog');

  // Search & Catalog Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [filterMode, setFilterMode] = useState<'all' | 'alerts_only' | 'high_rotation_risk'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const [showPurchaseOrderModal, setShowPurchaseOrderModal] = useState(false);

  // Email Alert state & persistence
  const [emailConfig, setEmailConfig] = useState<EmailAlertConfig>(getStoredEmailConfig);
  const [emailLogs, setEmailLogs] = useState<StockAlertEmailLog[]>(getStoredEmailLogs);
  const [emailToast, setEmailToast] = useState<{ message: string; logId: string } | null>(null);

  // New product form state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<string>('Licores');
  const [newSKU, setNewSKU] = useState('');
  const [newStock, setNewStock] = useState('12');
  const [newMinStock, setNewMinStock] = useState('4');
  const [newCostUSD, setNewCostUSD] = useState('15.00');
  const [newPriceUSD, setNewPriceUSD] = useState('22.00');
  const [newUnit, setNewUnit] = useState('Botella');
  const [newTurnover, setNewTurnover] = useState<'Alta' | 'Media' | 'Baja'>('Alta');
  const [newLocation, setNewLocation] = useState<Product['location']>('Cava Principal');
  const [newSupplier, setNewSupplier] = useState('C.A. Ron Santa Teresa');
  const [newImage, setNewImage] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newRating, setNewRating] = useState('5.0');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Bulk Export / Import state
  const [importPreview, setImportPreview] = useState<Omit<Product, 'id'>[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importMergeBySku, setImportMergeBySku] = useState(true);
  const [importFeedback, setImportFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- 2. AUDIT STATE (Mermas, Desvíos, Pérdidas) ---
  const [audits, setAudits] = useState<InventoryAuditLog[]>(() => {
    try {
      const stored = localStorage.getItem(AUDITS_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    return INITIAL_INVENTORY_AUDITS;
  });

  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditProductId, setAuditProductId] = useState(products[0]?.id || '');
  const [auditType, setAuditType] = useState<InventoryAuditType>('Merma por Rotura');
  const [auditQty, setAuditQty] = useState('1');
  const [auditLocation, setAuditLocation] = useState('Cava Principal');
  const [auditAuditor, setAuditAuditor] = useState('Carlos Smith (Jefe Almacén)');
  const [auditNotes, setAuditNotes] = useState('');
  const [auditDiscountStock, setAuditDiscountStock] = useState(true);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilterType, setAuditFilterType] = useState<string>('Todos');

  // --- 3. TRACEABILITY STATE (End-to-End Tracking) ---
  const [traces, setTraces] = useState<ProductBatchTrace[]>(() => {
    try {
      const stored = localStorage.getItem(TRACES_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    return INITIAL_BATCH_TRACES;
  });

  const [selectedTraceId, setSelectedTraceId] = useState<string>(traces[0]?.id || 'trace-001');
  const [traceSearch, setTraceSearch] = useState('');
  const [showAddTraceStepModal, setShowAddTraceStepModal] = useState(false);
  const [newStepStage, setNewStepStage] = useState<TraceabilityStep['stage']>('Traslado a Barra');
  const [newStepDescription, setNewStepDescription] = useState('');
  const [newStepRef, setNewStepRef] = useState('');
  const [newStepAuditor, setNewStepAuditor] = useState('Carlos Smith (Almacenista)');

  const baseCategories = ['Licores', 'Cervezas', 'Vinos', 'Bebidas', 'Snacks'];
  const categories = [
    'Todos',
    ...Array.from(
      new Set([
        ...baseCategories,
        ...products.map((p) => p.category).filter((c) => Boolean(c && c.trim())),
      ])
    ),
  ];

  // Catalog computations
  const totalValueUSD = products.reduce((acc, p) => acc + (p.stock * p.priceUSD), 0);
  const totalStockItems = products.reduce((acc, p) => acc + p.stock, 0);
  const lowStockCount = products.filter((p) => p.stock <= p.minStock).length;
  const highRotationRiskCount = products.filter((p) => p.turnoverRate === 'Alta' && p.stock <= p.minStock).length;

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode.includes(searchTerm) ||
      (p.batchNumber && p.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
    
    let matchesMode = true;
    if (filterMode === 'alerts_only') {
      matchesMode = p.stock <= p.minStock;
    } else if (filterMode === 'high_rotation_risk') {
      matchesMode = p.turnoverRate === 'Alta' && p.stock <= p.minStock;
    }
    
    return matchesSearch && matchesCategory && matchesMode;
  });

  // Audit Calculations
  const totalLossUSD = audits.reduce((sum, a) => sum + a.totalLossUSD, 0);
  const totalLossBs = totalLossUSD * exchangeRate;
  const totalLossQty = audits.reduce((sum, a) => sum + a.quantity, 0);

  const filteredAudits = audits.filter((a) => {
    const matchesSearch = a.productName.toLowerCase().includes(auditSearch.toLowerCase()) ||
      a.sku.toLowerCase().includes(auditSearch.toLowerCase()) ||
      a.auditorName.toLowerCase().includes(auditSearch.toLowerCase()) ||
      a.notes.toLowerCase().includes(auditSearch.toLowerCase());
    const matchesType = auditFilterType === 'Todos' || a.type === auditFilterType;
    return matchesSearch && matchesType;
  });

  // Traceability Current
  const currentTrace = traces.find((t) => t.id === selectedTraceId) || traces[0];

  const filteredTraces = traces.filter((t) => {
    const s = traceSearch.toLowerCase();
    return t.productName.toLowerCase().includes(s) ||
      t.batchNumber.toLowerCase().includes(s) ||
      t.sku.toLowerCase().includes(s) ||
      t.supplierName.toLowerCase().includes(s);
  });

  // Stock change handler with simulated email alert interception
  const handleStockChange = (id: string, delta: number) => {
    if (delta < 0) {
      const prod = products.find((p) => p.id === id);
      if (prod) {
        const willBeLow = (prod.stock + delta) <= prod.minStock;
        const wasAbove = prod.stock > prod.minStock;
        if (willBeLow && wasAbove && emailConfig.isEnabled && emailConfig.notifyOnManualAdjustment) {
          const simulatedProd = { ...prod, stock: Math.max(0, prod.stock + delta) };
          const log = recordSimulatedEmailDispatch(
            [simulatedProd],
            `Ajuste manual de stock en Almacén (-1 unidad)`,
            emailConfig
          );
          setEmailLogs(getStoredEmailLogs());
          setEmailToast({
            message: `Alerta enviada a ${emailConfig.recipientEmail}: "${prod.name}" alcanzó nivel crítico (${simulatedProd.stock} / ${prod.minStock} mín.)`,
            logId: log.id,
          });
          setTimeout(() => setEmailToast(null), 6000);
        }
      }
    }
    onUpdateProductStock(id, delta);
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const cleanCategory = newCategory.trim() || 'General';
    const parsedRating = Math.max(1, Math.min(5, parseFloat(newRating) || 5));

    onAddProduct({
      name: newName.trim(),
      category: cleanCategory,
      sku: newSKU.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      stock: parseInt(newStock) || 0,
      minStock: parseInt(newMinStock) || 2,
      costUSD: parseFloat(newCostUSD) || 0,
      priceUSD: parseFloat(newPriceUSD) || 0,
      unit: newUnit,
      barcode: `759${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      image: newImage.trim() || undefined,
      description: newDescription.trim() || undefined,
      rating: Number(parsedRating.toFixed(1)),
      turnoverRate: newTurnover,
      location: newLocation,
      supplier: newSupplier,
      batchNumber: `LT-${cleanCategory.substring(0, 3).toUpperCase()}-${new Date().getFullYear()}-${Math.floor(10 + Math.random() * 90)}`,
      expirationDate: '2028-12-31',
    });

    setNewName('');
    setNewSKU('');
    setNewImage('');
    setNewDescription('');
    setNewRating('5.0');
    setShowAddModal(false);
  };

  const handleNewProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    try {
      const dataUrl = await compressImageFileToDataURL(file, 420, 0.72);
      setNewImage(dataUrl);
    } catch {
      setImportFeedback({
        type: 'error',
        text: 'No se pudo procesar la imagen seleccionada. Prueba con otra foto o pega una URL.',
      });
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleImportFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFeedback(null);
    try {
      const text = await file.text();
      const parsed = parseInventoryImportFile(text, file.name);
      if (parsed.length === 0) {
        setImportPreview([]);
        setImportFileName('');
        setImportFeedback({
          type: 'error',
          text: 'El archivo no contiene productos válidos. Verifica las columnas (nombre, precioUSD, stock, calificacion, foto).',
        });
      } else {
        setImportPreview(parsed);
        setImportFileName(file.name);
      }
    } catch {
      setImportPreview([]);
      setImportFileName('');
      setImportFeedback({
        type: 'error',
        text: 'Error al leer el archivo. Asegúrate de subir un CSV o JSON con formato válido.',
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmImport = () => {
    if (importPreview.length === 0) return;
    if (onImportProducts) {
      onImportProducts(importPreview, importMergeBySku);
    } else {
      importPreview.forEach((item) => onAddProduct(item));
    }
    setImportFeedback({
      type: 'success',
      text: `Catálogo actualizado: se importaron ${importPreview.length} producto(s) desde ${importFileName}.`,
    });
    setImportPreview([]);
    setImportFileName('');
  };

  // Register New Audit Incident (Merma / Desvío)
  const handleCreateAudit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetProd = products.find((p) => p.id === auditProductId);
    if (!targetProd) return;

    const qty = Math.max(1, parseInt(auditQty) || 1);
    const lossUSD = Number((qty * targetProd.costUSD).toFixed(2));
    const lossBs = Number((lossUSD * exchangeRate).toFixed(2));
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const newAudit: InventoryAuditLog = {
      id: `audit-${Date.now().toString().slice(-5)}`,
      date: now,
      productId: targetProd.id,
      productName: targetProd.name,
      sku: targetProd.sku,
      type: auditType,
      quantity: qty,
      unitCostUSD: targetProd.costUSD,
      totalLossUSD: lossUSD,
      totalLossBs: lossBs,
      auditorName: auditAuditor.trim() || 'Auditoría Smith Solutions',
      location: auditLocation,
      notes: auditNotes.trim() || `Registro de ${auditType} en ${auditLocation}`,
    };

    const updated = [newAudit, ...audits];
    setAudits(updated);
    localStorage.setItem(AUDITS_STORAGE_KEY, JSON.stringify(updated));

    // Optionally discount stock directly
    if (auditDiscountStock && targetProd.stock > 0) {
      onUpdateProductStock(targetProd.id, -Math.min(targetProd.stock, qty));
    }

    // Add traceability event if batch exists
    const matchingTrace = traces.find((t) => t.productId === targetProd.id);
    if (matchingTrace) {
      const updatedTraces = traces.map((t) => {
        if (t.id === matchingTrace.id) {
          return {
            ...t,
            steps: [
              ...t.steps,
              {
                stage: 'Auditoría / Merma' as const,
                timestamp: now,
                description: `${auditType}: ${qty} unid. (${auditNotes || 'Sin notas'})`,
                referenceDoc: `Boleta #${newAudit.id}`,
                performedBy: auditAuditor,
              },
            ],
          };
        }
        return t;
      });
      setTraces(updatedTraces);
      localStorage.setItem(TRACES_STORAGE_KEY, JSON.stringify(updatedTraces));
    }

    setAuditNotes('');
    setShowAuditModal(false);
  };

  // Add Step to Traceability
  const handleAddTraceStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTrace || !newStepDescription.trim()) return;

    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const newStep: TraceabilityStep = {
      stage: newStepStage,
      timestamp: now,
      description: newStepDescription.trim(),
      referenceDoc: newStepRef.trim() || undefined,
      performedBy: newStepAuditor.trim() || 'Responsable de Almacén',
    };

    const updated = traces.map((t) => {
      if (t.id === currentTrace.id) {
        return {
          ...t,
          steps: [...t.steps, newStep],
        };
      }
      return t;
    });

    setTraces(updated);
    localStorage.setItem(TRACES_STORAGE_KEY, JSON.stringify(updated));
    setNewStepDescription('');
    setNewStepRef('');
    setShowAddTraceStepModal(false);
  };

  const handleSaveEmailConfig = (newConfig: EmailAlertConfig) => {
    saveStoredEmailConfig(newConfig);
    setEmailConfig(newConfig);
  };

  const handleTriggerTestEmail = (customEmail?: string) => {
    const lowStock = products.filter((p) => p.stock <= p.minStock);
    const targetProducts = lowStock.length > 0 ? lowStock : [products[0]];
    const log = recordSimulatedEmailDispatch(
      targetProducts,
      'Prueba manual desde Configuración de Alertas',
      emailConfig,
      customEmail
    );
    setEmailLogs(getStoredEmailLogs());
    setEmailToast({
      message: `Alerta de prueba enviada con éxito a ${customEmail || emailConfig.recipientEmail} (${targetProducts.length} producto(s) en stock crítico).`,
      logId: log.id,
    });
    setTimeout(() => setEmailToast(null), 6000);
  };

  const handleClearLogs = () => {
    saveStoredEmailLogs([]);
    setEmailLogs([]);
  };

  // Products needing reorder for the Purchase Order Suggestion
  const reorderList = products.filter((p) => p.stock <= p.minStock);
  const totalReorderEstimateUSD = reorderList.reduce((acc, p) => acc + (p.minStock * 2 - p.stock) * p.costUSD, 0);

  return (
    <div className="space-y-6">
      {/* 3-Tier Module Navigation (Catálogo & Alertas | Auditoría de Mermas | Trazabilidad de Lotes) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2 overflow-x-auto text-xs sm:text-sm">
          <button
            onClick={() => setActiveSubTab('catalog')}
            className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeSubTab === 'catalog'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-[#111114] border border-transparent'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Catálogo & Alertas</span>
            {lowStockCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-extrabold ${
                activeSubTab === 'catalog' ? 'bg-[#09090b] text-amber-400' : 'bg-red-500 text-white'
              }`}>
                {lowStockCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeSubTab === 'audit'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-[#111114] border border-transparent'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Auditoría & Mermas</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-extrabold ${
              activeSubTab === 'audit' ? 'bg-[#09090b] text-amber-400' : 'bg-zinc-900 text-zinc-300'
            }`}>
              {audits.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('traceability')}
            className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeSubTab === 'traceability'
                ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-[#111114] border border-transparent'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Trazabilidad de Mercancía</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-extrabold ${
              activeSubTab === 'traceability' ? 'bg-[#09090b] text-amber-400' : 'bg-zinc-900 text-zinc-300'
            }`}>
              {traces.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeSubTab === 'catalog' && (
            <button
              onClick={() => setShowPurchaseOrderModal(true)}
              className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Generar sugerencia de pedido para reposición"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Sugerencia de Pedido ({reorderList.length})</span>
            </button>
          )}

          {activeSubTab === 'audit' && (
            <button
              onClick={() => setShowAuditModal(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-rose-600 to-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-rose-600/20 hover:from-rose-500 hover:to-rose-400 transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Registrar Merma / Desvío</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: CATALOG & AUTOMATIC HIGH-ROTATION STOCK ALERTS                   */}
      {/* ========================================================================= */}
      {activeSubTab === 'catalog' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Inventory KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">Valoración en Almacén</span>
              <div className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                ${totalValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </div>
              <span className="text-xs text-zinc-500 font-mono tabular-nums">
                ≈ {(totalValueUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">Unidades en Cava & Barra</span>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                {totalStockItems} <span className="text-xs font-normal text-zinc-400">unidades</span>
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                {products.length} productos registrados
              </span>
            </div>

            <div 
              onClick={() => setFilterMode(filterMode === 'high_rotation_risk' ? 'all' : 'high_rotation_risk')}
              className={`border p-4 rounded-xl cursor-pointer transition-all ${
                filterMode === 'high_rotation_risk'
                  ? 'bg-amber-950/40 border-amber-500 shadow-md shadow-amber-950/40' 
                  : 'bg-[#111114] border-white/[0.08] hover:border-amber-500/30'
              }`}
              title="Filtrar productos de alta rotación en riesgo de agotarse"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-amber-300 font-semibold flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  Alta Rotación en Riesgo
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded">
                  Prioridad
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xl font-bold font-mono tabular-nums ${highRotationRiskCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {highRotationRiskCount}
                </span>
                <span className="text-xs text-zinc-400">ítems calientes críticos</span>
              </div>
              <span className="text-xs text-zinc-500">
                {highRotationRiskCount > 0 ? 'Cervezas y rones líderes por agotarse' : 'Rotación rápida abastecida'}
              </span>
            </div>

            <div 
              onClick={() => setFilterMode(filterMode === 'alerts_only' ? 'all' : 'alerts_only')}
              className={`border p-4 rounded-xl cursor-pointer transition-all ${
                filterMode === 'alerts_only' 
                  ? 'bg-red-950/40 border-red-500 shadow-md shadow-red-950/40' 
                  : 'bg-[#111114] border-white/[0.08] hover:border-white/[0.1]'
              }`}
              title="Haz clic para filtrar solo productos con stock bajo o crítico"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-400 block">Alertas de Reposición</span>
                {filterMode === 'alerts_only' && (
                  <span className="text-[10px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded">
                    Filtrado
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xl font-bold font-mono tabular-nums ${lowStockCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {lowStockCount}
                </span>
                <span className="text-xs text-zinc-400">ítems bajo mínimo</span>
              </div>
              <span className="text-xs text-zinc-500">
                {lowStockCount > 0 ? 'Requieren orden de compra inmediata' : 'Stock en niveles óptimos'}
              </span>
            </div>
          </div>

          {/* Email Alert Banner */}
          <div className="bg-[#111114] border border-white/[0.08] hover:border-amber-500/30 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs transition-colors">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Mail className="w-4 h-4" />
              </div>
              <span className="text-zinc-400">Notificaciones de Stock Crítico:</span>
              <span className="font-mono font-bold text-white truncate max-w-[200px] sm:max-w-none">
                {emailConfig.recipientEmail}
              </span>
              {emailConfig.isEnabled ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Activo
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-white/[0.1]">
                  Pausado
                </span>
              )}
            </div>

            <button
              onClick={() => setShowEmailConfig(true)}
              className="text-amber-400 hover:text-amber-300 font-bold text-xs flex items-center gap-1.5 bg-[#09090b]/80 hover:bg-zinc-800/80 border border-white/[0.08] hover:border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors min-h-[38px]"
            >
              <span>Configurar / Probar Envío</span>
              <span>→</span>
            </button>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por licor, marca, lote, SKU o código de barras..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-[#111114] border border-white/[0.08] rounded-lg pl-9 pr-8 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 min-h-[44px]"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {onOpenScanner && (
                <button
                  onClick={onOpenScanner}
                  className="px-3.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 active:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg flex items-center justify-center gap-1.5 min-h-[44px] transition-colors shrink-0"
                  title="Abrir lector de código de barras con la cámara"
                >
                  <Camera className="w-4 h-4" />
                  <span className="text-xs font-bold hidden sm:inline">Escanear</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowEmailConfig(true)}
                className="px-3.5 py-2.5 bg-zinc-900 hover:bg-zinc-800/80 text-zinc-200 border border-white/[0.1] rounded-lg flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold transition-all min-h-[44px]"
              >
                <Mail className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">Alertas Email</span>
              </button>

              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors whitespace-nowrap min-h-[44px]"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Nuevo Producto</span>
              </button>
            </div>
          </div>

          {/* Bulk Export / Import Catalog Bar (CSV / JSON) */}
          <div className="bg-[#111114] border border-white/[0.08] rounded-xl p-3.5 sm:p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    Exportar e Importar Catálogo (Fotos, Precios, Stock y Calificación)
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    Respalda tu inventario en CSV/JSON o carga productos masivamente por SKU.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={downloadInventoryCSVTemplate}
                  className="px-3 py-2 rounded-lg bg-[#09090b] hover:bg-zinc-800/80 text-zinc-300 border border-white/[0.1] font-medium flex items-center gap-1.5 transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Plantilla CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportInventoryCatalogCSV(products)}
                  disabled={products.length === 0}
                  className="px-3 py-2 rounded-lg bg-[#09090b] hover:bg-zinc-800/80 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportInventoryCatalogJSON(products)}
                  disabled={products.length === 0}
                  className="px-3 py-2 rounded-lg bg-[#09090b] hover:bg-zinc-800/80 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar JSON</span>
                </button>

                <label className="px-3.5 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1.5 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Importar Masivo CSV/JSON</span>
                  <input
                    type="file"
                    accept=".csv,.json,text/csv,application/json"
                    onChange={handleImportFileSelected}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {importFeedback && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                  importFeedback.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  {importFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{importFeedback.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setImportFeedback(null)}
                  className="p-1 hover:text-white"
                  aria-label="Cerrar mensaje"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {importPreview.length > 0 && (
              <div className="bg-[#09090b] border border-amber-500/30 rounded-xl p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
                  <div>
                    <span className="text-xs font-bold text-amber-300 block">
                      Vista previa de importación: {importPreview.length} producto(s) listos
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400">
                      Archivo: {importFileName}
                    </span>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={importMergeBySku}
                      onChange={(e) => setImportMergeBySku(e.target.checked)}
                      className="accent-amber-500 w-4 h-4 rounded"
                    />
                    <span>Actualizar productos existentes si coincide SKU</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                  {importPreview.slice(0, 6).map((item, idx) => (
                    <div
                      key={`${item.sku}-${idx}`}
                      className="flex items-center gap-2.5 p-2 rounded-lg bg-[#111114] border border-white/[0.08] text-xs"
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-10 h-10 rounded-md object-cover border border-white/[0.1] shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-zinc-900 border border-white/[0.1] flex items-center justify-center text-zinc-500 shrink-0">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-white truncate">{item.name}</div>
                        <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-2 flex-wrap">
                          <span className="text-amber-400 font-bold">${item.priceUSD.toFixed(2)}</span>
                          <span>Stock: {item.stock}</span>
                          <span className="inline-flex items-center gap-0.5 text-amber-300">
                            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                            {(item.rating ?? 5).toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {importPreview.length > 6 && (
                  <p className="text-[11px] text-zinc-400">
                    ... y {importPreview.length - 6} producto(s) adicionales listos para importar.
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setImportPreview([]);
                      setImportFileName('');
                    }}
                    className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Confirmar Importación ({importPreview.length})</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors min-h-[36px] ${
                    selectedCategory === cat
                      ? 'bg-amber-500 text-zinc-950 shadow-sm font-bold'
                      : 'bg-[#111114] text-zinc-400 hover:text-white hover:bg-zinc-800/80 border border-white/[0.08]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Rotation / Alert Presets */}
            <div className="flex items-center gap-1.5 text-xs">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  filterMode === 'all'
                    ? 'bg-zinc-900 text-white font-bold border border-white/[0.1]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Todos ({products.length})
              </button>

              <button
                onClick={() => setFilterMode('high_rotation_risk')}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 border transition-colors ${
                  filterMode === 'high_rotation_risk'
                    ? 'bg-amber-500 text-zinc-950 border-amber-400'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Alta Rotación Crítica ({highRotationRiskCount})</span>
              </button>

              <button
                onClick={() => setFilterMode('alerts_only')}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 border transition-colors ${
                  filterMode === 'alerts_only'
                    ? 'bg-red-600 text-white border-red-500'
                    : 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Bajo Stock ({lowStockCount})</span>
              </button>
            </div>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden space-y-3">
            {filteredProducts.length === 0 ? (
              <div className="py-8 text-center text-zinc-400 text-xs bg-[#111114] rounded-xl border border-white/[0.08]">
                No se encontraron productos con el filtro seleccionado.
              </div>
            ) : (
              filteredProducts.map((p) => {
                const isLowStock = p.stock <= p.minStock;
                const isHighRot = p.turnoverRate === 'Alta';

                return (
                  <div
                    key={p.id}
                    className={`border rounded-xl p-3.5 space-y-2.5 transition-colors border-l-4 ${
                      isLowStock
                        ? 'bg-red-950/25 border-red-500/40 border-l-red-500 shadow-sm shadow-red-950/30'
                        : 'bg-[#111114] border-white/[0.08] border-l-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          className="w-12 h-12 rounded-lg object-cover border border-white/[0.1] shrink-0 mt-0.5"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-white/[0.1]/70 flex items-center justify-center text-zinc-500 shrink-0 mt-0.5">
                          <Package className="w-5 h-5" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-amber-400 font-semibold">{p.category}</span>
                          <span className="text-zinc-500 text-[10px]">·</span>
                          {/* Rating */}
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                            {(p.rating ?? 5).toFixed(1)}
                          </span>
                          {/* Rotation Badge */}
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 ${
                            isHighRot 
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                              : 'bg-zinc-900 text-zinc-400'
                          }`}>
                            {isHighRot && <Flame className="w-2.5 h-2.5 text-amber-400" />}
                            Rotación {p.turnoverRate || 'Media'}
                          </span>
                          {isLowStock && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                              <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                              {p.stock === 0 ? 'Agotado' : '¡Reponer Ya!'}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-white text-sm mt-1 leading-snug">
                          {p.name}
                        </h4>
                        {p.description && (
                          <p className="text-[11px] text-zinc-400 line-clamp-1 mt-0.5">
                            {p.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 mt-0.5 flex-wrap">
                          <span>SKU: {p.sku}</span>
                          {p.batchNumber && <span>Lote: {p.batchNumber}</span>}
                          {p.location && <span>Ubic: {p.location}</span>}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-amber-400 text-base tabular-nums">
                          ${p.priceUSD.toFixed(2)}
                        </span>
                        <span className="block text-[10px] font-mono text-zinc-400 tabular-nums">
                          {(p.priceUSD * exchangeRate).toFixed(0)} Bs.
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${isLowStock ? 'text-red-400' : 'text-zinc-400'}`}>
                          Stock:
                        </span>
                        <span
                          className={`font-mono font-bold text-sm tabular-nums ${
                            isLowStock ? 'text-red-400 font-extrabold' : 'text-white'
                          }`}
                        >
                          {p.stock}
                        </span>
                        <span className="text-[11px] text-zinc-500">/ min {p.minStock} {p.unit}s</span>
                      </div>

                      <div className="flex items-center gap-1 bg-[#09090b] p-1 rounded-lg border border-white/[0.08]">
                        <button
                          onClick={() => handleStockChange(p.id, -1)}
                          disabled={p.stock <= 0}
                          className="w-9 h-9 flex items-center justify-center hover:bg-zinc-800/80 active:bg-zinc-800 text-zinc-300 hover:text-white rounded-md disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="px-2 font-mono text-xs text-zinc-400 font-bold">{p.stock}</span>
                        <button
                          onClick={() => handleStockChange(p.id, 1)}
                          className="w-9 h-9 flex items-center justify-center hover:bg-zinc-800/80 active:bg-zinc-800 text-zinc-300 hover:text-white rounded-md transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-[#111114] border border-white/[0.08] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#09090b]/80 text-zinc-400 font-semibold border-b border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4">Producto & Lote</th>
                    <th className="py-3 px-4">Categoría & Ubicación</th>
                    <th className="py-3 px-4 text-center">Rotación</th>
                    <th className="py-3 px-4 text-right">Costo (USD)</th>
                    <th className="py-3 px-4 text-right">Precio Venta</th>
                    <th className="py-3 px-4 text-center">Stock / Mínimo</th>
                    <th className="py-3 px-4 text-center">Alerta Automática</th>
                    <th className="py-3 px-4 text-right">Ajuste Rápido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]/80">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-zinc-400">
                        No se encontraron productos coincidentes.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isLowStock = p.stock <= p.minStock;
                      const isHighRot = p.turnoverRate === 'Alta';

                      return (
                        <tr
                          key={p.id}
                          className={`transition-colors border-l-4 ${
                            isLowStock
                              ? 'bg-red-950/30 hover:bg-red-950/50 border-l-red-500 text-red-100'
                              : 'hover:bg-zinc-800/80/40 border-l-transparent'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {p.image ? (
                                <img
                                  src={p.image}
                                  alt={p.name}
                                  className="w-10 h-10 rounded-lg object-cover border border-white/[0.1] shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/[0.1]/70 flex items-center justify-center text-zinc-500 shrink-0">
                                  <Package className="w-4 h-4" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-medium text-white flex items-center gap-2 flex-wrap">
                                  <span>{p.name}</span>
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                    {(p.rating ?? 5).toFixed(1)}
                                  </span>
                                  {isHighRot && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                      <Flame className="w-3 h-3 text-amber-400" />
                                      Alta Rotación
                                    </span>
                                  )}
                                </div>
                                {p.description && (
                                  <div className="text-[11px] text-zinc-400 truncate max-w-xs mt-0.5">
                                    {p.description}
                                  </div>
                                )}
                                <div className="text-xs text-zinc-400 font-mono mt-0.5">
                                  {p.sku} • Lote: {p.batchNumber || 'LT-GEN-01'} • {p.barcode}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-zinc-300">{p.category}</span>
                            <span className="text-zinc-500 block text-xs">
                              {p.location || 'Cava Principal'} • {p.unit}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              p.turnoverRate === 'Alta'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : p.turnoverRate === 'Media'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : 'bg-zinc-900 text-zinc-400'
                            }`}>
                              {p.turnoverRate || 'Media'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-right font-mono text-zinc-400 tabular-nums">
                            ${p.costUSD.toFixed(2)}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <span className="font-mono font-bold text-amber-400 tabular-nums">
                              ${p.priceUSD.toFixed(2)} USD
                            </span>
                            <span className="block text-xs font-mono text-zinc-400 tabular-nums">
                              {(p.priceUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <span
                                className={`font-mono font-bold tabular-nums ${
                                  isLowStock ? 'text-red-400 font-extrabold text-sm' : 'text-white'
                                }`}
                              >
                                {p.stock}
                              </span>
                              <span className="text-xs text-zinc-500">/ min {p.minStock}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center">
                            {isLowStock ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 whitespace-nowrap shadow-sm animate-pulse">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                {p.stock === 0 ? 'Agotado' : isHighRot ? '¡Crítico Alta Rot.!' : 'Bajo Stock'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                Óptimo
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1 bg-[#09090b] p-1 rounded-md border border-white/[0.08]">
                              <button
                                onClick={() => handleStockChange(p.id, -1)}
                                disabled={p.stock <= 0}
                                className="p-1 hover:bg-zinc-800/80 text-zinc-300 hover:text-white rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Restar 1 unidad"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="px-2 font-mono text-xs text-zinc-400">Stock</span>
                              <button
                                onClick={() => handleStockChange(p.id, 1)}
                                className="p-1 hover:bg-zinc-800/80 text-zinc-300 hover:text-white rounded"
                                title="Sumar 1 unidad"
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: AUDITORÍA DE INVENTARIO (Mermas, Desvíos y Control de Rentabilidad)*/}
      {/* ========================================================================= */}
      {activeSubTab === 'audit' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Explanation Banner */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-rose-500/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-white text-base font-display">
                  Auditoría de Inventario & Control de Mermas
                </h3>
                <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold px-2 py-0.5 rounded">
                  Rentabilidad Protegida
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                Monitoreo estricto de roturas en cava o barra, descorches de degustación, vencimientos y desvíos no justificados (robo hormiga) para salvaguardar el margen neto de la taberna.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => exportInventoryAuditPDF(audits, exchangeRate)}
                className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 border border-white/[0.1] transition-colors shadow-sm"
                title="Descargar informe formal de auditoría en PDF"
              >
                <Download className="w-3.5 h-3.5 text-rose-400" />
                <span>Informe PDF</span>
              </button>

              <button
                onClick={() => exportInventoryAuditCSV(audits, exchangeRate)}
                className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 border border-white/[0.1] transition-colors shadow-sm"
                title="Exportar registros a hoja de cálculo Excel / CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Exportar CSV</span>
              </button>

              <button
                onClick={() => setShowAuditModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Registrar Merma / Desvío</span>
              </button>
            </div>
          </div>

          {/* Audit Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-[#111114] border border-rose-500/20 p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">Impacto Financiero Total (USD)</span>
              <div className="text-xl font-bold font-mono text-rose-400 tabular-nums">
                ${totalLossUSD.toFixed(2)} USD
              </div>
              <span className="text-xs text-zinc-500 font-mono tabular-nums">
                ≈ {totalLossBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">Unidades Afectadas</span>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                {totalLossQty} <span className="text-xs font-normal text-zinc-400">unid. dadas de baja</span>
              </div>
              <span className="text-xs text-zinc-500">
                En {audits.length} incidentes auditados
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">Índice de Merma / Almacén</span>
              <div className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                {totalValueUSD > 0 ? ((totalLossUSD / totalValueUSD) * 100).toFixed(2) : '0.00'}%
              </div>
              <span className="text-xs text-zinc-500">
                Límite de tolerancia taberna: &lt; 2.50%
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">Causa Principal de Merma</span>
              <div className="text-base font-bold text-white truncate">
                {audits.length > 0 ? audits[0].type : 'Sin registros'}
              </div>
              <span className="text-xs text-zinc-500">
                Supervisado por administración
              </span>
            </div>
          </div>

          {/* Audit Filters & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar merma por producto, auditor, ubicación o motivo..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full bg-[#111114] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              {(['Todos', 'Merma por Rotura', 'Vencimiento', 'Desvío / Pérdida', 'Degustación / Cortesía'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setAuditFilterType(type)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                    auditFilterType === type
                      ? 'bg-rose-600 text-white font-bold'
                      : 'bg-[#111114] text-zinc-400 hover:text-white border border-white/[0.08]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Audit Log Table */}
          <div className="bg-[#111114] border border-white/[0.08] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-[#09090b]/80 text-zinc-400 font-semibold border-b border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4">Fecha & Boleta</th>
                    <th className="py-3 px-4">Producto & SKU</th>
                    <th className="py-3 px-4">Tipo de Incidencia</th>
                    <th className="py-3 px-4 text-center">Cant.</th>
                    <th className="py-3 px-4 text-right">Pérdida (USD)</th>
                    <th className="py-3 px-4 text-right">Pérdida (Bs.)</th>
                    <th className="py-3 px-4">Ubicación & Auditor</th>
                    <th className="py-3 px-4">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]/80">
                  {filteredAudits.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-zinc-400">
                        No hay registros de mermas o pérdidas con ese criterio.
                      </td>
                    </tr>
                  ) : (
                    filteredAudits.map((a) => (
                      <tr key={a.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-mono text-white text-xs block">{a.date}</span>
                          <span className="text-[10px] font-mono text-zinc-500">#{a.id}</span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="font-medium text-white block">{a.productName}</span>
                          <span className="text-[11px] font-mono text-zinc-400">{a.sku}</span>
                        </td>

                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            a.type === 'Merma por Rotura'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : a.type === 'Desvío / Pérdida'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : a.type === 'Vencimiento'
                              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {a.type}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center font-mono font-bold text-white tabular-nums">
                          {a.quantity}
                        </td>

                        <td className="py-3 px-4 text-right font-mono font-bold text-rose-400 tabular-nums">
                          -${a.totalLossUSD.toFixed(2)}
                        </td>

                        <td className="py-3 px-4 text-right font-mono text-zinc-400 tabular-nums text-xs">
                          -{a.totalLossBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                        </td>

                        <td className="py-3 px-4">
                          <span className="text-zinc-300 block text-xs">{a.location}</span>
                          <span className="text-zinc-500 text-[11px]">{a.auditorName}</span>
                        </td>

                        <td className="py-3 px-4 text-xs text-zinc-400 max-w-xs truncate" title={a.notes}>
                          {a.notes || 'Sin observaciones'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: TRAZABILIDAD DE MERCANCÍA (Lotes, Cadena Proveedor a Consumidor) */}
      {/* ========================================================================= */}
      {activeSubTab === 'traceability' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Explanation Banner */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-950 border border-blue-500/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-base font-display">
                  Trazabilidad de Mercancía: Ciclo de Vida End-to-End
                </h3>
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold px-2 py-0.5 rounded">
                  Cadena Completa
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                Monitoreo exhaustivo desde que la mercancía entra al almacén del distribuidor (Polar, Santa Teresa, DUSA) con su factura de compra y lote, su paso por Cava y Barra, hasta la emisión de la factura fiscal final al cliente en caja.
              </p>
            </div>

            <button
              onClick={() => setShowAddTraceStepModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Registrar Evento de Trazabilidad</span>
            </button>
          </div>

          {/* Traceability Grid: Batch Selector (Left) + Visual Timeline (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Batch Selector */}
            <div className="lg:col-span-5 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar lote, SKU o proveedor..."
                  value={traceSearch}
                  onChange={(e) => setTraceSearch(e.target.value)}
                  className="w-full bg-[#111114] border border-white/[0.08] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {filteredTraces.map((trace) => {
                  const isSelected = trace.id === selectedTraceId;
                  return (
                    <div
                      key={trace.id}
                      onClick={() => setSelectedTraceId(trace.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-950/30 border-blue-500 shadow-md shadow-blue-950/40'
                          : 'bg-[#111114] border-white/[0.08] hover:border-white/[0.1]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-blue-400">
                              {trace.batchNumber}
                            </span>
                            <span className="text-[10px] bg-zinc-900 text-zinc-300 px-1.5 py-0.5 rounded font-mono">
                              {trace.sku}
                            </span>
                          </div>
                          <h4 className="font-bold text-white text-xs sm:text-sm mt-1">
                            {trace.productName}
                          </h4>
                          <span className="text-[11px] text-zinc-400 block mt-0.5">
                            {trace.supplierName}
                          </span>
                        </div>

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          trace.status === 'En Almacén'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : trace.status === 'En Barra'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-zinc-900 text-zinc-400'
                        }`}>
                          {trace.status}
                        </span>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-zinc-400">
                        <span>Entrada: {trace.entryDate.split(' ')[0]}</span>
                        <span className="font-mono text-white">
                          Stock Lote: <strong className="text-amber-400">{trace.currentQuantity}</strong> / {trace.initialQuantity}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Detailed End-to-End Timeline */}
            <div className="lg:col-span-7 bg-[#111114] border border-white/[0.08] rounded-2xl p-4 sm:p-6 space-y-6">
              {currentTrace ? (
                <>
                  {/* Batch Summary Header */}
                  <div className="border-b border-white/[0.08] pb-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-mono text-blue-400 font-bold">
                          LOTE OFICIAL: {currentTrace.batchNumber}
                        </span>
                        <h3 className="font-bold text-white text-base sm:text-lg font-display">
                          {currentTrace.productName}
                        </h3>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                        {currentTrace.steps.length} Hitos Registrados
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                      <div className="bg-[#09090b] p-2 rounded-lg border border-white/[0.08]">
                        <span className="text-zinc-500 block text-[10px]">Distribuidor / Proveedor</span>
                        <span className="font-semibold text-white truncate block">{currentTrace.supplierName}</span>
                      </div>
                      <div className="bg-[#09090b] p-2 rounded-lg border border-white/[0.08]">
                        <span className="text-zinc-500 block text-[10px]">Factura de Compra</span>
                        <span className="font-mono text-amber-400 font-bold">{currentTrace.purchaseInvoiceNumber}</span>
                      </div>
                      <div className="bg-[#09090b] p-2 rounded-lg border border-white/[0.08]">
                        <span className="text-zinc-500 block text-[10px]">Ubicación Actual</span>
                        <span className="text-zinc-200 font-medium">{currentTrace.storageLocation}</span>
                      </div>
                      <div className="bg-[#09090b] p-2 rounded-lg border border-white/[0.08]">
                        <span className="text-zinc-500 block text-[10px]">Vencimiento</span>
                        <span className="font-mono text-zinc-300">{currentTrace.expirationDate || '2030-12-31'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Timeline Stream */}
                  <div>
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      Línea de Tiempo del Lote (Proveedor → Cava → Barra → Factura Final)
                    </h4>

                    <div className="relative border-l-2 border-white/[0.08] ml-4 space-y-6 pl-6 py-2">
                      {currentTrace.steps.map((step, idx) => {
                        let iconBg = 'bg-blue-600 text-white';
                        let badgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';

                        if (step.stage === 'Recepción Proveedor') {
                          iconBg = 'bg-purple-600 text-white';
                          badgeColor = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                        } else if (step.stage === 'Ingreso a Cava') {
                          iconBg = 'bg-cyan-600 text-white';
                          badgeColor = 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
                        } else if (step.stage === 'Traslado a Barra') {
                          iconBg = 'bg-amber-600 text-white';
                          badgeColor = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                        } else if (step.stage === 'Venta al Consumidor') {
                          iconBg = 'bg-emerald-600 text-white';
                          badgeColor = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                        } else if (step.stage === 'Auditoría / Merma') {
                          iconBg = 'bg-rose-600 text-white';
                          badgeColor = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                        }

                        return (
                          <div key={idx} className="relative group">
                            {/* Step Node Dot */}
                            <div className={`absolute -left-[31px] top-1.5 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-md ${iconBg}`}>
                              {idx + 1}
                            </div>

                            <div className="bg-[#09090b] p-3.5 rounded-xl border border-white/[0.08] hover:border-white/[0.1] transition-colors space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                                  {step.stage}
                                </span>
                                <span className="font-mono text-[11px] text-zinc-500">
                                  {step.timestamp}
                                </span>
                              </div>

                              <p className="text-xs text-zinc-200 leading-snug">
                                {step.description}
                              </p>

                              <div className="pt-2 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400">
                                {step.referenceDoc && (
                                  <span className="font-mono text-amber-400/90 font-semibold bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
                                    Doc: {step.referenceDoc}
                                  </span>
                                )}
                                <span>Por: <strong className="text-zinc-300">{step.performedBy}</strong></span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  Selecciona un lote de la izquierda para ver su trazabilidad.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: REGISTRAR MERMA / AUDITORÍA DE INVENTARIO                        */}
      {/* ========================================================================= */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111114] border border-rose-500/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base font-display">Registrar Incidencia de Inventario</h3>
                  <span className="text-xs text-zinc-400">Merma, rotura, vencimiento o desvío no justificado</span>
                </div>
              </div>
              <button onClick={() => setShowAuditModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAudit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Producto Afectado</label>
                <select
                  value={auditProductId}
                  onChange={(e) => setAuditProductId(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white focus:outline-none focus:border-rose-500"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.stock} {p.unit}s • Costo: ${p.costUSD.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Tipo de Incidencia / Causa</label>
                  <select
                    value={auditType}
                    onChange={(e) => setAuditType(e.target.value as InventoryAuditType)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white focus:outline-none focus:border-rose-500 font-semibold text-rose-300"
                  >
                    <option value="Merma por Rotura">Merma por Rotura en Cava/Barra</option>
                    <option value="Vencimiento">Vencimiento / Deterioro</option>
                    <option value="Desvío / Pérdida">Desvío / Pérdida No Justificada</option>
                    <option value="Degustación / Cortesía">Degustación / Cortesía VIP</option>
                    <option value="Ajuste Físico">Ajuste Físico de Arqueo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Cantidad de Unidades</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={auditQty}
                    onChange={(e) => setAuditQty(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              {/* Dynamic Financial Calculation */}
              {(() => {
                const target = products.find((p) => p.id === auditProductId) || products[0];
                const qty = parseInt(auditQty) || 0;
                const costUSD = target ? target.costUSD * qty : 0;
                const costBs = costUSD * exchangeRate;

                return (
                  <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-xl space-y-1 text-xs">
                    <span className="text-zinc-400 block font-medium">Impacto Económico Calculado en Rentabilidad:</span>
                    <div className="flex items-baseline justify-between">
                      <span className="text-rose-400 font-mono font-bold text-base">
                        -${costUSD.toFixed(2)} USD
                      </span>
                      <span className="text-zinc-400 font-mono">
                        ≈ -{costBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Ubicación de la Incidencia</label>
                  <select
                    value={auditLocation}
                    onChange={(e) => setAuditLocation(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                  >
                    <option value="Cava Principal">Cava Principal (Refrigerada)</option>
                    <option value="Barra Central">Barra Central</option>
                    <option value="Barra VIP">Barra VIP / Terraza</option>
                    <option value="Depósito Seco">Depósito Seco</option>
                    <option value="Muelle de Carga">Muelle de Carga</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Auditor / Responsable</label>
                  <input
                    type="text"
                    required
                    value={auditAuditor}
                    onChange={(e) => setAuditAuditor(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Observaciones / Justificación</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Ej: Botella quebrada accidentalmente al mover la caja de estiba..."
                  value={auditNotes}
                  onChange={(e) => setAuditNotes(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="p-3 bg-[#09090b] rounded-xl border border-white/[0.08] flex items-center justify-between">
                <div>
                  <span className="font-bold text-white block">Descontar automáticamente del stock</span>
                  <span className="text-[11px] text-zinc-400">Actualiza el conteo de cava en tiempo real</span>
                </div>
                <input
                  type="checkbox"
                  checked={auditDiscountStock}
                  onChange={(e) => setAuditDiscountStock(e.target.checked)}
                  className="accent-rose-500 w-4 h-4 rounded"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowAuditModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md shadow-rose-600/20"
                >
                  Guardar Incidencia
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: REGISTRAR PASO DE TRAZABILIDAD                                    */}
      {/* ========================================================================= */}
      {showAddTraceStepModal && currentTrace && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111114] border border-blue-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h3 className="font-bold text-white text-base font-display">Nuevo Hito de Trazabilidad</h3>
                <span className="text-xs font-mono text-blue-400">{currentTrace.batchNumber} • {currentTrace.productName}</span>
              </div>
              <button onClick={() => setShowAddTraceStepModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTraceStep} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Etapa de la Cadena</label>
                <select
                  value={newStepStage}
                  onChange={(e) => setNewStepStage(e.target.value as TraceabilityStep['stage'])}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500 font-semibold text-blue-300"
                >
                  <option value="Traslado a Barra">Traslado Interno a Barra de Despacho</option>
                  <option value="Ingreso a Cava">Almacenamiento / Reorganización en Cava</option>
                  <option value="Recepción Proveedor">Recepción de Proveedor / Entrada Inicial</option>
                  <option value="Venta al Consumidor">Venta / Despacho a Consumidor</option>
                  <option value="Auditoría / Merma">Auditoría / Boleta de Merma</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Descripción del Movimiento</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Ej: Pase de 6 botellas de Cava a Barra Central para surtir servicio nocturno..."
                  value={newStepDescription}
                  onChange={(e) => setNewStepDescription(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Documento / Nro. de Referencia (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: Vale Interno #VE-094, Factura Fiscal #FAC-0084..."
                  value={newStepRef}
                  onChange={(e) => setNewStepRef(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Responsable / Operador</label>
                <input
                  type="text"
                  required
                  value={newStepAuditor}
                  onChange={(e) => setNewStepAuditor(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowAddTraceStepModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20"
                >
                  Añadir al Timeline
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: SUGERENCIA DE PEDIDO A DISTRIBUIDORES                           */}
      {/* ========================================================================= */}
      {showPurchaseOrderModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111114] border border-amber-500/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-white text-base font-display">Sugerencia Automática de Pedido</h3>
                  <span className="text-xs text-zinc-400">Productos en o bajo stock mínimo que requieren reposición</span>
                </div>
              </div>
              <button onClick={() => setShowPurchaseOrderModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {reorderList.length === 0 ? (
              <div className="py-8 text-center text-zinc-400 text-xs">
                Todos los productos se encuentran por encima de su stock mínimo de seguridad.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-[#09090b] p-3 rounded-xl border border-white/[0.08] space-y-2 text-xs">
                  <div className="flex justify-between text-zinc-300">
                    <span>Total Ítems a Reponer:</span>
                    <span className="font-bold text-white">{reorderList.length} producto(s)</span>
                  </div>
                  <div className="flex justify-between text-zinc-300">
                    <span>Inversión Estimada en Compra:</span>
                    <span className="font-mono font-bold text-amber-400">${totalReorderEstimateUSD.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-zinc-400">
                    <span>Equivalente en Bolívares:</span>
                    <span className="font-mono">{(totalReorderEstimateUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.</span>
                  </div>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {reorderList.map((p) => {
                    const toOrder = Math.max(1, p.minStock * 2 - p.stock);
                    return (
                      <div key={p.id} className="p-2.5 rounded-lg bg-[#09090b] border border-white/[0.08] flex items-center justify-between text-xs">
                        <div>
                          <div className="font-bold text-white">{p.name}</div>
                          <div className="text-[11px] text-zinc-400 font-mono">
                            Stock Actual: <strong className="text-red-400">{p.stock}</strong> (Mínimo: {p.minStock})
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            Proveedor: {p.supplier || 'Distribuidor Mayorista'}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] text-amber-400 font-bold block">
                            Pedir: {toOrder} {p.unit}s
                          </span>
                          <span className="text-[10px] font-mono text-zinc-400">
                            ≈ ${(toOrder * p.costUSD).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `*ORDEN DE REPOSICIÓN - LA TABERNA LIONS GOLD*\nFecha: ${new Date().toLocaleDateString('es-VE')}\n----------------------------\n` +
                      reorderList.map((p) => `• ${p.name}: Pedir ${Math.max(1, p.minStock * 2 - p.stock)} ${p.unit}s (Stock actual: ${p.stock})`).join('\n') +
                      `\n----------------------------\nEstimado total: $${totalReorderEstimateUSD.toFixed(2)} USD\nSoftware por Smith Bussines Solutions 2026`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 text-xs transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Compartir Pedido por WhatsApp</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: REGISTRAR NUEVO PRODUCTO                                         */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111114] border border-amber-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="font-bold text-white text-lg font-display">Registrar Nuevo Producto</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">Nombre del Producto / Licor</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Ron Añejo Especial (750ml)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Categoría</label>
                  <input
                    type="text"
                    list="inventory-categories-list"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Ej: Licores, Electrónica..."
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                  <datalist id="inventory-categories-list">
                    <option value="Licores" />
                    <option value="Cervezas" />
                    <option value="Vinos" />
                    <option value="Bebidas" />
                    <option value="Snacks" />
                    <option value="General" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Unidad</label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
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
                  <label className="block text-zinc-300 font-medium mb-1">Rotación Comercial</label>
                  <select
                    value={newTurnover}
                    onChange={(e) => setNewTurnover(e.target.value as 'Alta' | 'Media' | 'Baja')}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500 font-semibold"
                  >
                    <option value="Alta">Alta Rotación (Prioridad)</option>
                    <option value="Media">Media Rotación</option>
                    <option value="Baja">Baja Rotación</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Ubicación</label>
                  <select
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value as Product['location'])}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                  >
                    <option value="Cava Principal">Cava Principal</option>
                    <option value="Barra Central">Barra Central</option>
                    <option value="Estantería Premium">Estantería Premium</option>
                    <option value="Depósito Seco">Depósito Seco</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Distribuidor / Proveedor</label>
                <input
                  type="text"
                  placeholder="Ej: Cervecería Polar, Ron Santa Teresa, DUSA..."
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Costo Compra (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCostUSD}
                    onChange={(e) => setNewCostUSD(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Precio Venta (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newPriceUSD}
                    onChange={(e) => setNewPriceUSD(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono"
                  />
                  <span className="text-[10px] text-amber-400 font-mono mt-0.5 block">
                    ≈ {(parseFloat(newPriceUSD || '0') * exchangeRate).toFixed(2)} Bs.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Stock Inicial</label>
                  <input
                    type="number"
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Mínimo Alerta</label>
                  <input
                    type="number"
                    value={newMinStock}
                    onChange={(e) => setNewMinStock(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">SKU (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: RON-1796"
                    value={newSKU}
                    onChange={(e) => setNewSKU(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">Calificación (1 a 5 ★)</label>
                  <select
                    value={newRating}
                    onChange={(e) => setNewRating(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-amber-300 font-mono font-bold"
                  >
                    <option value="5.0">5.0 ★ Excelente</option>
                    <option value="4.5">4.5 ★ Muy bueno</option>
                    <option value="4.0">4.0 ★ Bueno</option>
                    <option value="3.5">3.5 ★ Regular</option>
                    <option value="3.0">3.0 ★ Estándar</option>
                    <option value="2.0">2.0 ★ Bajo</option>
                    <option value="1.0">1.0 ★ Crítico</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Foto del Producto (Subir o pegar URL)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="https://... o sube una foto"
                    value={newImage}
                    onChange={(e) => setNewImage(e.target.value)}
                    className="flex-1 bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                  <label className="px-3 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-white/[0.1] font-semibold cursor-pointer shrink-0 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingImage ? '...' : 'Subir'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleNewProductImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                {newImage && (
                  <div className="mt-2 flex items-center gap-2">
                    <img
                      src={newImage}
                      alt="Vista previa"
                      className="w-12 h-12 rounded-lg object-cover border border-white/[0.1]"
                    />
                    <button
                      type="button"
                      onClick={() => setNewImage('')}
                      className="text-[11px] text-rose-400 hover:underline"
                    >
                      Quitar foto
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">Descripción Breve (Opcional)</label>
                <textarea
                  rows={2}
                  placeholder="Detalles del producto, presentación o notas para catálogo..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold"
                >
                  Guardar en Almacén
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Alert Configuration Modal */}
      <EmailAlertConfigModal
        isOpen={showEmailConfig}
        onClose={() => setShowEmailConfig(false)}
        config={emailConfig}
        onSaveConfig={handleSaveEmailConfig}
        products={products}
        exchangeRate={exchangeRate}
        emailLogs={emailLogs}
        onTriggerTestEmail={handleTriggerTestEmail}
        onClearLogs={handleClearLogs}
      />

      {/* Floating Simulated Email Notification Toast */}
      {emailToast && (
        <div 
          className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 max-w-sm sm:max-w-md bg-[#111114] border border-amber-500/50 p-4 rounded-2xl shadow-2xl shadow-black/80 flex items-start gap-3 animate-in slide-in-from-bottom duration-300 backdrop-blur-md"
          role="status"
          aria-live="polite"
        >
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 mt-0.5">
            <Mail className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm font-display">Alerta de Correo Enviada</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                Simulación
              </span>
            </div>
            <p className="mt-1 text-zinc-300 leading-snug">{emailToast.message}</p>
            <div className="mt-2.5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowEmailConfig(true);
                  setEmailToast(null);
                }}
                className="text-amber-400 hover:text-amber-300 font-bold text-xs flex items-center gap-1 hover:underline min-h-[36px]"
              >
                <span>Ver Registro & Maqueta</span>
                <span>→</span>
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEmailToast(null)}
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800/80 transition-colors"
            title="Cerrar notificación"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
