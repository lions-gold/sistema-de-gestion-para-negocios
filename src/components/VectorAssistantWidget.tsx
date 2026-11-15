import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User } from 'firebase/auth';
import {
  BellOff,
  Compass,
  ExternalLink,
  Globe2,
  Loader2,
  LogIn,
  Minus,
  Play,
  Send,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Square,
  Store,
  UserCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import {
  StoreCartItem,
  StoreProduct,
  StoreTenant,
  UserPlatformRole,
  VectorBrandConfig,
  VectorChatMessage,
  VectorConsentRecord,
  VectorConsentStatus,
  VectorLanguage,
  VectorSuggestedAction,
  VectorTicket,
} from '../types';
import { AppMainView } from '../utils/seoAndAnalytics';
import {
  createOrUpdateVectorTicket,
  defaultVectorBrandConfig,
  detectEscalationTrigger,
  recordVectorConversationStat,
  requestVectorTTSAudio,
  sendVectorChat,
  subscribeUserVectorConsents,
  subscribeUserVectorTickets,
  subscribeVectorBrandConfig,
  upsertVectorConsent,
  VECTOR_IDENTITY,
} from '../services/vectorService';
import { signInWithGoogleAccount, isSuperAdminUser } from '../services/saasService';
import {
  isAppEffectivelyOffline,
  loadCachedVectorMessages,
  loadVectorVoicePreset,
  queueOfflineMutation,
  saveCachedVectorMessages,
  saveVectorVoicePreset,
  VectorVoicePreset,
} from '../services/offlineSyncService';

export interface VectorOpenSignal {
  nonce: number;
  role?: UserPlatformRole;
  autoPrompt?: string;
}

interface VectorAssistantWidgetProps {
  user: User | null;
  activeStore: StoreTenant | null;
  activeProducts: StoreProduct[];
  activeCart: StoreCartItem[];
  exchangeRate: number;
  currentView?: AppMainView;
  userRole: UserPlatformRole;
  onChangeUserRole: (role: UserPlatformRole) => void;
  onNavigateView: (view: AppMainView) => void;
  ownedStores?: StoreTenant[];
  openSignal?: VectorOpenSignal | null;
  onAddProductToCart?: (product: StoreProduct) => void;
  onOpenCartDrawer?: () => void;
}

const VOICE_OPTIONS: Array<{ id: VectorVoicePreset; label: string }> = [
  { id: 'Charon', label: 'Charon · Ejecutiva' },
  { id: 'Fenrir', label: 'Fenrir · Profunda' },
  { id: 'Kore', label: 'Kore · Serena' },
  { id: 'Puck', label: 'Puck · Dinámica' },
  { id: 'Zephyr', label: 'Zephyr · Clara' },
];

export const VectorAssistantWidget: React.FC<VectorAssistantWidgetProps> = ({
  user,
  activeStore,
  activeProducts,
  activeCart,
  exchangeRate,
  currentView = 'landing',
  userRole,
  onChangeUserRole,
  onNavigateView,
  ownedStores = [],
  openSignal = null,
  onAddProductToCart,
  onOpenCartDrawer,
}) => {
  const { lang: appLang, setLang: setAppLang } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [vectorLang, setVectorLang] = useState<VectorLanguage>(appLang);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voicePreset, setVoicePreset] = useState<VectorVoicePreset>(() => loadVectorVoicePreset());
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const [brandConfig, setBrandConfig] = useState<VectorBrandConfig>(
    defaultVectorBrandConfig(
      activeStore?.id || 'platform',
      activeStore?.storeName || 'Smith Solutions E-Commerce'
    )
  );
  const [consents, setConsents] = useState<VectorConsentRecord[]>([]);
  const [userTickets, setUserTickets] = useState<VectorTicket[]>([]);

  const [messagesByBrand, setMessagesByBrand] = useState<Record<string, VectorChatMessage[]>>(() =>
    loadCachedVectorMessages()
  );
  const [botAttemptsByBrand, setBotAttemptsByBrand] = useState<Record<string, number>>({});
  const [cartRemindersByBrand, setCartRemindersByBrand] = useState<Record<string, number>>({});

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const threadId = useMemo(
    () => `thread-${activeStore?.id || 'platform'}-${user?.uid?.slice(0, 6) || 'guest'}`,
    [activeStore?.id, user?.uid]
  );

  const brandKey = activeStore?.id || 'platform';
  const brandName = activeStore?.storeName || 'Smith Solutions E-Commerce';
  const brandOwnerUid = activeStore?.ownerUid || user?.uid || 'platform_admin';

  // Persist local conversation cache so chat works & recovers offline
  useEffect(() => {
    saveCachedVectorMessages(messagesByBrand);
  }, [messagesByBrand]);

  // Keep Vector synced with global language
  useEffect(() => {
    setVectorLang(appLang);
  }, [appLang]);

  // Cleanup active neural audio player on unmount
  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);

  // Subscribe to per-brand Section 13 config (strict multi-brand isolation)
  useEffect(() => {
    if (!activeStore?.id) {
      setBrandConfig(defaultVectorBrandConfig('platform', 'Smith Solutions E-Commerce'));
      return;
    }
    const unsub = subscribeVectorBrandConfig(activeStore.id, activeStore.storeName, setBrandConfig);
    return () => unsub();
  }, [activeStore?.id, activeStore?.storeName]);

  // Subscribe to signed-in user's consents and open tickets
  useEffect(() => {
    if (!user || !user.emailVerified) {
      setConsents([]);
      setUserTickets([]);
      return;
    }
    const unsubC = subscribeUserVectorConsents(user.uid, setConsents);
    const unsubT = subscribeUserVectorTickets(user.uid, setUserTickets);
    return () => {
      unsubC();
      unsubT();
    };
  }, [user]);

  const currentConsent: VectorConsentStatus = useMemo(() => {
    const rec = consents.find((c) => c.storeId === brandKey && c.scope === 'buyer_offers');
    return rec ? rec.status : 'no_preguntado';
  }, [consents, brandKey]);

  const openTicketForBrand = useMemo(
    () => userTickets.find((t) => t.storeId === brandKey && t.status !== 'resolved') || null,
    [userTickets, brandKey]
  );

  const currentMessages: VectorChatMessage[] = useMemo(() => {
    const existing = messagesByBrand[brandKey];
    if (existing && existing.length > 0) return existing;

    const greeting =
      vectorLang === 'zh'
        ? VECTOR_IDENTITY.greetings.zh
        : vectorLang === 'en'
          ? VECTOR_IDENTITY.greetings.en
          : brandConfig.tratamientoEs === 'tu'
            ? VECTOR_IDENTITY.greetings.esTu
            : VECTOR_IDENTITY.greetings.es;

    return [
      {
        id: `greet-${brandKey}`,
        role: 'assistant',
        text: greeting,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        language: vectorLang,
      },
    ];
  }, [messagesByBrand, brandKey, vectorLang, brandConfig.tratamientoEs]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentMessages, isOpen]);

  const stopVectorAudio = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setSpeakingMessageId(null);
    setLoadingAudioId(null);
  };

  const playVectorNeuralVoice = async (
    text: string,
    lang: VectorLanguage,
    messageId: string,
    forcePlay = false
  ) => {
    if (!forcePlay && !voiceEnabled) return;
    if (speakingMessageId === messageId) {
      stopVectorAudio();
      return;
    }

    stopVectorAudio();
    setVoiceNotice(null);
    setLoadingAudioId(messageId);

    try {
      const res = await requestVectorTTSAudio({
        text,
        language: lang,
        voiceName: voicePreset,
      });

      if (!res.ok || !res.audioBase64) {
        setLoadingAudioId(null);
        setVoiceNotice(
          lang === 'en'
            ? 'HD Voice requires an active server connection.'
            : lang === 'zh'
              ? '高清语音需要连接网络与服务器。'
              : 'Voz HD neuronal requiere conexión activa.'
        );
        setTimeout(() => setVoiceNotice(null), 4000);
        return;
      }

      const binary = atob(res.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: res.mimeType || 'audio/wav' });
      const blobUrl = URL.createObjectURL(blob);
      audioUrlRef.current = blobUrl;

      const audio = new Audio(blobUrl);
      audioPlayerRef.current = audio;

      audio.onended = () => {
        setSpeakingMessageId(null);
        if (audioUrlRef.current === blobUrl) {
          URL.revokeObjectURL(blobUrl);
          audioUrlRef.current = null;
        }
      };
      audio.onerror = () => {
        setSpeakingMessageId(null);
      };

      setLoadingAudioId(null);
      setSpeakingMessageId(messageId);
      await audio.play();
    } catch {
      setLoadingAudioId(null);
      setSpeakingMessageId(null);
    }
  };

  const persistConsentSafely = async (status: 'si' | 'no' | 'solo_importante') => {
    const isOffline = isAppEffectivelyOffline();
    if (!user || !user.emailVerified || isOffline) {
      queueOfflineMutation({
        type: 'vector_consent',
        label: `Preferencia ofertas (${brandName}: ${status})`,
        payload: {
          storeId: brandKey,
          storeName: brandName,
          storeOwnerUid: brandOwnerUid,
          scope: 'buyer_offers',
          status,
          channel: 'web_chat',
        },
      });
      return;
    }

    try {
      await upsertVectorConsent({
        user,
        storeId: brandKey,
        storeName: brandName,
        storeOwnerUid: brandOwnerUid,
        scope: 'buyer_offers',
        status,
        channel: 'web_chat',
      });
    } catch {
      queueOfflineMutation({
        type: 'vector_consent',
        label: `Preferencia ofertas (${brandName}: ${status})`,
        payload: {
          storeId: brandKey,
          storeName: brandName,
          storeOwnerUid: brandOwnerUid,
          scope: 'buyer_offers',
          status,
          channel: 'web_chat',
        },
      });
    }
  };

  const handleSaveConsent = async (status: 'si' | 'no' | 'solo_importante') => {
    const isOffline = isAppEffectivelyOffline();
    if (!isOffline && (!user || !user.emailVerified)) {
      try {
        await signInWithGoogleAccount();
      } catch {
        // fallback to offline queue if popup dismissed
      }
    }

    await persistConsentSafely(status);

    const confirmText =
      status === 'no'
        ? vectorLang === 'zh'
          ? '已保存：不再接收该品牌的促销通知。'
          : vectorLang === 'en'
            ? 'Saved: commercial offer notifications disabled for this brand.'
            : 'Registrado: detuvimos todas las notificaciones comerciales para esta marca.'
        : status === 'solo_importante'
          ? vectorLang === 'zh'
            ? '已保存：仅接收该品牌的重要通知。'
            : vectorLang === 'en'
              ? 'Saved: important notices only for this brand.'
              : 'Registrado: solo avisos importantes de esta marca.'
          : vectorLang === 'zh'
            ? '已确认：您可以随时回复 STOP 取消通知。'
            : vectorLang === 'en'
              ? 'Confirmed: you can type STOP anytime to unsubscribe.'
              : 'Confirmado: puede escribir «STOP» cuando desee darse de baja.';

    setMessagesByBrand((prev) => ({
      ...prev,
      [brandKey]: [
        ...(prev[brandKey] || currentMessages),
        {
          id: `consent-${Date.now()}`,
          role: 'assistant',
          text: confirmText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          language: vectorLang,
        },
      ],
    }));
  };

  const primaryOwnedStore = ownedStores[0] || null;
  const lastSignalNonceRef = useRef<number>(0);

  const handleSend = async (customText?: string, overrideRole?: UserPlatformRole) => {
    const raw = (customText !== undefined ? customText : inputText).trim();
    if (!raw || isThinking) return;

    if (customText === undefined) setInputText('');

    const effectiveRole = overrideRole || userRole;
    const userMsg: VectorChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: raw,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      language: vectorLang,
    };

    const nextHistory = [...currentMessages, userMsg];
    setMessagesByBrand((prev) => ({ ...prev, [brandKey]: nextHistory }));
    setIsThinking(true);

    const prevAttempts = botAttemptsByBrand[brandKey] || 0;
    const remindersSent = cartRemindersByBrand[brandKey] || 0;
    const cartTotalUSD = activeCart.reduce((acc, i) => acc + i.product.priceUSD * i.quantity, 0);
    const isOffline = isAppEffectivelyOffline();

    try {
      const result = await sendVectorChat({
        message: raw,
        language: vectorLang,
        voiceMode: voiceEnabled,
        brandConfig,
        products: activeProducts,
        exchangeRate,
        cartCount: activeCart.length,
        cartTotalUSD,
        cartRemindersSent: remindersSent,
        offerConsent: currentConsent,
        botAttemptsOnIssue: prevAttempts,
        hasOpenTicket: Boolean(openTicketForBrand),
        history: nextHistory.map((m) => ({ role: m.role, text: m.text })),
        user,
        userRole: effectiveRole,
        currentView,
        hasOwnedStore: ownedStores.length > 0,
        ownedStoreStatus: primaryOwnedStore?.status,
        ownedStoreName: primaryOwnedStore?.storeName,
      });

      if (result.detectedLanguage !== vectorLang) {
        setVectorLang(result.detectedLanguage);
      }

      if (activeCart.length > 0 && result.leversUsed.includes('aversion_perdida')) {
        setCartRemindersByBrand((prev) => ({
          ...prev,
          [brandKey]: Math.min(2, (prev[brandKey] || 0) + 1),
        }));
      }

      // Persist opt-in/opt-out consent if captured via text (with offline queue fallback)
      if (result.consentIntent !== 'none') {
        await persistConsentSafely(result.consentIntent);
      }

      let ticketNumber: string | undefined;
      let handoffPacketText: string | undefined;
      let adminReportText: string | undefined;

      // Handle Escalation Trigger (N1-N4)
      if (result.triggerId > 0) {
        const triggerMatch = detectEscalationTrigger(raw, prevAttempts);
        if (triggerMatch) {
          if (user && user.emailVerified && !isOffline) {
            try {
              const created = await createOrUpdateVectorTicket({
                user,
                storeId: brandKey,
                storeName: brandName,
                storeOwnerUid: brandOwnerUid,
                channel: 'web_chat',
                language: result.detectedLanguage,
                trigger: triggerMatch.trigger,
                summary: raw,
                botAttempts: prevAttempts,
                lastProposal: result.reply,
                offerConsent: currentConsent,
                risk: triggerMatch.risk,
                threadId,
              });
              ticketNumber = created.ticket.ticketNumber;
              handoffPacketText = created.ticket.handoffPacket;
              adminReportText = created.ticket.adminReport;

              await recordVectorConversationStat({
                user,
                storeId: brandKey,
                storeOwnerUid: brandOwnerUid,
                language: result.detectedLanguage,
                turnsCount: nextHistory.length + 1,
                botAttemptsOnIssue: prevAttempts,
                containedByBot: false,
                escalated: true,
                triggerId: triggerMatch.trigger.id,
              });
            } catch {
              queueOfflineMutation({
                type: 'vector_ticket',
                label: `Ticket soporte ${brandName}`,
                payload: {
                  storeId: brandKey,
                  storeName: brandName,
                  storeOwnerUid: brandOwnerUid,
                  channel: 'web_chat',
                  language: result.detectedLanguage,
                  trigger: triggerMatch.trigger,
                  summary: raw,
                  botAttempts: prevAttempts,
                  lastProposal: result.reply,
                  offerConsent: currentConsent,
                  risk: triggerMatch.risk,
                  threadId,
                },
              });
              ticketNumber = `VEC-LOCAL-${Date.now().toString().slice(-4)}`;
            }
          } else {
            queueOfflineMutation({
              type: 'vector_ticket',
              label: `Ticket soporte ${brandName}`,
              payload: {
                storeId: brandKey,
                storeName: brandName,
                storeOwnerUid: brandOwnerUid,
                channel: 'web_chat',
                language: result.detectedLanguage,
                trigger: triggerMatch.trigger,
                summary: raw,
                botAttempts: prevAttempts,
                lastProposal: result.reply,
                offerConsent: currentConsent,
                risk: triggerMatch.risk,
                threadId,
              },
            });
            ticketNumber = `VEC-LOCAL-${Date.now().toString().slice(-4)}`;
          }
        }
        setBotAttemptsByBrand((prev) => ({ ...prev, [brandKey]: 0 }));
      } else {
        setBotAttemptsByBrand((prev) => ({ ...prev, [brandKey]: prevAttempts + 1 }));
        if (nextHistory.length === 2) {
          if (user && user.emailVerified && !isOffline) {
            recordVectorConversationStat({
              user,
              storeId: brandKey,
              storeOwnerUid: brandOwnerUid,
              language: result.detectedLanguage,
              turnsCount: 2,
              botAttemptsOnIssue: 1,
              containedByBot: true,
              escalated: false,
            }).catch(() => {});
          } else if (user && user.emailVerified) {
            queueOfflineMutation({
              type: 'vector_stat',
              label: `Métrica Vector ${brandName}`,
              payload: {
                storeId: brandKey,
                storeOwnerUid: brandOwnerUid,
                language: result.detectedLanguage,
                turnsCount: 2,
                botAttemptsOnIssue: 1,
                containedByBot: true,
                escalated: false,
              },
            });
          }
        }
      }

      const botMsgId = `a-${Date.now()}`;
      const botMsg: VectorChatMessage = {
        id: botMsgId,
        role: 'assistant',
        text: result.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        language: result.detectedLanguage,
        leversUsed: result.leversUsed,
        leverEvidence: result.leverEvidence,
        recommendedProductIds: result.recommendedProductIds,
        suggestedActions: result.suggestedActions,
        escalationTicketNumber: ticketNumber,
        handoffPacketText,
        adminReportText,
        blockedSecurityNotice: result.blockedSecurityNotice,
      };

      setMessagesByBrand((prev) => ({
        ...prev,
        [brandKey]: [...nextHistory, botMsg],
      }));

      if (voiceEnabled) {
        playVectorNeuralVoice(result.reply, result.detectedLanguage, botMsgId, true);
      }
    } finally {
      setIsThinking(false);
    }
  };

  useEffect(() => {
    if (!openSignal || openSignal.nonce === lastSignalNonceRef.current) return;
    lastSignalNonceRef.current = openSignal.nonce;
    if (openSignal.role) {
      onChangeUserRole(openSignal.role);
    }
    setIsOpen(true);
    if (openSignal.autoPrompt) {
      handleSend(openSignal.autoPrompt, openSignal.role);
    }
  }, [openSignal]);

  const handleSuggestedAction = async (action: VectorSuggestedAction) => {
    if (action.type === 'navigate_merchant') {
      onChangeUserRole('seller');
      onNavigateView('merchant');
      setIsOpen(false);
      return;
    }
    if (action.type === 'navigate_marketplace') {
      onChangeUserRole('buyer');
      onNavigateView('marketplace');
      setIsOpen(false);
      return;
    }
    if (action.type === 'prompt_google_auth') {
      try {
        await signInWithGoogleAccount();
        onChangeUserRole('seller');
        onNavigateView('merchant');
        setIsOpen(false);
      } catch {
        // user dismissed popup or redirect initiated
      }
    }
  };

  const uiCopy = {
    es: {
      assistantTitle: 'Vector · Asistente Comercial',
      subtitle: 'La dirección correcta, en el momento exacto',
      launcherBuyer: 'Comprador y Registro',
      launcherSeller: 'Guía Registro Tienda',
      roleLabel: 'Tu perfil:',
      roleBuyer: 'Comprador',
      roleSeller: 'Vendedor · Crear Tienda',
      isolatedBrand: 'Marca aislada:',
      adminVerified: 'Super Admin Verificado',
      thinking: 'Vector analizando contexto verificado...',
      voiceLabel: 'Voz HD:',
      listenBtn: 'Escuchar',
      stopBtn: 'Detener',
      inputPlaceholder: 'Pregunta cómo comprar, registrar tienda, envíos o escribe en ES / EN / 中文...',
      addCart: '+ Carrito',
      openCart: 'Ir a Carrito',
      consentLabel: 'Notificaciones de ofertas de esta marca:',
      consentYes: 'Sí',
      consentImportant: 'Solo importante',
      consentNo: 'No / STOP',
      quickCatalog: 'Ver catálogo',
      quickShipping: 'Envíos',
      quickHuman: 'Hablar con humano',
      quickRegisterGuide: 'Guía registrar tienda',
      quickStep2: 'Paso 2: RIF y datos',
      quickStep3: 'Paso 3: Pago $25/mes',
      quickHowBuy: '¿Cómo comprar?',
      quickBrowseStores: 'Ver tiendas activas',
      quickBecomeSeller: 'Quiero vender',
    },
    en: {
      assistantTitle: 'Vector · Commercial Assistant',
      subtitle: 'The right direction, at the exact moment',
      launcherBuyer: 'Buyer & Onboarding',
      launcherSeller: 'Store Registration Guide',
      roleLabel: 'Your role:',
      roleBuyer: 'Buyer',
      roleSeller: 'Seller · Open Store',
      isolatedBrand: 'Isolated brand:',
      adminVerified: 'Verified Super Admin',
      thinking: 'Vector analyzing verified context...',
      voiceLabel: 'HD Voice:',
      listenBtn: 'Listen',
      stopBtn: 'Stop',
      inputPlaceholder: 'Ask how to buy, register a store, shipping, or switch ES / EN / 中文...',
      addCart: '+ Add Cart',
      openCart: 'Open Cart',
      consentLabel: 'Brand offer notifications:',
      consentYes: 'Yes',
      consentImportant: 'Important only',
      consentNo: 'No / STOP',
      quickCatalog: 'Browse catalog',
      quickShipping: 'Shipping',
      quickHuman: 'Human agent',
      quickRegisterGuide: 'Store setup guide',
      quickStep2: 'Step 2: Tax ID & details',
      quickStep3: 'Step 3: $25/mo payment',
      quickHowBuy: 'How to buy?',
      quickBrowseStores: 'Browse active stores',
      quickBecomeSeller: 'I want to sell',
    },
    zh: {
      assistantTitle: '维克托（Vector）· 商务助手',
      subtitle: '精准方向，恰逢其时',
      launcherBuyer: '买家与开店向导',
      launcherSeller: '开店注册向导',
      roleLabel: '当前身份：',
      roleBuyer: '买家',
      roleSeller: '卖家 · 我要开店',
      isolatedBrand: '隔离品牌：',
      adminVerified: '已验证超级管理员',
      thinking: '维克托正在核对品牌实时数据...',
      voiceLabel: '高清语音：',
      listenBtn: '朗读',
      stopBtn: '停止',
      inputPlaceholder: '咨询如何购物、注册店铺、配送，或随时切换 中文 / ES / EN...',
      addCart: '+ 加入购物车',
      openCart: '打开购物车',
      consentLabel: '本品牌优惠通知授权：',
      consentYes: '同意',
      consentImportant: '仅重要通知',
      consentNo: '拒绝 / STOP',
      quickCatalog: '查看现货',
      quickShipping: '配送政策',
      quickHuman: '转接人工',
      quickRegisterGuide: '开店注册指南',
      quickStep2: '第2步：税号与资料',
      quickStep3: '第3步：$25月费支付',
      quickHowBuy: '如何下单购买？',
      quickBrowseStores: '查看已激活店铺',
      quickBecomeSeller: '我想开店卖货',
    },
  }[vectorLang];

  return (
    <>
      {/* Floating Launcher (Positioned bottom-left above safe-area bottom nav on phones) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label={uiCopy.assistantTitle}
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-5 left-3 md:left-5 z-40 flex items-center gap-2 sm:gap-2.5 px-3 sm:px-3.5 py-2.5 min-h-[48px] rounded-full sm:rounded-xl bg-[#111114] hover:bg-zinc-900 active:scale-95 border border-amber-400/35 text-zinc-100 shadow-2xl shadow-black/80 transition-all group"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full sm:rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
            <Compass className="w-4 h-4" />
          </div>
          <div className="text-left">
            <div className="text-xs font-bold tracking-tight text-zinc-50 flex items-center gap-1">
              <span>Vector</span>
              <span className="text-[10px] font-mono text-amber-400 hidden sm:inline">维克托</span>
            </div>
            <div className="text-[10px] text-zinc-400 truncate max-w-[110px] sm:max-w-[140px] hidden sm:block">
              {activeStore
                ? activeStore.storeName
                : userRole === 'seller'
                  ? uiCopy.launcherSeller
                  : uiCopy.launcherBuyer}
            </div>
          </div>
        </button>
      )}

      {/* Slide-up Obsidian Noir Drawer */}
      {isOpen && (
        <aside className="fixed inset-x-2 top-16 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] sm:top-auto sm:inset-auto sm:left-5 sm:bottom-5 sm:w-[430px] sm:h-[585px] sm:max-h-[84dvh] z-[60] bg-[#0c0c0f] border border-white/[0.12] rounded-2xl shadow-2xl shadow-black flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-[#111114] border-b border-white/[0.08] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                <Compass className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-bold text-zinc-50 truncate">{uiCopy.assistantTitle}</h2>
                <p className="text-[10px] text-zinc-400 truncate">{uiCopy.subtitle}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {(['es', 'en', 'zh'] as VectorLanguage[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => {
                    setVectorLang(code);
                    setAppLang(code);
                  }}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase border transition-colors ${
                    vectorLang === code
                      ? 'bg-amber-400/20 border-amber-400/40 text-amber-300 font-bold'
                      : 'bg-zinc-900 border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {code === 'zh' ? '中文' : code}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const next = !voiceEnabled;
                  setVoiceEnabled(next);
                  if (!next) stopVectorAudio();
                }}
                title="Voz HD Vector"
                className="min-w-[36px] min-h-[36px] p-1.5 rounded-lg bg-zinc-900 border border-white/[0.08] text-zinc-400 hover:text-amber-400 flex items-center justify-center"
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-w-[36px] min-h-[36px] p-1.5 rounded-lg bg-zinc-900 border border-white/[0.08] text-zinc-400 hover:text-zinc-100 flex items-center justify-center"
                aria-label="Cerrar asistente"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Buyer vs. Seller Mode Switcher Bar */}
          <div className="px-3.5 py-1.5 bg-[#0e0e12] border-b border-white/[0.07] flex items-center justify-between gap-2 text-[10px]">
            <span className="text-zinc-400 shrink-0">{uiCopy.roleLabel}</span>
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => onChangeUserRole('buyer')}
                className={`px-2.5 py-1 rounded-md border text-[10px] font-semibold whitespace-nowrap flex items-center gap-1 transition-colors ${
                  userRole === 'buyer'
                    ? 'bg-zinc-800 border-zinc-500/60 text-white'
                    : 'bg-zinc-950 border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <ShoppingBag className="w-3 h-3 text-amber-400" />
                <span>{uiCopy.roleBuyer}</span>
              </button>
              <button
                type="button"
                onClick={() => onChangeUserRole('seller')}
                className={`px-2.5 py-1 rounded-md border text-[10px] font-semibold whitespace-nowrap flex items-center gap-1 transition-colors ${
                  userRole === 'seller'
                    ? 'bg-amber-400/20 border-amber-400/50 text-amber-300'
                    : 'bg-zinc-950 border-white/[0.08] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Store className="w-3 h-3 text-amber-400" />
                <span>{uiCopy.roleSeller}</span>
              </button>
            </div>
          </div>

          {/* Strict Brand Isolation + Neural Voice Bar */}
          <div className="px-3.5 py-1.5 bg-zinc-950 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-[10px]">
            <div className="flex items-center gap-1.5 text-zinc-400 truncate">
              <Globe2 className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{uiCopy.isolatedBrand}</span>
              <span className="font-semibold text-zinc-200 truncate">{brandName}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label className="flex items-center gap-1 text-zinc-400">
                <span>{uiCopy.voiceLabel}</span>
                <select
                  value={voicePreset}
                  onChange={(e) => {
                    const next = e.target.value as VectorVoicePreset;
                    setVoicePreset(next);
                    saveVectorVoicePreset(next);
                  }}
                  className="bg-zinc-900 border border-white/[0.1] rounded px-1.5 py-0.5 text-[10px] text-amber-300 font-mono focus:outline-none"
                >
                  {VOICE_OPTIONS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>

              {isSuperAdminUser(user) && (
                <span className="flex items-center gap-1 text-emerald-400 font-mono shrink-0">
                  <UserCheck className="w-3 h-3" />
                  <span>{uiCopy.adminVerified}</span>
                </span>
              )}
            </div>
          </div>

          {voiceNotice && (
            <div className="px-3.5 py-1 bg-amber-950/60 border-b border-amber-500/30 text-[10px] text-amber-200 font-mono">
              {voiceNotice}
            </div>
          )}

          {/* Open Ticket Indicator */}
          {openTicketForBrand && (
            <div className="px-3.5 py-1.5 bg-amber-400/10 border-b border-amber-400/20 flex items-center justify-between text-[10px] text-amber-300">
              <span className="font-mono">
                Ticket {openTicketForBrand.ticketNumber} · {openTicketForBrand.level} ({openTicketForBrand.priority})
              </span>
              <span>SLA {openTicketForBrand.slaMinutes} min</span>
            </div>
          )}

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#09090b]">
            {currentMessages.map((msg) => {
              const recommended = (msg.recommendedProductIds || [])
                .map((id) => activeProducts.find((p) => p.id === id))
                .filter((p): p is StoreProduct => Boolean(p));

              const isPlaying = speakingMessageId === msg.id;
              const isLoadingVoice = loadingAudioId === msg.id;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line ${
                      msg.role === 'user'
                        ? 'bg-amber-400 text-zinc-950 font-medium'
                        : msg.blockedSecurityNotice
                          ? 'bg-rose-950/60 border border-rose-500/40 text-rose-200'
                          : 'bg-[#111114] border border-white/[0.08] text-zinc-200'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Interactive Guided Navigation Actions */}
                  {msg.role === 'assistant' && msg.suggestedActions && msg.suggestedActions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 max-w-[90%]">
                      {msg.suggestedActions.map((act, idx) => (
                        <button
                          key={`${msg.id}-act-${idx}`}
                          type="button"
                          onClick={() => handleSuggestedAction(act)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                            act.type === 'navigate_merchant' || act.type === 'prompt_google_auth'
                              ? 'bg-amber-400 hover:bg-amber-300 text-zinc-950'
                              : 'bg-[#111114] hover:bg-zinc-800 border border-white/[0.12] text-zinc-100'
                          }`}
                        >
                          {act.type === 'prompt_google_auth' ? (
                            <LogIn className="w-3 h-3 shrink-0" />
                          ) : act.type === 'navigate_merchant' ? (
                            <Store className="w-3 h-3 shrink-0" />
                          ) : (
                            <ExternalLink className="w-3 h-3 shrink-0 text-amber-400" />
                          )}
                          <span>{act.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Verified Catalog Cards (Only for active isolated store) */}
                  {recommended.length > 0 && (
                    <div className="mt-2 w-[88%] space-y-1.5">
                      {recommended.map((prod) => (
                        <div
                          key={prod.id}
                          className="p-2 rounded-lg bg-[#111114] border border-white/[0.08] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-[11px] font-semibold text-zinc-100 truncate">
                              {prod.name}
                            </div>
                            <div className="text-[10px] font-mono text-amber-400 tabular-nums">
                              ${prod.priceUSD.toFixed(2)} · {(prod.priceUSD * exchangeRate).toFixed(2)} Bs · Stock: {prod.stock}
                            </div>
                          </div>
                          {onAddProductToCart && prod.stock > 0 && (
                            <button
                              type="button"
                              onClick={() => onAddProductToCart(prod)}
                              className="px-2 py-1 rounded bg-amber-400 hover:bg-amber-300 text-zinc-950 text-[10px] font-bold shrink-0"
                            >
                              {uiCopy.addCart}
                            </button>
                          )}
                        </div>
                      ))}
                      {activeCart.length > 0 && onOpenCartDrawer && (
                        <button
                          type="button"
                          onClick={onOpenCartDrawer}
                          className="w-full py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-amber-400/30 text-amber-300 text-[10px] font-semibold flex items-center justify-center gap-1"
                        >
                          <ShoppingCart className="w-3 h-3" />
                          <span>
                            {uiCopy.openCart} ({activeCart.length})
                          </span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Verified Levers Evidence */}
                  {msg.leversUsed && msg.leversUsed.length > 0 && msg.leverEvidence && msg.leverEvidence.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1 max-w-[88%]">
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono text-zinc-500">
                        <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                        Respaldo real: {msg.leverEvidence[0]}
                      </span>
                    </div>
                  )}

                  {/* Escalation Packet + Admin Report Notice */}
                  {msg.escalationTicketNumber && (
                    <div className="mt-1.5 w-[88%] p-2 rounded-lg bg-zinc-950 border border-amber-400/30 text-[10px] text-zinc-300 space-y-1">
                      <div className="font-mono font-bold text-amber-400 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        <span>Traspaso {msg.escalationTicketNumber} registrado</span>
                      </div>
                      {msg.handoffPacketText && (
                        <p className="text-[9px] text-zinc-400 break-words">{msg.handoffPacketText}</p>
                      )}
                    </div>
                  )}

                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="text-[9px] text-zinc-600 font-mono">{msg.timestamp}</span>
                    {msg.role === 'assistant' && (
                      <button
                        type="button"
                        onClick={() =>
                          playVectorNeuralVoice(msg.text, msg.language || vectorLang, msg.id, true)
                        }
                        className="inline-flex items-center gap-1 text-[9px] font-mono text-zinc-400 hover:text-amber-300 transition-colors"
                      >
                        {isLoadingVoice ? (
                          <Loader2 className="w-2.5 h-2.5 animate-spin text-amber-400" />
                        ) : isPlaying ? (
                          <Square className="w-2.5 h-2.5 text-amber-400" />
                        ) : (
                          <Play className="w-2.5 h-2.5 text-amber-400" />
                        )}
                        <span>{isPlaying ? uiCopy.stopBtn : uiCopy.listenBtn}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {isThinking && (
              <div className="text-[11px] text-zinc-500 font-mono animate-pulse">
                {uiCopy.thinking}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Persistent Offer Consent Capture Bar (§1.3 & §12) */}
          <div className="px-3 py-1.5 bg-[#111114] border-t border-white/[0.06] flex items-center justify-between gap-2 text-[10px]">
            <span className="text-zinc-400 truncate">{uiCopy.consentLabel}</span>
            <div className="flex items-center gap-1 shrink-0">
              {currentConsent === 'no' ? (
                <span className="flex items-center gap-1 text-zinc-400 font-mono">
                  <BellOff className="w-3 h-3 text-rose-400" /> STOP activo
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleSaveConsent('si')}
                    className={`px-1.5 py-0.5 rounded border text-[9px] ${
                      currentConsent === 'si'
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-zinc-900 border-white/[0.08] text-zinc-300 hover:text-white'
                    }`}
                  >
                    {uiCopy.consentYes}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveConsent('solo_importante')}
                    className={`px-1.5 py-0.5 rounded border text-[9px] ${
                      currentConsent === 'solo_importante'
                        ? 'bg-amber-400/20 border-amber-400/40 text-amber-300'
                        : 'bg-zinc-900 border-white/[0.08] text-zinc-300 hover:text-white'
                    }`}
                  >
                    {uiCopy.consentImportant}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveConsent('no')}
                    className="px-1.5 py-0.5 rounded border bg-zinc-900 border-white/[0.08] text-zinc-400 hover:text-rose-300 text-[9px]"
                  >
                    {uiCopy.consentNo}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Contextual Quick Chips (Role & Storefront Aware) */}
          <div className="px-3 py-1.5 bg-[#0c0c0f] border-t border-white/[0.05] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {activeStore ? (
              <>
                <button
                  type="button"
                  onClick={() => handleSend(uiCopy.quickCatalog)}
                  className="px-2.5 py-1.5 min-h-[34px] rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-[11px] sm:text-[10px] text-zinc-300 whitespace-nowrap"
                >
                  {uiCopy.quickCatalog}
                </button>
                <button
                  type="button"
                  onClick={() => handleSend(uiCopy.quickShipping)}
                  className="px-2.5 py-1.5 min-h-[34px] rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-[11px] sm:text-[10px] text-zinc-300 whitespace-nowrap"
                >
                  {uiCopy.quickShipping}
                </button>
              </>
            ) : userRole === 'seller' ? (
              <>
                <button
                  type="button"
                  onClick={() => handleSend(uiCopy.quickRegisterGuide)}
                  className="px-2.5 py-1.5 min-h-[34px] rounded-md bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-[11px] sm:text-[10px] text-amber-300 font-semibold whitespace-nowrap"
                >
                  {uiCopy.quickRegisterGuide}
                </button>
                <button
                  type="button"
                  onClick={() => handleSend(uiCopy.quickStep2)}
                  className="px-2.5 py-1.5 min-h-[34px] rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-[11px] sm:text-[10px] text-zinc-300 whitespace-nowrap"
                >
                  {uiCopy.quickStep2}
                </button>
                <button
                  type="button"
                  onClick={() => handleSend(uiCopy.quickStep3)}
                  className="px-2.5 py-1.5 min-h-[34px] rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-[11px] sm:text-[10px] text-zinc-300 whitespace-nowrap"
                >
                  {uiCopy.quickStep3}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSend(uiCopy.quickHowBuy)}
                  className="px-2.5 py-1.5 min-h-[34px] rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-[11px] sm:text-[10px] text-zinc-300 whitespace-nowrap"
                >
                  {uiCopy.quickHowBuy}
                </button>
                <button
                  type="button"
                  onClick={() => handleSend(uiCopy.quickRegisterGuide, 'seller')}
                  className="px-2.5 py-1.5 min-h-[34px] rounded-md bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/35 text-[11px] sm:text-[10px] text-amber-300 font-semibold whitespace-nowrap"
                >
                  {uiCopy.quickRegisterGuide}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChangeUserRole('buyer');
                    onNavigateView('marketplace');
                    setIsOpen(false);
                  }}
                  className="px-2.5 py-1.5 min-h-[34px] rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-[11px] sm:text-[10px] text-zinc-300 whitespace-nowrap"
                >
                  {uiCopy.quickBrowseStores}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() =>
                handleSend(
                  vectorLang === 'zh'
                    ? '请帮我转接人工客服'
                    : vectorLang === 'en'
                      ? 'I want to talk to a human agent'
                      : 'Quiero hablar con una persona'
                )
              }
              className="px-2.5 py-1.5 min-h-[34px] rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-[11px] sm:text-[10px] text-amber-300 whitespace-nowrap"
            >
              {uiCopy.quickHuman}
            </button>
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-2.5 bg-[#111114] border-t border-white/[0.08] flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={uiCopy.inputPlaceholder}
              className="flex-1 min-h-[42px] bg-zinc-950 border border-white/[0.1] rounded-xl px-3 py-2 text-base sm:text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400/50"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isThinking}
              className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 disabled:opacity-40 text-zinc-950 transition-all flex items-center justify-center shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </aside>
      )}
    </>
  );
};
