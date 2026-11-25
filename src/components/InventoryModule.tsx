import React, { useEffect, useState } from 'react';
import {
  Product,
  Sale,
  EmailAlertConfig,
  StockAlertEmailLog,
  InventoryAuditLog,
  InventoryAuditType,
  ProductBatchTrace,
  TraceabilityStep,
  StoreProduct,
  StoreTenant,
} from '../types';
import {
  getCaracasDateTimeStamp,
  VENEZUELA_LOCALE,
  VENEZUELA_TIMEZONE,
} from '../utils/venezuelaTime';
import {
  Package,
  Search,
  Plus,
  Minus,
  AlertTriangle,
  Check,
  X,
  Camera,
  Mail,
  ShieldAlert,
  Truck,
  Clock,
  Download,
  Share2,
  Flame,
  FileSpreadsheet,
  CheckCircle2,
  ShoppingCart,
  Upload,
  Star,
  Image as ImageIcon,
  Store,
  RefreshCw,
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
  dispatchStoreEmail,
  getLocalStoreEmailConfig,
  getStoreEmailLogs,
  clearStoreEmailLogs,
} from '../services/emailDeliveryService';
import {
  exportInventoryAuditCSV,
  exportInventoryAuditPDF,
} from '../utils/seniatExport';
import {
  exportInventoryCatalogCSV,
  exportInventoryCatalogJSON,
  downloadInventoryCSVTemplate,
  parseInventoryImportFile,
} from '../utils/inventoryCatalogIO';
import { compressImageFileToDataURL } from '../services/saasService';
import { useSubsectionTranslation } from './LanguageSettings';
import { SizeTagBuilder } from './SizeTagBuilder';
import { normalizeSizeList } from '../utils/clothingSizes';
import { translateCategoryLabel } from '../utils/categoryI18n';
import {
  translateAuditTypeLabel,
  translateSizeTokenLabel,
  translateTraceStageLabel,
  translateTraceStatusLabel,
  translateTurnoverRateLabel,
  translateUnitLabel,
  translateWarehouseLocationLabel,
} from '../utils/platformLabelsI18n';

interface InventoryModuleProps {
  products: Product[];
  onUpdateProductStock: (id: string, delta: number) => void;
  onAddProduct: (product: Omit<Product, 'id'>, publishToStore?: boolean) => void;
  onImportProducts?: (
    products: Omit<Product, 'id'>[],
    mergeBySku?: boolean,
    publishToStore?: boolean
  ) => void;
  exchangeRate: number;
  onOpenScanner?: () => void;
  sales?: Sale[];
  activeStore?: StoreTenant | null;
  storefrontProducts?: StoreProduct[];
  audits?: InventoryAuditLog[];
  traces?: ProductBatchTrace[];
  onAuditsChange?: (audits: InventoryAuditLog[]) => void;
  onTracesChange?: (traces: ProductBatchTrace[]) => void;
  onPublishProductToStore?: (product: Product) => Promise<void>;
  onSyncAllToStore?: () => Promise<void>;
  isSyncingToStore?: boolean;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  products,
  onUpdateProductStock,
  onAddProduct,
  onImportProducts,
  exchangeRate,
  onOpenScanner,
  sales = [],
  activeStore,
  storefrontProducts = [],
  audits: controlledAudits,
  traces: controlledTraces,
  onAuditsChange,
  onTracesChange,
  onPublishProductToStore,
  onSyncAllToStore,
  isSyncingToStore = false,
}) => {
  const { lang, tr } = useSubsectionTranslation('warehouse');
  // Main Sub-Tab: 'catalog' | 'audit' | 'traceability'
  const [activeSubTab, setActiveSubTab] = useState<'catalog' | 'audit' | 'traceability'>('catalog');

  // Search & Catalog Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [filterMode, setFilterMode] = useState<'all' | 'alerts_only' | 'high_rotation_risk'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const [showPurchaseOrderModal, setShowPurchaseOrderModal] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Email Alert state & persistence
  const currentStoreId = activeStore?.id || 'default-warehouse';
  const [emailConfig, setEmailConfig] = useState<EmailAlertConfig>(getStoredEmailConfig);
  const [emailLogs, setEmailLogs] = useState<StockAlertEmailLog[]>(() =>
    getStoreEmailLogs(currentStoreId)
  );
  const [emailToast, setEmailToast] = useState<{ message: string; logId: string } | null>(null);

  useEffect(() => {
    setEmailLogs(getStoreEmailLogs(currentStoreId));
    const storeCfg = getLocalStoreEmailConfig(currentStoreId, activeStore?.ownerUid || '');
    if (storeCfg.recipientEmail) {
      setEmailConfig({
        recipientEmail: storeCfg.recipientEmail,
        secondaryEmail: storeCfg.secondaryEmail || undefined,
        isEnabled: storeCfg.isEnabled,
        frequency: storeCfg.alertFrequency,
        notifyOnPOS: storeCfg.notifyOnPOS,
        notifyOnManualAdjustment: storeCfg.notifyOnManualAdjustment,
      });
    }
  }, [currentStoreId, activeStore?.ownerUid]);

  // New product form state (neutral per-store defaults)
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<string>('General');
  const [newSKU, setNewSKU] = useState('');
  const [newStock, setNewStock] = useState('10');
  const [newMinStock, setNewMinStock] = useState('2');
  const [newCostUSD, setNewCostUSD] = useState('0.00');
  const [newPriceUSD, setNewPriceUSD] = useState('0.00');
  const [newUnit, setNewUnit] = useState('Unidad');
  const [newTurnover, setNewTurnover] = useState<'Alta' | 'Media' | 'Baja'>('Media');
  const [newLocation, setNewLocation] = useState<Product['location']>('Depósito Principal');
  const [newSupplier, setNewSupplier] = useState('');
  const [newImage, setNewImage] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newRating, setNewRating] = useState('5.0');
  const [newSizes, setNewSizes] = useState<string[]>([]);
  const [newSizeGuide, setNewSizeGuide] = useState('');
  const [publishToStoreOnAdd, setPublishToStoreOnAdd] = useState(true);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Bulk Export / Import state
  const [importPreview, setImportPreview] = useState<Omit<Product, 'id'>[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importMergeBySku, setImportMergeBySku] = useState(true);
  const [publishToStoreOnImport, setPublishToStoreOnImport] = useState(true);
  const [importFeedback, setImportFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- 2. AUDIT STATE (Mermas, Desvíos, Pérdidas - strictly per store, empty by default) ---
  const [internalAudits, setInternalAudits] = useState<InventoryAuditLog[]>([]);
  const audits = controlledAudits ?? internalAudits;
  const updateAudits = (next: InventoryAuditLog[]) => {
    setInternalAudits(next);
    onAuditsChange?.(next);
  };

  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditProductId, setAuditProductId] = useState(products[0]?.id || '');
  const [auditType, setAuditType] = useState<InventoryAuditType>('Merma por Rotura');
  const [auditQty, setAuditQty] = useState('1');
  const [auditLocation, setAuditLocation] = useState('Depósito Principal');
  const [auditAuditor, setAuditAuditor] = useState(
    activeStore?.registeredOwnerName || ''
  );
  const [auditNotes, setAuditNotes] = useState('');
  const [auditDiscountStock, setAuditDiscountStock] = useState(true);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilterType, setAuditFilterType] = useState<string>('Todos');

  // --- 3. TRACEABILITY STATE (End-to-End Tracking - strictly per store, empty by default) ---
  const [internalTraces, setInternalTraces] = useState<ProductBatchTrace[]>([]);
  const traces = controlledTraces ?? internalTraces;
  const updateTraces = (next: ProductBatchTrace[]) => {
    setInternalTraces(next);
    onTracesChange?.(next);
  };

  const [selectedTraceId, setSelectedTraceId] = useState<string>('');
  const [traceSearch, setTraceSearch] = useState('');
  const [showAddTraceStepModal, setShowAddTraceStepModal] = useState(false);
  const [newStepStage, setNewStepStage] = useState<TraceabilityStep['stage']>('Traslado a Barra');
  const [newStepDescription, setNewStepDescription] = useState('');
  const [newStepRef, setNewStepRef] = useState('');
  const [newStepAuditor, setNewStepAuditor] = useState(
    activeStore?.registeredOwnerName || ''
  );

  const isProductSyncedToStore = (prod: Product) => {
    if (prod.storefrontProductId) {
      return storefrontProducts.length === 0 || storefrontProducts.some((sp) => sp.id === prod.storefrontProductId);
    }
    const cleanSku = prod.sku?.trim().toLowerCase();
    return Boolean(
      cleanSku &&
        storefrontProducts.some(
          (sp) => sp.sku && sp.sku.trim().toLowerCase() === cleanSku
        )
    );
  };

  const syncedProductsCount = products.filter((p) => isProductSyncedToStore(p)).length;

  const productCategories = products
    .map((p) => p.category)
    .filter((c) => Boolean(c && c.trim()));
  const categories = [
    'Todos',
    ...Array.from(
      new Set(
        productCategories.length > 0
          ? productCategories
          : ['General']
      )
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

  // Stock change handler with real SMTP/Resend dispatch (or simulated fallback)
  const handleStockChange = (id: string, delta: number) => {
    if (delta < 0) {
      const prod = products.find((p) => p.id === id);
      if (prod) {
        const willBeLow = prod.stock + delta <= prod.minStock;
        const wasAbove = prod.stock > prod.minStock;
        if (willBeLow && wasAbove) {
          const simulatedProd = { ...prod, stock: Math.max(0, prod.stock + delta) };
          const storeCfg = getLocalStoreEmailConfig(currentStoreId, activeStore?.ownerUid || '');
          const hasRealProvider =
            storeCfg.isEnabled &&
            storeCfg.alertOnCriticalStock &&
            storeCfg.notifyOnManualAdjustment &&
            ((storeCfg.provider === 'resend' && Boolean(storeCfg.resendApiKey)) ||
              (storeCfg.provider === 'smtp' && Boolean(storeCfg.smtpHost && storeCfg.smtpPass)));

          if (hasRealProvider) {
            dispatchStoreEmail({
              action: 'stock_alert',
              storeId: currentStoreId,
              storeName: activeStore?.storeName || tr('Almacén & POS', 'Warehouse & POS', '仓库与 POS'),
              exchangeRate,
              config: storeCfg,
              triggerEvent: tr('Ajuste manual de stock en Almacén', 'Manual stock adjustment in Warehouse', '仓库手动库存调整'),
              products: [simulatedProd],
            })
              .then((res) => {
                setEmailLogs(getStoreEmailLogs(currentStoreId));
                setEmailToast({
                  message: res.ok
                    ? tr(
                        `Alerta enviada (${storeCfg.provider.toUpperCase()}) a ${storeCfg.recipientEmail}: "${prod.name}" (${simulatedProd.stock}/${prod.minStock}).`,
                        `Alert sent (${storeCfg.provider.toUpperCase()}) to ${storeCfg.recipientEmail}: "${prod.name}" (${simulatedProd.stock}/${prod.minStock}).`,
                        `预警已发送（${storeCfg.provider.toUpperCase()}）至 ${storeCfg.recipientEmail}："${prod.name}"（${simulatedProd.stock}/${prod.minStock}）。`
                      )
                    : tr(
                        `Error enviando alerta a ${storeCfg.recipientEmail}: ${res.message}`,
                        `Error sending alert to ${storeCfg.recipientEmail}: ${res.message}`,
                        `发送预警至 ${storeCfg.recipientEmail} 失败：${res.message}`
                      ),
                  logId: res.log.id,
                });
                setTimeout(() => setEmailToast(null), 6500);
              })
              .catch(() => {});
          } else if (emailConfig.isEnabled && emailConfig.notifyOnManualAdjustment) {
            const log = recordSimulatedEmailDispatch(
              [simulatedProd],
              tr('Ajuste manual de stock en Almacén (-1 unidad)', 'Manual stock adjustment in Warehouse (-1 unit)', '仓库手动库存调整（-1 单位）'),
              emailConfig
            );
            setEmailLogs(getStoredEmailLogs());
            setEmailToast({
              message: tr(
                `Alerta registrada para ${emailConfig.recipientEmail}: "${prod.name}" alcanzó nivel crítico (${simulatedProd.stock} / ${prod.minStock} mín.)`,
                `Alert logged for ${emailConfig.recipientEmail}: "${prod.name}" reached critical level (${simulatedProd.stock} / ${prod.minStock} min)`,
                `已为 ${emailConfig.recipientEmail} 记录预警："${prod.name}" 达到临界库存（${simulatedProd.stock} / 最低 ${prod.minStock}）`
              ),
              logId: log.id,
            });
            setTimeout(() => setEmailToast(null), 6000);
          }
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

    onAddProduct(
      {
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
        supplier: newSupplier.trim() || undefined,
        availableSizes: normalizeSizeList(newSizes).length > 0 ? normalizeSizeList(newSizes) : undefined,
        sizeGuide: newSizeGuide.trim() || undefined,
        batchNumber: `LT-${cleanCategory.substring(0, 3).toUpperCase()}-${new Date().getFullYear()}-${Math.floor(10 + Math.random() * 90)}`,
        expirationDate: '2028-12-31',
      },
      Boolean(activeStore && publishToStoreOnAdd)
    );

    setNewName('');
    setNewSKU('');
    setNewImage('');
    setNewDescription('');
    setNewRating('5.0');
    setNewSizes([]);
    setNewSizeGuide('');
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
        text: tr(
          'No se pudo procesar la imagen seleccionada. Prueba con otra foto o pega una URL.',
          'Could not process the selected image. Try another photo or paste a URL.',
          '无法处理所选图片。请尝试其他照片或粘贴链接。'
        ),
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
          text: tr(
            'El archivo no contiene productos válidos. Verifica las columnas (nombre, precioUSD, stock, calificacion, foto).',
            'The file contains no valid products. Check columns (name, precioUSD, stock, rating, photo).',
            '文件不包含有效商品。请检查列（nombre, precioUSD, stock, calificacion, foto）。'
          ),
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
        text: tr(
          'Error al leer el archivo. Asegúrate de subir un CSV o JSON con formato válido.',
          'Error reading file. Make sure to upload a valid CSV or JSON file.',
          '读取文件失败。请确保上传格式正确的 CSV 或 JSON 文件。'
        ),
      });
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmImport = () => {
    if (importPreview.length === 0) return;
    const shouldPublish = Boolean(activeStore && publishToStoreOnImport);
    if (onImportProducts) {
      onImportProducts(importPreview, importMergeBySku, shouldPublish);
    } else {
      importPreview.forEach((item) => onAddProduct(item, shouldPublish));
    }
    setImportFeedback({
      type: 'success',
      text: tr(
        `Catálogo actualizado: se importaron ${importPreview.length} producto(s) desde ${importFileName}${shouldPublish ? ' y se sincronizaron con tu Tienda Online' : ''}.`,
        `Catalog updated: imported ${importPreview.length} product(s) from ${importFileName}${shouldPublish ? ' and synced to your Online Store' : ''}.`,
        `目录已更新：从 ${importFileName} 导入了 ${importPreview.length} 件商品${shouldPublish ? '并已同步到您的在线商店' : ''}。`
      ),
    });
    setImportPreview([]);
    setImportFileName('');
  };

  const handlePublishSingleProduct = async (prod: Product) => {
    if (!onPublishProductToStore) return;
    setPublishingId(prod.id);
    setSyncMessage(null);
    try {
      await onPublishProductToStore(prod);
      setSyncMessage({
        type: 'success',
        text: tr(
          `"${prod.name}" sincronizado con la Tienda Online (${activeStore?.storeName || 'Tienda'}).`,
          `"${prod.name}" synced with Online Store (${activeStore?.storeName || 'Store'}).`,
          `"${prod.name}" 已同步至在线商店（${activeStore?.storeName || '商店'}）。`
        ),
      });
    } catch (err) {
      setSyncMessage({
        type: 'error',
        text: err instanceof Error ? err.message : tr('No se pudo publicar en la tienda.', 'Could not publish to store.', '无法发布到商店。'),
      });
    } finally {
      setPublishingId(null);
    }
  };

  const handleSyncAllProducts = async () => {
    if (!onSyncAllToStore) return;
    setSyncMessage(null);
    try {
      await onSyncAllToStore();
      setSyncMessage({
        type: 'success',
        text: tr(
          `Todo el inventario (${products.length} producto(s)) fue sincronizado con "${activeStore?.storeName || 'tu Tienda Online'}".`,
          `Full inventory (${products.length} product(s)) synced with "${activeStore?.storeName || 'your Online Store'}".`,
          `全部库存（${products.length} 件商品）已同步至 "${activeStore?.storeName || '您的在线商店'}"。`
        ),
      });
    } catch (err) {
      setSyncMessage({
        type: 'error',
        text: err instanceof Error ? err.message : tr('Error sincronizando productos con la tienda.', 'Error syncing products with the store.', '与商店同步商品失败。'),
      });
    }
  };

  // Register New Audit Incident (Merma / Desvío)
  const handleCreateAudit = (e: React.FormEvent) => {
    e.preventDefault();
    const targetProd = products.find((p) => p.id === auditProductId) || products[0];
    if (!targetProd) return;

    const qty = Math.max(1, parseInt(auditQty) || 1);
    const lossUSD = Number((qty * targetProd.costUSD).toFixed(2));
    const lossBs = Number((lossUSD * exchangeRate).toFixed(2));
    const now = getCaracasDateTimeStamp();

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
      auditorName: auditAuditor.trim() || tr('Auditoría de Almacén', 'Warehouse Audit', '仓库审计'),
      location: auditLocation,
      notes: auditNotes.trim() || tr(`Registro de ${auditType} en ${auditLocation}`, `${auditType} record in ${auditLocation}`, `${auditLocation} 的 ${auditType} 记录`),
    };

    const updated = [newAudit, ...audits];
    updateAudits(updated);

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
                description: `${auditType}: ${qty} ${tr('unid.', 'units', '件')} (${auditNotes || tr('Sin notas', 'No notes', '无备注')})`,
                referenceDoc: `${tr('Boleta', 'Slip', '单据')} #${newAudit.id}`,
                performedBy: auditAuditor,
              },
            ],
          };
        }
        return t;
      });
      updateTraces(updatedTraces);
    }

    setAuditNotes('');
    setShowAuditModal(false);
  };

  // Add Step to Traceability
  const handleAddTraceStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTrace || !newStepDescription.trim()) return;

    const now = getCaracasDateTimeStamp();
    const newStep: TraceabilityStep = {
      stage: newStepStage,
      timestamp: now,
      description: newStepDescription.trim(),
      referenceDoc: newStepRef.trim() || undefined,
      performedBy: newStepAuditor.trim() || tr('Responsable de Almacén', 'Warehouse Manager', '仓库负责人'),
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

    updateTraces(updated);
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
    const targetProducts =
      lowStock.length > 0 ? lowStock : products.length > 0 ? [products[0]] : [];
    if (targetProducts.length === 0) {
      setEmailToast({
        message: tr(
          'Añade al menos un producto a tu almacén para probar las alertas de stock crítico.',
          'Add at least one product to your warehouse to test critical stock alerts.',
          '请至少向仓库添加一件商品以测试临界库存预警。'
        ),
        logId: 'empty',
      });
      setTimeout(() => setEmailToast(null), 5000);
      return;
    }
    const log = recordSimulatedEmailDispatch(
      targetProducts,
      tr('Prueba manual desde Configuración de Alertas', 'Manual test from Alert Settings', '从预警设置手动测试'),
      emailConfig,
      customEmail
    );
    setEmailLogs(getStoredEmailLogs());
    setEmailToast({
      message: tr(
        `Alerta de prueba enviada con éxito a ${customEmail || emailConfig.recipientEmail} (${targetProducts.length} producto(s) en stock crítico).`,
        `Test alert sent successfully to ${customEmail || emailConfig.recipientEmail} (${targetProducts.length} product(s) in critical stock).`,
        `测试预警已成功发送至 ${customEmail || emailConfig.recipientEmail}（${targetProducts.length} 件商品库存不足）。`
      ),
      logId: log.id,
    });
    setTimeout(() => setEmailToast(null), 6000);
  };

  const handleClearLogs = () => {
    saveStoredEmailLogs([]);
    clearStoreEmailLogs(currentStoreId);
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
            <span>{tr('Catálogo & Alertas', 'Catalog & Alerts', '目录与预警')}</span>
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
            <span>{tr('Auditoría & Mermas', 'Audits & Shrinkage', '审计与损耗')}</span>
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
            <span>{tr('Trazabilidad de Mercancía', 'Goods Traceability', '货物追溯')}</span>
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
              title={tr('Generar sugerencia de pedido para reposición', 'Generate restock order suggestion', '生成补货采购建议')}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>{tr('Sugerencia de Pedido', 'Order Suggestion', '补货建议')} ({reorderList.length})</span>
            </button>
          )}

          {activeSubTab === 'audit' && (
            <button
              onClick={() => setShowAuditModal(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-rose-600 to-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-rose-600/20 hover:from-rose-500 hover:to-rose-400 transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>{tr('Registrar Merma / Desvío', 'Log Shrinkage / Loss', '登记损耗 / 异常')}</span>
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
              <span className="text-xs text-zinc-400 block mb-1">{tr('Valoración en Almacén', 'Warehouse Valuation', '仓库估值')}</span>
              <div className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                ${totalValueUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
              </div>
              <span className="text-xs text-zinc-500 font-mono tabular-nums">
                ≈ {(totalValueUSD * exchangeRate).toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">{tr('Unidades en Cava & Barra', 'Units in Stock & Floor', '库存与陈列单位')}</span>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                {totalStockItems} <span className="text-xs font-normal text-zinc-400">{tr('unidades', 'units', '件')}</span>
              </div>
              <span className="text-xs text-zinc-500 font-mono">
                {products.length} {tr('productos registrados', 'registered products', '件已登记商品')}
              </span>
            </div>

            <div 
              onClick={() => setFilterMode(filterMode === 'high_rotation_risk' ? 'all' : 'high_rotation_risk')}
              className={`border p-4 rounded-xl cursor-pointer transition-all ${
                filterMode === 'high_rotation_risk'
                  ? 'bg-amber-950/40 border-amber-500 shadow-md shadow-amber-950/40' 
                  : 'bg-[#111114] border-white/[0.08] hover:border-amber-500/30'
              }`}
              title={tr('Filtrar productos de alta rotación en riesgo de agotarse', 'Filter high-turnover products at risk of stockout', '筛选即将断货的高周转商品')}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-amber-300 font-semibold flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  {tr('Alta Rotación en Riesgo', 'High Turnover at Risk', '高周转缺货风险')}
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded">
                  {tr('Prioridad', 'Priority', '优先')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xl font-bold font-mono tabular-nums ${highRotationRiskCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {highRotationRiskCount}
                </span>
                <span className="text-xs text-zinc-400">{tr('ítems calientes críticos', 'critical hot items', '项热门紧缺品')}</span>
              </div>
              <span className="text-xs text-zinc-500">
                {highRotationRiskCount > 0 ? tr('Productos líderes por agotarse', 'Top-selling items running low', '主打商品即将售罄') : tr('Rotación rápida abastecida', 'Fast turnover stocked', '高周转库存充足')}
              </span>
            </div>

            <div 
              onClick={() => setFilterMode(filterMode === 'alerts_only' ? 'all' : 'alerts_only')}
              className={`border p-4 rounded-xl cursor-pointer transition-all ${
                filterMode === 'alerts_only' 
                  ? 'bg-red-950/40 border-red-500 shadow-md shadow-red-950/40' 
                  : 'bg-[#111114] border-white/[0.08] hover:border-white/[0.1]'
              }`}
              title={tr('Haz clic para filtrar solo productos con stock bajo o crítico', 'Click to filter only low or critical stock products', '点击仅筛选低库存或紧缺商品')}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-400 block">{tr('Alertas de Reposición', 'Restock Alerts', '补货预警')}</span>
                {filterMode === 'alerts_only' && (
                  <span className="text-[10px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded">
                    {tr('Filtrado', 'Filtered', '已筛选')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xl font-bold font-mono tabular-nums ${lowStockCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {lowStockCount}
                </span>
                <span className="text-xs text-zinc-400">{tr('ítems bajo mínimo', 'items below min', '项低于安全库存')}</span>
              </div>
              <span className="text-xs text-zinc-500">
                {lowStockCount > 0 ? tr('Requieren orden de compra inmediata', 'Require immediate purchase order', '需要立即采购补货') : tr('Stock en niveles óptimos', 'Stock at optimal levels', '库存处于最佳水平')}
              </span>
            </div>
          </div>

          {/* Storefront Sync Header Banner (Almacén -> Tienda Online) */}
          {activeStore && (
            <div className="bg-gradient-to-r from-[#111114] via-[#111114] to-amber-950/20 border border-amber-500/30 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-white font-display">
                      {tr('Almacén Individual', 'Store Warehouse', '独立仓库')} · {activeStore.storeName}
                    </h3>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                      {syncedProductsCount} / {products.length} {tr('publicados en Tienda', 'published to Store', '已发布至商店')}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {products.length === 0
                      ? tr(
                          'Tu almacén inicia vacío. Registra aquí tus productos manualmente o importa un CSV/JSON para abastecer tu Tienda Online.',
                          'Your warehouse starts empty. Register products manually here or import a CSV/JSON to stock your Online Store.',
                          '您的仓库初始为空。请在此手动登记商品或导入 CSV/JSON 以供应您的在线商店。'
                        )
                      : tr(
                          'Añade productos desde tu almacén y sincronízalos directo al catálogo de tu tienda con stock vinculado.',
                          'Add products from your warehouse and sync them directly to your store catalog with linked stock.',
                          '从仓库添加商品并直接同步至您的商店目录，实时关联库存。'
                        )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {onSyncAllToStore && products.length > 0 && (
                  <button
                    type="button"
                    disabled={isSyncingToStore}
                    onClick={handleSyncAllProducts}
                    className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingToStore ? 'animate-spin' : ''}`} />
                    <span>{isSyncingToStore ? tr('Sincronizando...', 'Syncing...', '正在同步...') : tr('Sincronizar Todo a Tienda', 'Sync All to Store', '全部同步至商店')}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>{tr('Agregar Producto', 'Add Product', '添加商品')}</span>
                </button>
              </div>
            </div>
          )}

          {syncMessage && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                syncMessage.type === 'success'
                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                  : 'bg-rose-950/50 border-rose-500/40 text-rose-200'
              }`}
            >
              <span>{syncMessage.text}</span>
              <button
                type="button"
                onClick={() => setSyncMessage(null)}
                className="p-1 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Email Alert Banner */}
          <div className="bg-[#111114] border border-white/[0.08] hover:border-amber-500/30 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs transition-colors">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Mail className="w-4 h-4" />
              </div>
              <span className="text-zinc-400">{tr('Notificaciones de Stock Crítico:', 'Critical Stock Notifications:', '临界库存通知：')}</span>
              <span className="font-mono font-bold text-white truncate max-w-[200px] sm:max-w-none">
                {emailConfig.recipientEmail}
              </span>
              {emailConfig.isEnabled ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {tr('Activo', 'Active', '已启用')}
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-900 text-zinc-400 border border-white/[0.1]">
                  {tr('Pausado', 'Paused', '已暂停')}
                </span>
              )}
            </div>

            <button
              onClick={() => setShowEmailConfig(true)}
              className="text-amber-400 hover:text-amber-300 font-bold text-xs flex items-center gap-1.5 bg-[#09090b]/80 hover:bg-zinc-800/80 border border-white/[0.08] hover:border-amber-500/30 px-3 py-1.5 rounded-lg transition-colors min-h-[38px]"
            >
              <span>{tr('Configurar / Probar Envío', 'Configure / Test Email', '配置 / 测试发送')}</span>
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
                  placeholder={tr('Buscar por producto, marca, lote, SKU o código de barras...', 'Search by product, brand, batch, SKU or barcode...', '按商品、品牌、批次、SKU 或条形码搜索...')}
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
                  title={tr('Abrir lector de código de barras con la cámara', 'Open camera barcode scanner', '打开摄像头条码扫描器')}
                >
                  <Camera className="w-4 h-4" />
                  <span className="text-xs font-bold hidden sm:inline">{tr('Escanear', 'Scan', '扫码')}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowEmailConfig(true)}
                className="px-3.5 py-2.5 bg-zinc-900 hover:bg-zinc-800/80 text-zinc-200 border border-white/[0.1] rounded-lg flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold transition-all min-h-[44px]"
              >
                <Mail className="w-4 h-4 text-amber-400" />
                <span className="hidden sm:inline">{tr('Alertas Email', 'Email Alerts', '邮件预警')}</span>
              </button>

              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs sm:text-sm rounded-lg flex items-center justify-center gap-2 shadow-sm transition-colors whitespace-nowrap min-h-[44px]"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>{tr('Nuevo Producto', 'New Product', '新建商品')}</span>
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
                    {tr(
                      'Exportar e Importar Catálogo (Fotos, Tallas, Precios y Stock)',
                      'Export & Import Catalog (Photos, Sizes, Prices & Stock)',
                      '导出与导入目录（图片、尺码、价格与库存）'
                    )}
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    {tr(
                      'Respalda tu inventario en CSV/JSON o carga productos masivamente por SKU.',
                      'Back up your inventory in CSV/JSON or bulk upload products by SKU.',
                      '将库存备份为 CSV/JSON，或按 SKU 批量导入商品。'
                    )}
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
                  <span>{tr('Plantilla CSV', 'CSV Template', 'CSV 模板')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportInventoryCatalogCSV(products)}
                  disabled={products.length === 0}
                  className="px-3 py-2 rounded-lg bg-[#09090b] hover:bg-zinc-800/80 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{tr('Exportar CSV', 'Export CSV', '导出 CSV')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportInventoryCatalogJSON(products)}
                  disabled={products.length === 0}
                  className="px-3 py-2 rounded-lg bg-[#09090b] hover:bg-zinc-800/80 text-emerald-300 border border-emerald-500/30 font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{tr('Exportar JSON', 'Export JSON', '导出 JSON')}</span>
                </button>

                <label className="px-3.5 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 font-bold flex items-center gap-1.5 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{tr('Importar Masivo CSV/JSON', 'Bulk Import CSV/JSON', '批量导入 CSV/JSON')}</span>
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
                  aria-label={tr('Cerrar mensaje', 'Close message', '关闭提示')}
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
                      {tr(
                        `Vista previa de importación: ${importPreview.length} producto(s) listos`,
                        `Import preview: ${importPreview.length} product(s) ready`,
                        `导入预览：${importPreview.length} 件商品已就绪`
                      )}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-400">
                      {tr('Archivo:', 'File:', '文件：')} {importFileName}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={importMergeBySku}
                        onChange={(e) => setImportMergeBySku(e.target.checked)}
                        className="accent-amber-500 w-4 h-4 rounded"
                      />
                      <span>{tr('Actualizar si coincide SKU', 'Update on SKU match', 'SKU 匹配时更新')}</span>
                    </label>
                    {activeStore && (
                      <label className="flex items-center gap-2 text-xs text-emerald-300 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={publishToStoreOnImport}
                          onChange={(e) => setPublishToStoreOnImport(e.target.checked)}
                          className="accent-emerald-500 w-4 h-4 rounded"
                        />
                        <span>{tr('Publicar también en Tienda Online', 'Also publish to Online Store', '同时发布到在线商店')}</span>
                      </label>
                    )}
                  </div>
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
                          <span>{tr('Stock:', 'Stock:', '库存:')} {item.stock}</span>
                          {item.availableSizes && item.availableSizes.length > 0 && (
                            <span className="text-amber-300">[{item.availableSizes.join('/')}]</span>
                          )}
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
                    {tr(
                      `... y ${importPreview.length - 6} producto(s) adicionales listos para importar.`,
                      `... and ${importPreview.length - 6} additional product(s) ready to import.`,
                      `... 以及另外 ${importPreview.length - 6} 件待导入商品。`
                    )}
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
                    {tr('Cancelar', 'Cancel', '取消')}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>
                      {tr('Confirmar Importación', 'Confirm Import', '确认导入')} ({importPreview.length})
                    </span>
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
                  {cat === 'Todos' ? tr('Todos', 'All', '全部') : translateCategoryLabel(cat, lang)}
                </button>
              ))}
            </div>

            {/* Rotation / Alert Presets */}
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                  filterMode === 'all'
                    ? 'bg-zinc-900 text-white font-bold border border-white/[0.1]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {tr('Todos', 'All', '全部')} ({products.length})
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
                <span>
                  {tr('Alta Rotación Crítica', 'Critical Fast-Moving', '高周转告急')} ({highRotationRiskCount})
                </span>
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
                <span>
                  {tr('Bajo Stock', 'Low Stock', '低库存')} ({lowStockCount})
                </span>
              </button>
            </div>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden space-y-3">
            {filteredProducts.length === 0 ? (
              <div className="py-8 text-center text-zinc-400 text-xs bg-[#111114] rounded-xl border border-white/[0.08]">
                {tr('No se encontraron productos con el filtro seleccionado.', 'No products found matching the selected filter.', '未找到符合筛选条件的商品。')}
              </div>
            ) : (
              filteredProducts.map((p) => {
                const isLowStock = p.stock <= p.minStock;
                const isHighRot = p.turnoverRate === 'Alta';

                return (
                  <div
                    key={p.id}
                    className={`border rounded-xl p-3.5 space-y-2.5 transition-colors ${
                      isLowStock
                        ? 'bg-red-950/20 border-red-500/40 shadow-sm shadow-red-950/20'
                        : 'bg-[#111114] border-white/[0.08]'
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
                          <span className="text-[10px] text-amber-400 font-semibold">
                            {translateCategoryLabel(p.category, lang)}
                          </span>
                          <span className="text-zinc-500 text-[10px]">·</span>
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                            {(p.rating ?? 5).toFixed(1)}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold flex items-center gap-1 ${
                            isHighRot
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-zinc-900 text-zinc-400'
                          }`}>
                            {isHighRot && <Flame className="w-2.5 h-2.5 text-amber-400" />}
                            {tr('Rotación', 'Turnover', '周转')}{' '}
                            {translateTurnoverRateLabel(p.turnoverRate || 'Media', lang)}
                          </span>
                          {isLowStock && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                              <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                              {p.stock === 0 ? tr('Agotado', 'Out of stock', '售罄') : tr('¡Reponer Ya!', 'Restock Now!', '立即补货！')}
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
                        {p.availableSizes && p.availableSizes.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {p.availableSizes.slice(0, 6).map((sz) => (
                              <span
                                key={`${p.id}-mob-sz-${sz}`}
                                className="px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/25 text-[10px] font-mono text-amber-300"
                              >
                                {translateSizeTokenLabel(sz, lang)}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 mt-0.5 flex-wrap">
                          <span>SKU: {p.sku}</span>
                          {p.batchNumber && <span>{tr('Lote:', 'Batch:', '批次:')} {p.batchNumber}</span>}
                          {p.location && (
                            <span>
                              {tr('Ubic:', 'Loc:', '库位:')}{' '}
                              {translateWarehouseLocationLabel(p.location, lang)}
                            </span>
                          )}
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

                    <div className="pt-2 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${isLowStock ? 'text-red-400' : 'text-zinc-400'}`}>
                          {tr('Stock:', 'Stock:', '库存:')}
                        </span>
                        <span
                          className={`font-mono font-bold text-sm tabular-nums ${
                            isLowStock ? 'text-red-400 font-extrabold' : 'text-white'
                          }`}
                        >
                          {p.stock}
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          / {tr('mín', 'min', '最低')} {p.minStock}{' '}
                          {translateUnitLabel(p.unit, lang, p.minStock > 1)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {onPublishProductToStore && activeStore && (
                          <button
                            type="button"
                            disabled={publishingId === p.id}
                            onClick={() => handlePublishSingleProduct(p)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 border transition-colors ${
                              isProductSyncedToStore(p)
                                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25'
                                : 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                            }`}
                          >
                            <Store className="w-3 h-3" />
                            <span>
                              {publishingId === p.id
                                ? '...'
                                : isProductSyncedToStore(p)
                                  ? tr('En Tienda ✓', 'In Store ✓', '已上架 ✓')
                                  : tr('Añadir a Tienda', 'Add to Store', '上架到店铺')}
                            </span>
                          </button>
                        )}

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
                    <th className="py-3 px-4">{tr('Producto & Lote', 'Product & Batch', '商品与批次')}</th>
                    <th className="py-3 px-4">{tr('Categoría & Ubicación', 'Category & Location', '分类与库位')}</th>
                    <th className="py-3 px-4 text-center">{tr('Rotación', 'Turnover', '周转率')}</th>
                    <th className="py-3 px-4 text-right">{tr('Costo (USD)', 'Cost (USD)', '成本 (USD)')}</th>
                    <th className="py-3 px-4 text-right">{tr('Precio Venta', 'Sale Price', '售价')}</th>
                    <th className="py-3 px-4 text-center">{tr('Stock / Mínimo', 'Stock / Min', '库存 / 最低')}</th>
                    <th className="py-3 px-4 text-center">{tr('Alerta Automática', 'Auto Alert', '自动预警')}</th>
                    <th className="py-3 px-4 text-right">{tr('Ajuste Rápido', 'Quick Adjust', '快速调整')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]/80">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-zinc-400">
                        {tr('No se encontraron productos coincidentes.', 'No matching products found.', '未找到匹配商品。')}
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isLowStock = p.stock <= p.minStock;
                      const isHighRot = p.turnoverRate === 'Alta';

                      return (
                        <tr
                          key={p.id}
                          className={`transition-colors ${
                            isLowStock
                              ? 'bg-red-950/20 hover:bg-red-950/35 text-red-100'
                              : 'hover:bg-zinc-800/40'
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
                                      {tr('Alta Rotación', 'High Turnover', '高周转')}
                                    </span>
                                  )}
                                </div>
                                {p.description && (
                                  <div className="text-[11px] text-zinc-400 truncate max-w-xs mt-0.5">
                                    {p.description}
                                  </div>
                                )}
                                {p.availableSizes && p.availableSizes.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {p.availableSizes.map((sz) => (
                                      <span
                                        key={`${p.id}-desk-sz-${sz}`}
                                        className="px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/25 text-[10px] font-mono text-amber-300"
                                      >
                                        {translateSizeTokenLabel(sz, lang)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div className="text-xs text-zinc-400 font-mono mt-0.5">
                                  {p.sku} · {tr('Lote:', 'Batch:', '批次:')} {p.batchNumber || 'LT-GEN-01'} · {p.barcode}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="text-zinc-300">
                              {translateCategoryLabel(p.category, lang)}
                            </span>
                            <span className="text-zinc-500 block text-xs">
                              {translateWarehouseLocationLabel(p.location || 'Depósito Principal', lang)} ·{' '}
                              {translateUnitLabel(p.unit, lang, p.stock > 1)}
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
                              {p.turnoverRate === 'Alta'
                                ? tr('Alta', 'High', '高')
                                : p.turnoverRate === 'Baja'
                                  ? tr('Baja', 'Low', '低')
                                  : tr('Media', 'Medium', '中')}
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
                              <span className="text-xs text-zinc-500">/ {tr('mín', 'min', '最低')} {p.minStock}</span>
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center">
                            {isLowStock ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 whitespace-nowrap">
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                {p.stock === 0
                                  ? tr('Agotado', 'Out of stock', '售罄')
                                  : isHighRot
                                    ? tr('¡Crítico Alta Rot.!', 'Critical Fast-Moving!', '高周转告急！')
                                    : tr('Bajo Stock', 'Low Stock', '低库存')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                {tr('Óptimo', 'Optimal', '正常')}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              {onPublishProductToStore && activeStore && (
                                <button
                                  type="button"
                                  disabled={publishingId === p.id}
                                  onClick={() => handlePublishSingleProduct(p)}
                                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 border transition-colors whitespace-nowrap ${
                                    isProductSyncedToStore(p)
                                      ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/25'
                                      : 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                                  }`}
                                  title={
                                    isProductSyncedToStore(p)
                                      ? tr('Actualizar datos y stock en Tienda Online', 'Update data & stock on Online Store', '同步更新至在线商店')
                                      : tr('Publicar este producto en tu Tienda Online', 'Publish product to Online Store', '将此商品发布至在线商店')
                                  }
                                >
                                  <Store className="w-3 h-3" />
                                  <span>
                                    {publishingId === p.id
                                      ? '...'
                                      : isProductSyncedToStore(p)
                                        ? tr('En Tienda ✓', 'In Store ✓', '已上架 ✓')
                                        : tr('Añadir a Tienda', 'Add to Store', '上架到店铺')}
                                  </span>
                                </button>
                              )}

                              <div className="inline-flex items-center gap-1 bg-[#09090b] p-1 rounded-md border border-white/[0.08]">
                                <button
                                  onClick={() => handleStockChange(p.id, -1)}
                                  disabled={p.stock <= 0}
                                  className="p-1 hover:bg-zinc-800/80 text-zinc-300 hover:text-white rounded disabled:opacity-30 disabled:cursor-not-allowed"
                                  title={tr('Restar 1 unidad', 'Subtract 1 unit', '减少 1 件')}
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="px-2 font-mono text-xs text-zinc-400">Stock</span>
                                <button
                                  onClick={() => handleStockChange(p.id, 1)}
                                  className="p-1 hover:bg-zinc-800/80 text-zinc-300 hover:text-white rounded"
                                  title={tr('Sumar 1 unidad', 'Add 1 unit', '增加 1 件')}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
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
              <div className="flex items-center gap-2 flex-wrap">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                <h3 className="font-bold text-white text-base font-display">
                  {tr('Auditoría de Inventario & Control de Mermas', 'Inventory Audit & Shrinkage Control', '库存盘点与损耗管控')}
                </h3>
                <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold px-2 py-0.5 rounded">
                  {tr('Rentabilidad Protegida', 'Margin Protected', '利润率保护')}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                {tr(
                  'Monitoreo estricto de roturas, deterioros, vencimientos y desvíos no justificados para salvaguardar el margen neto de tu negocio.',
                  'Strict monitoring of breakage, damage, expiration, and unexplained shrinkage to safeguard your store net margin.',
                  '严格追踪破损、变质、过期与异常损耗，保障店铺净利润率。'
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => exportInventoryAuditPDF(audits, exchangeRate, lang)}
                className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 border border-white/[0.1] transition-colors shadow-sm"
                title={tr('Descargar informe formal de auditoría en PDF', 'Download formal audit report in PDF', '下载正式 PDF 盘点报告')}
              >
                <Download className="w-3.5 h-3.5 text-rose-400" />
                <span>{tr('Informe PDF', 'PDF Report', 'PDF 报告')}</span>
              </button>

              <button
                onClick={() => exportInventoryAuditCSV(audits, exchangeRate, lang)}
                className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 border border-white/[0.1] transition-colors shadow-sm"
                title={tr('Exportar registros a hoja de cálculo Excel / CSV', 'Export logs to Excel / CSV spreadsheet', '导出至 Excel / CSV 表格')}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>{tr('Exportar CSV', 'Export CSV', '导出 CSV')}</span>
              </button>

              <button
                onClick={() => setShowAuditModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>{tr('Registrar Merma / Desvío', 'Log Shrinkage / Loss', '登记损耗/异常')}</span>
              </button>
            </div>
          </div>

          {/* Audit Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-[#111114] border border-rose-500/20 p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">
                {tr('Impacto Financiero Total (USD)', 'Total Financial Impact (USD)', '总财务损失 (USD)')}
              </span>
              <div className="text-xl font-bold font-mono text-rose-400 tabular-nums">
                ${totalLossUSD.toFixed(2)} USD
              </div>
              <span className="text-xs text-zinc-500 font-mono tabular-nums">
                ≈ {totalLossBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">
                {tr('Unidades Afectadas', 'Affected Units', '受损数量')}
              </span>
              <div className="text-xl font-bold font-mono text-white tabular-nums">
                {totalLossQty}{' '}
                <span className="text-xs font-normal text-zinc-400">
                  {tr('unid. dadas de baja', 'units written off', '件已核销')}
                </span>
              </div>
              <span className="text-xs text-zinc-500">
                {tr(`En ${audits.length} incidentes auditados`, `Across ${audits.length} audited incidents`, `共 ${audits.length} 次盘点记录`)}
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">
                {tr('Índice de Merma / Almacén', 'Warehouse Shrinkage Rate', '仓库损耗率')}
              </span>
              <div className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                {totalValueUSD > 0 ? ((totalLossUSD / totalValueUSD) * 100).toFixed(2) : '0.00'}%
              </div>
              <span className="text-xs text-zinc-500">
                {tr('Límite recomendado: < 2.50%', 'Recommended threshold: < 2.50%', '建议控制阈值：< 2.50%')}
              </span>
            </div>

            <div className="bg-[#111114] border border-white/[0.08] p-4 rounded-xl">
              <span className="text-xs text-zinc-400 block mb-1">
                {tr('Causa Principal de Merma', 'Top Shrinkage Cause', '主要损耗原因')}
              </span>
              <div className="text-base font-bold text-white truncate">
                {audits.length > 0
                  ? translateAuditTypeLabel(audits[0].type, lang)
                  : tr('Sin registros', 'No records', '暂无记录')}
              </div>
              <span className="text-xs text-zinc-500">
                {tr('Supervisado por administración', 'Supervised by management', '由管理层监督')}
              </span>
            </div>
          </div>

          {/* Audit Filters & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={tr(
                  'Buscar merma por producto, auditor, ubicación o motivo...',
                  'Search shrinkage by product, auditor, location, or reason...',
                  '按商品、盘点人、库位或原因搜索损耗...'
                )}
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
                  {type === 'Todos'
                    ? tr('Todos', 'All', '全部')
                    : type === 'Merma por Rotura'
                      ? tr('Merma por Rotura', 'Breakage Loss', '破损损耗')
                      : type === 'Vencimiento'
                        ? tr('Vencimiento', 'Expiration', '过期损耗')
                        : type === 'Desvío / Pérdida'
                          ? tr('Desvío / Pérdida', 'Missing / Loss', '遗失 / 短少')
                          : tr('Cortesía / Muestra', 'Sample / Promo', '样品 / 赠送')}
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
                    <th className="py-3 px-4">{tr('Fecha & Boleta', 'Date & Ticket', '日期与单号')}</th>
                    <th className="py-3 px-4">{tr('Producto & SKU', 'Product & SKU', '商品与 SKU')}</th>
                    <th className="py-3 px-4">{tr('Tipo de Incidencia', 'Incident Type', '异常类型')}</th>
                    <th className="py-3 px-4 text-center">{tr('Cant.', 'Qty', '数量')}</th>
                    <th className="py-3 px-4 text-right">{tr('Pérdida (USD)', 'Loss (USD)', '损失 (USD)')}</th>
                    <th className="py-3 px-4 text-right">{tr('Pérdida (Bs.)', 'Loss (Bs.)', '损失 (Bs.)')}</th>
                    <th className="py-3 px-4">{tr('Ubicación & Auditor', 'Location & Auditor', '库位与盘点人')}</th>
                    <th className="py-3 px-4">{tr('Observaciones', 'Notes', '备注')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]/80">
                  {filteredAudits.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-zinc-400">
                        {tr('No hay registros de mermas o pérdidas con ese criterio.', 'No shrinkage or loss records match that filter.', '没有符合条件的损耗或遗失记录。')}
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
                            {translateAuditTypeLabel(a.type, lang)}
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
                          <span className="text-zinc-300 block text-xs">{translateWarehouseLocationLabel(a.location, lang)}</span>
                          <span className="text-zinc-500 text-[11px]">{a.auditorName}</span>
                        </td>

                        <td className="py-3 px-4 text-xs text-zinc-400 max-w-xs truncate" title={a.notes}>
                          {a.notes || tr('Sin observaciones', 'No notes', '无备注')}
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
              <div className="flex items-center gap-2 flex-wrap">
                <Truck className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-white text-base font-display">
                  {tr('Trazabilidad de Mercancía: Ciclo End-to-End', 'Merchandise Traceability: End-to-End Lifecycle', '商品溯源：全链路生命周期')}
                </h3>
                <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold px-2 py-0.5 rounded">
                  {tr('Cadena Completa', 'Full Chain', '全链路')}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                {tr(
                  'Monitoreo exhaustivo desde la recepción del proveedor con factura de compra y lote, su paso por depósito y exhibición, hasta la emisión de la factura al cliente.',
                  'End-to-end tracking from supplier intake with purchase invoice and batch, through storage and display, to final customer checkout.',
                  '全程监控货物从供应商入库、发票批次、仓库调拨到最终销售开票的每一个环节。'
                )}
              </p>
            </div>

            <button
              onClick={() => setShowAddTraceStepModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{tr('Registrar Evento de Trazabilidad', 'Log Traceability Event', '登记溯源节点')}</span>
            </button>
          </div>

          {/* Traceability Grid: Batch Selector (Left) + Visual Timeline (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Batch Selector */}
            <div className="lg:col-span-5 min-w-0 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={tr('Buscar lote, SKU o proveedor...', 'Search batch, SKU, or supplier...', '搜索批次、SKU 或供应商...')}
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
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
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

                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          trace.status === 'En Almacén'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : trace.status === 'En Barra'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-zinc-900 text-zinc-400'
                        }`}>
                          {trace.status === 'En Almacén' || trace.status === 'En Barra' ? null : null}
                          {translateTraceStatusLabel(trace.status, lang)}
                        </span>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-zinc-400">
                        <span>{tr('Entrada:', 'Entry:', '入库：')} {trace.entryDate.split(' ')[0]}</span>
                        <span className="font-mono text-white">
                          {tr('Stock Lote:', 'Batch Stock:', '批次库存：')}{' '}
                          <strong className="text-amber-400">{trace.currentQuantity}</strong> / {trace.initialQuantity}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Detailed End-to-End Timeline */}
            <div className="lg:col-span-7 min-w-0 bg-[#111114] border border-white/[0.08] rounded-2xl p-4 sm:p-6 space-y-6">
              {currentTrace ? (
                <>
                  <div className="border-b border-white/[0.08] pb-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-mono text-blue-400 font-bold">
                          {tr('LOTE OFICIAL:', 'OFFICIAL BATCH:', '官方批次：')} {currentTrace.batchNumber}
                        </span>
                        <h3 className="font-bold text-white text-base sm:text-lg font-display">
                          {currentTrace.productName}
                        </h3>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                        {currentTrace.steps.length} {tr('Hitos Registrados', 'Recorded Milestones', '个已记录节点')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
                      <div className="bg-[#09090b] p-2 rounded-lg border border-white/[0.08]">
                        <span className="text-zinc-500 block text-[10px]">{tr('Distribuidor / Proveedor', 'Supplier / Vendor', '供应商 / 厂商')}</span>
                        <span className="font-semibold text-white truncate block">{currentTrace.supplierName}</span>
                      </div>
                      <div className="bg-[#09090b] p-2 rounded-lg border border-white/[0.08]">
                        <span className="text-zinc-500 block text-[10px]">{tr('Factura de Compra', 'Purchase Invoice', '采购发票')}</span>
                        <span className="font-mono text-amber-400 font-bold">{currentTrace.purchaseInvoiceNumber}</span>
                      </div>
                      <div className="bg-[#09090b] p-2 rounded-lg border border-white/[0.08]">
                        <span className="text-zinc-500 block text-[10px]">{tr('Ubicación Actual', 'Current Location', '当前库位')}</span>
                        <span className="text-zinc-200 font-medium">
                          {translateWarehouseLocationLabel(currentTrace.storageLocation, lang)}
                        </span>
                      </div>
                      <div className="bg-[#09090b] p-2 rounded-lg border border-white/[0.08]">
                        <span className="text-zinc-500 block text-[10px]">{tr('Vencimiento', 'Expiration', '有效期')}</span>
                        <span className="font-mono text-zinc-300">{currentTrace.expirationDate || '2030-12-31'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Timeline Stream */}
                  <div>
                    <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      {tr(
                        'Línea de Tiempo del Lote (Proveedor → Almacén → Exhibición → Venta)',
                        'Batch Timeline (Supplier → Warehouse → Floor → Checkout)',
                        '批次时间轴（供应商 → 仓库 → 展示 → 结账）'
                      )}
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
                            <div className={`absolute -left-[31px] top-1.5 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-md ${iconBg}`}>
                              {idx + 1}
                            </div>

                            <div className="bg-[#09090b] p-3.5 rounded-xl border border-white/[0.08] hover:border-white/[0.1] transition-colors space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                                  {translateTraceStageLabel(step.stage, lang)}
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
                                <span>
                                  {tr('Por:', 'By:', '经办人：')} <strong className="text-zinc-300">{step.performedBy}</strong>
                                </span>
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
                  {tr('Selecciona un lote de la izquierda para ver su trazabilidad.', 'Select a batch from the left to view its traceability.', '请在左侧选择一个批次以查看溯源记录。')}
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
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 safe-area-bottom">
          <div className="bg-[#111114] border-t sm:border border-rose-500/30 rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base font-display">
                    {tr('Registrar Incidencia de Inventario', 'Log Inventory Incident', '登记库存异常')}
                  </h3>
                  <span className="text-xs text-zinc-400">
                    {tr('Merma, rotura, vencimiento o desvío no justificado', 'Shrinkage, breakage, expiration, or unexplained loss', '损耗、破损、过期或未明短少')}
                  </span>
                </div>
              </div>
              <button onClick={() => setShowAuditModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAudit} className="space-y-3.5 text-xs">
              {products.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs">
                  {tr(
                    'Tu almacén aún no tiene productos registrados. Agrega productos primero en el catálogo para poder registrar mermas.',
                    'Your warehouse has no products yet. Add products to your catalog first to log shrinkage.',
                    '您的仓库暂无商品，请先在目录中添加商品后再登记损耗。'
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    {tr('Producto Afectado', 'Affected Product', '受影响商品')}
                  </label>
                  <select
                    value={auditProductId || products[0]?.id || ''}
                    onChange={(e) => setAuditProductId(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white focus:outline-none focus:border-rose-500"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({tr('Stock', 'Stock', '库存')}: {p.stock}{' '}
                        {translateUnitLabel(p.unit, lang, p.stock > 1)} · {tr('Costo', 'Cost', '成本')}: $
                        {p.costUSD.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    {tr('Tipo de Incidencia / Causa', 'Incident Type / Cause', '异常类型 / 原因')}
                  </label>
                  <select
                    value={auditType}
                    onChange={(e) => setAuditType(e.target.value as InventoryAuditType)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white focus:outline-none focus:border-rose-500 font-semibold text-rose-300"
                  >
                    <option value="Merma por Rotura">{tr('Merma por Rotura en Almacén', 'Breakage / Damage', '破损损耗')}</option>
                    <option value="Vencimiento">{tr('Vencimiento / Deterioro', 'Expiration / Spoilage', '过期 / 变质')}</option>
                    <option value="Desvío / Pérdida">{tr('Desvío / Pérdida No Justificada', 'Missing / Unexplained Loss', '遗失 / 短少')}</option>
                    <option value="Degustación / Cortesía">{tr('Muestra / Cortesía VIP', 'Sample / VIP Promo', '样品 / 赠送')}</option>
                    <option value="Ajuste Físico">{tr('Ajuste Físico de Arqueo', 'Physical Count Adjustment', '实物盘点调整')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    {tr('Cantidad de Unidades', 'Quantity (Units)', '数量')}
                  </label>
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

              {(() => {
                const target = products.find((p) => p.id === auditProductId) || products[0];
                const qty = parseInt(auditQty) || 0;
                const costUSD = target ? target.costUSD * qty : 0;
                const costBs = costUSD * exchangeRate;

                return (
                  <div className="p-3 bg-rose-950/20 border border-rose-500/30 rounded-xl space-y-1 text-xs">
                    <span className="text-zinc-400 block font-medium">
                      {tr('Impacto Económico Calculado:', 'Calculated Financial Impact:', '预估财务影响：')}
                    </span>
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
                  <label className="block text-zinc-300 font-medium mb-1">
                    {tr('Ubicación de la Incidencia', 'Incident Location', '发生库位')}
                  </label>
                  <select
                    value={auditLocation}
                    onChange={(e) => setAuditLocation(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                  >
                    <option value="Depósito Principal">{tr('Depósito Principal', 'Main Warehouse', '主仓库')}</option>
                    <option value="Exhibición Tienda">{tr('Exhibición Tienda', 'Storefront Display', '门店展示区')}</option>
                    <option value="Cava Refrigerada">{tr('Cava Refrigerada', 'Cold Storage', '冷藏库')}</option>
                    <option value="Depósito Seco">{tr('Depósito Seco', 'Dry Storage', '干货区')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    {tr('Auditor / Responsable', 'Auditor / Manager', '盘点人 / 负责人')}
                  </label>
                  <input
                    type="text"
                    required
                    value={auditAuditor}
                    onChange={(e) => setAuditAuditor(e.target.value)}
                    placeholder={tr('Responsable de Almacén', 'Warehouse Manager', '仓库负责人')}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  {tr('Observaciones / Justificación', 'Notes / Justification', '备注与说明')}
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder={tr(
                    'Ej: Prenda o caja dañada durante manipulación en almacén...',
                    'Ex: Item damaged during warehouse handling...',
                    '例如：仓库搬运过程中受损...'
                  )}
                  value={auditNotes}
                  onChange={(e) => setAuditNotes(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="p-3 bg-[#09090b] rounded-xl border border-white/[0.08] flex items-center justify-between">
                <div>
                  <span className="font-bold text-white block">
                    {tr('Descontar automáticamente del stock', 'Automatically deduct from stock', '自动扣减库存')}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {tr('Actualiza el conteo de almacén en tiempo real', 'Updates warehouse stock count in real time', '实时更新仓库库存数量')}
                  </span>
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
                  {tr('Cancelar', 'Cancel', '取消')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md shadow-rose-600/20"
                >
                  {tr('Guardar Incidencia', 'Save Incident', '保存异常记录')}
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
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 safe-area-bottom">
          <div className="bg-[#111114] border-t sm:border border-blue-500/30 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <h3 className="font-bold text-white text-base font-display">
                  {tr('Nuevo Hito de Trazabilidad', 'New Traceability Milestone', '新增溯源节点')}
                </h3>
                <span className="text-xs font-mono text-blue-400">{currentTrace.batchNumber} · {currentTrace.productName}</span>
              </div>
              <button onClick={() => setShowAddTraceStepModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddTraceStep} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  {tr('Etapa de la Cadena', 'Chain Stage', '流转阶段')}
                </label>
                <select
                  value={newStepStage}
                  onChange={(e) => setNewStepStage(e.target.value as TraceabilityStep['stage'])}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500 font-semibold text-blue-300"
                >
                  <option value="Traslado a Barra">{tr('Traslado Interno a Exhibición / Despacho', 'Internal Transfer to Display / Dispatch', '内部调拨至展示/发货区')}</option>
                  <option value="Ingreso a Cava">{tr('Almacenamiento / Reorganización en Almacén', 'Warehouse Storage / Reorganization', '入库储存 / 库位整理')}</option>
                  <option value="Recepción Proveedor">{tr('Recepción de Proveedor / Entrada Inicial', 'Supplier Intake / Initial Entry', '供应商收货入库')}</option>
                  <option value="Venta al Consumidor">{tr('Venta / Despacho a Consumidor', 'Sale / Customer Dispatch', '销售出库')}</option>
                  <option value="Auditoría / Merma">{tr('Auditoría / Boleta de Merma', 'Audit / Shrinkage Log', '盘点 / 损耗单')}</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  {tr('Descripción del Movimiento', 'Movement Description', '流转说明')}
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder={tr(
                    'Ej: Pase de 12 unidades de depósito a exhibición en tienda...',
                    'Ex: Moved 12 units from warehouse to store display...',
                    '例如：从主仓库调拨 12 件至门店展示架...'
                  )}
                  value={newStepDescription}
                  onChange={(e) => setNewStepDescription(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  {tr('Documento / Nro. de Referencia (Opcional)', 'Document / Reference # (Optional)', '关联单据编号（可选）')}
                </label>
                <input
                  type="text"
                  placeholder={tr('Ej: Vale Interno #VE-094, Factura #FAC-0084...', 'Ex: Internal Voucher #VE-094, Invoice #FAC-0084...', '例如：内部调拨单 #VE-094...')}
                  value={newStepRef}
                  onChange={(e) => setNewStepRef(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  {tr('Responsable / Operador', 'Manager / Operator', '负责人 / 操作员')}
                </label>
                <input
                  type="text"
                  required
                  value={newStepAuditor}
                  onChange={(e) => setNewStepAuditor(e.target.value)}
                  placeholder={tr('Responsable de Almacén', 'Warehouse Manager', '仓库负责人')}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowAddTraceStepModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium"
                >
                  {tr('Cancelar', 'Cancel', '取消')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md shadow-blue-600/20"
                >
                  {tr('Añadir al Timeline', 'Add to Timeline', '添加到时间轴')}
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
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 safe-area-bottom">
          <div className="bg-[#111114] border-t sm:border border-amber-500/30 rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-white text-base font-display">
                    {tr('Sugerencia Automática de Pedido', 'Automated Restock Suggestion', '智能补货采购建议')}
                  </h3>
                  <span className="text-xs text-zinc-400">
                    {tr('Productos en o bajo stock mínimo que requieren reposición', 'Items at or below minimum stock needing restock', '处于或低于最低警戒库存的商品')}
                  </span>
                </div>
              </div>
              <button onClick={() => setShowPurchaseOrderModal(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {reorderList.length === 0 ? (
              <div className="py-8 text-center text-zinc-400 text-xs">
                {tr(
                  'Todos los productos se encuentran por encima de su stock mínimo de seguridad.',
                  'All products are currently above their safety minimum stock level.',
                  '所有商品均高于最低安全库存水平。'
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-[#09090b] p-3 rounded-xl border border-white/[0.08] space-y-2 text-xs">
                  <div className="flex justify-between text-zinc-300">
                    <span>{tr('Total Ítems a Reponer:', 'Total Items to Restock:', '需补货商品总数：')}</span>
                    <span className="font-bold text-white">
                      {reorderList.length} {tr('producto(s)', 'product(s)', '件商品')}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-300">
                    <span>{tr('Inversión Estimada en Compra:', 'Estimated Purchase Cost:', '预估采购金额：')}</span>
                    <span className="font-mono font-bold text-amber-400">${totalReorderEstimateUSD.toFixed(2)} USD</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-zinc-400">
                    <span>{tr('Equivalente en Bolívares:', 'Bolívares Equivalent:', '折合玻利瓦尔：')}</span>
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
                            {tr('Stock Actual:', 'Current Stock:', '当前库存：')} <strong className="text-red-400">{p.stock}</strong> ({tr('Mínimo:', 'Min:', '最低：')} {p.minStock})
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            {tr('Proveedor:', 'Supplier:', '供应商：')} {p.supplier || tr('Distribuidor Mayorista', 'Wholesale Distributor', '批发供应商')}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] text-amber-400 font-bold block">
                            {tr('Pedir:', 'Order:', '订购：')} {toOrder}{' '}
                            {translateUnitLabel(p.unit, lang, toOrder > 1)}
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
                      `*${tr('ORDEN DE REPOSICIÓN', 'RESTOCK PURCHASE ORDER', '采购补货单')} - ${(activeStore?.storeName || 'SMITH SOLUTIONS').toUpperCase()}*\n${tr('Fecha', 'Date', '日期')}: ${new Date().toLocaleDateString(VENEZUELA_LOCALE, { timeZone: VENEZUELA_TIMEZONE })}\n----------------------------\n` +
                        reorderList
                          .map((p) => {
                            const toOrder = Math.max(1, p.minStock * 2 - p.stock);
                            return `• ${p.name}: ${tr('Pedir', 'Order', '订购')} ${toOrder} ${translateUnitLabel(p.unit, lang, toOrder > 1)} (${tr('Stock actual', 'Current stock', '当前库存')}: ${p.stock})`;
                          })
                          .join('\n') +
                        `\n----------------------------\n${tr('Estimado total', 'Estimated total', '预估总额')}: $${totalReorderEstimateUSD.toFixed(2)} USD\nSmith Solutions E-Commerce`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 text-xs transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{tr('Compartir Pedido por WhatsApp', 'Share Order via WhatsApp', '通过 WhatsApp 发送采购单')}</span>
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
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 safe-area-bottom">
          <div className="bg-[#111114] border-t sm:border border-amber-500/30 rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <h3 className="font-bold text-white text-lg font-display">
                {tr('Registrar Nuevo Producto', 'Register New Product', '登记新商品')}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  {tr('Nombre del Producto', 'Product Name', '商品名称')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={tr('Ej: Franela Oversize Algodón o Producto General', 'Ex: Cotton Oversized Tee or Item', '例如：纯棉宽松T恤或常规商品')}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    {tr('Categoría', 'Category', '商品分类')}
                  </label>
                  <input
                    type="text"
                    list="inventory-categories-list"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder={tr('Ej: Moda y Ropa, Calzado, General...', 'Ex: Fashion & Apparel, Footwear, General...', '例如：时尚服饰、鞋靴、综合百货...')}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                  <datalist id="inventory-categories-list">
                    <option value="Moda y Ropa">{translateCategoryLabel('Moda y Ropa', lang)}</option>
                    <option value="Calzado">{translateCategoryLabel('Calzado', lang)}</option>
                    <option value="Accesorios">{translateCategoryLabel('Accesorios', lang)}</option>
                    <option value="Licores">{translateCategoryLabel('Licores', lang)}</option>
                    <option value="Cervezas">{translateCategoryLabel('Cervezas', lang)}</option>
                    <option value="Bebidas">{translateCategoryLabel('Bebidas', lang)}</option>
                    <option value="Tecnología">{translateCategoryLabel('Tecnología', lang)}</option>
                    <option value="General">{translateCategoryLabel('General', lang)}</option>
                  </datalist>
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    {tr('Unidad', 'Unit', '计量单位')}
                  </label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="Unidad">{tr('Unidad', 'Unit', '件/个')}</option>
                    <option value="Prenda">{tr('Prenda', 'Garment', '件（服饰）')}</option>
                    <option value="Par">{tr('Par (Calzado)', 'Pair (Footwear)', '双（鞋靴）')}</option>
                    <option value="Caja">{tr('Caja', 'Box', '箱')}</option>
                    <option value="Paquete">{tr('Paquete', 'Pack', '包')}</option>
                    <option value="Botella">{tr('Botella', 'Bottle', '瓶')}</option>
                    <option value="Lata">{tr('Lata', 'Can', '罐')}</option>
                    <option value="Bolsa">{tr('Bolsa', 'Bag', '袋')}</option>
                    <option value="Kg">{tr('Kilogramo', 'Kilogram', '公斤')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    {tr('Rotación Comercial', 'Sales Turnover', '销售周转率')}
                  </label>
                  <select
                    value={newTurnover}
                    onChange={(e) => setNewTurnover(e.target.value as 'Alta' | 'Media' | 'Baja')}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500 font-semibold"
                  >
                    <option value="Alta">{tr('Alta Rotación (Prioridad)', 'High Turnover (Priority)', '高周转（优先）')}</option>
                    <option value="Media">{tr('Media Rotación', 'Medium Turnover', '中周转')}</option>
                    <option value="Baja">{tr('Baja Rotación', 'Low Turnover', '低周转')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    {tr('Ubicación', 'Location', '库位')}
                  </label>
                  <select
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value as Product['location'])}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                  >
                    <option value="Depósito Principal">{tr('Depósito Principal', 'Main Warehouse', '主仓库')}</option>
                    <option value="Exhibición Tienda">{tr('Exhibición Tienda', 'Storefront Display', '门店展示区')}</option>
                    <option value="Cava Refrigerada">{tr('Cava Refrigerada', 'Cold Storage', '冷藏库')}</option>
                    <option value="Depósito Seco">{tr('Depósito Seco', 'Dry Storage', '干货区')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  {tr('Distribuidor / Proveedor (Opcional)', 'Supplier / Brand (Optional)', '供应商 / 品牌（可选）')}
                </label>
                <input
                  type="text"
                  placeholder={tr('Ej: Proveedor mayorista, marca textil...', 'Ex: Wholesale supplier, apparel brand...', '例如：批发商、服饰品牌...')}
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    {tr('Costo Compra (USD)', 'Purchase Cost (USD)', '采购成本 (USD)')}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={newCostUSD}
                    onChange={(e) => setNewCostUSD(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    {tr('Precio Venta (USD)', 'Sale Price (USD)', '销售单价 (USD)')}
                  </label>
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
                  <label className="block text-zinc-300 font-medium mb-1">
                    {tr('Stock Inicial', 'Initial Stock', '初始库存')}
                  </label>
                  <input
                    type="number"
                    value={newStock}
                    onChange={(e) => setNewStock(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    {tr('Mínimo Alerta', 'Min Stock Alert', '警戒下限')}
                  </label>
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
                  <label className="block text-zinc-300 font-medium mb-1">
                    {tr('SKU (Opcional)', 'SKU (Optional)', 'SKU 货号（可选）')}
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: MOD-OV24"
                    value={newSKU}
                    onChange={(e) => setNewSKU(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 font-medium mb-1">
                    {tr('Calificación (1 a 5 ★)', 'Rating (1 to 5 ★)', '评分 (1 到 5 ★)')}
                  </label>
                  <select
                    value={newRating}
                    onChange={(e) => setNewRating(e.target.value)}
                    className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-amber-300 font-mono font-bold"
                  >
                    <option value="5.0">5.0 ★ {tr('Excelente', 'Excellent', '极佳')}</option>
                    <option value="4.5">4.5 ★ {tr('Muy bueno', 'Very good', '很好')}</option>
                    <option value="4.0">4.0 ★ {tr('Bueno', 'Good', '良好')}</option>
                    <option value="3.5">3.5 ★ {tr('Regular', 'Fair', '一般')}</option>
                    <option value="3.0">3.0 ★ {tr('Estándar', 'Standard', '普通')}</option>
                    <option value="2.0">2.0 ★ {tr('Bajo', 'Low', '较低')}</option>
                    <option value="1.0">1.0 ★ {tr('Crítico', 'Poor', '极差')}</option>
                  </select>
                </div>
              </div>

              {/* Optional Clothing Sizes Builder available for ANY store/product */}
              <SizeTagBuilder
                sizes={newSizes}
                onChange={setNewSizes}
                storeDefaultSizes={activeStore?.defaultClothingSizes}
                sizeGuide={newSizeGuide}
                onSizeGuideChange={setNewSizeGuide}
                compact
              />

              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  {tr('Foto del Producto (Subir o pegar URL)', 'Product Photo (Upload or paste URL)', '商品图片（上传或粘贴链接）')}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={tr('https://... o sube una foto', 'https://... or upload a photo', 'https://... 或上传图片')}
                    value={newImage}
                    onChange={(e) => setNewImage(e.target.value)}
                    className="flex-1 bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                  <label className="px-3 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-white/[0.1] font-semibold cursor-pointer shrink-0 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingImage ? '...' : tr('Subir', 'Upload', '上传')}</span>
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
                      alt={tr('Vista previa', 'Preview', '预览')}
                      className="w-12 h-12 rounded-lg object-cover border border-white/[0.1]"
                    />
                    <button
                      type="button"
                      onClick={() => setNewImage('')}
                      className="text-[11px] text-rose-400 hover:underline"
                    >
                      {tr('Quitar foto', 'Remove photo', '移除图片')}
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1">
                  {tr('Descripción Breve (Opcional)', 'Short Description (Optional)', '简短描述（可选）')}
                </label>
                <textarea
                  rows={2}
                  placeholder={tr('Detalles del producto, material, presentación o notas...', 'Product details, material, packaging, or notes...', '商品详情、材质、包装或备注...')}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-[#09090b] border border-white/[0.08] rounded-lg p-2.5 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {activeStore && (
                <label className="p-3 rounded-xl bg-emerald-950/25 border border-emerald-500/30 flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <span className="font-bold text-emerald-300 block">
                      {tr('Publicar también en mi Tienda Online', 'Also publish to my Online Store', '同时发布到我的在线商店')}
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      {tr(
                        `Añade este producto directo al catálogo de "${activeStore.storeName}" y vincula el stock.`,
                        `Adds this item directly to "${activeStore.storeName}" catalog and links stock.`,
                        `直接添加到 "${activeStore.storeName}" 商店目录并联动库存。`
                      )}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={publishToStoreOnAdd}
                    onChange={(e) => setPublishToStoreOnAdd(e.target.checked)}
                    className="accent-emerald-500 w-4 h-4 rounded shrink-0"
                  />
                </label>
              )}

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium"
                >
                  {tr('Cancelar', 'Cancel', '取消')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold"
                >
                  {tr('Guardar en Almacén', 'Save to Warehouse', '保存至仓库')}
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
        sales={sales}
        exchangeRate={exchangeRate}
        emailLogs={emailLogs}
        onTriggerTestEmail={handleTriggerTestEmail}
        onClearLogs={handleClearLogs}
        activeStore={activeStore}
        onLogsUpdated={setEmailLogs}
      />

      {/* Floating Email Notification Toast */}
      {emailToast && (
        <div
          className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 max-w-sm sm:max-w-md bg-[#111114] border border-amber-500/50 p-4 rounded-2xl shadow-2xl shadow-black/80 flex items-start gap-3 animate-in slide-in-from-bottom duration-300 backdrop-blur-md"
          role="status"
          aria-live="polite"
        >
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0 mt-0.5">
            <Mail className="w-5 h-5" />
          </div>
          <div className="flex-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm font-display">
                {tr('Notificación de Alerta', 'Alert Notification', '预警通知')}
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
                <span>{tr('Ver Historial & Config. SMTP', 'View History & SMTP Config', '查看记录与 SMTP 配置')}</span>
                <span>→</span>
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEmailToast(null)}
            className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-800/80 transition-colors"
            title={tr('Cerrar notificación', 'Close notification', '关闭通知')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
