import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  where,
  writeBatch,
  Unsubscribe,
} from 'firebase/firestore';
import { signInWithPopup, signOut, User } from 'firebase/auth';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  SUPER_ADMIN_EMAIL,
} from '../firebase';
import {
  AdminEmailDispatch,
  EmailDeliveryChannel,
  PlatformBillingSettings,
  ReferralCodeLookup,
  ReferralCoupon,
  StoreCartItem,
  StoreInboxMessage,
  StoreOrder,
  StoreOrderItem,
  StoreProduct,
  StoreReferral,
  StoreStatus,
  StoreTenant,
  SubscriptionPayment,
  SubscriptionPaymentMethod,
} from '../types';

export const DEFAULT_BILLING_SETTINGS: PlatformBillingSettings = {
  monthlyPriceUSD: 25,
  bankTransfers:
    'Por configurar por el Administrador (empresaalhadiqainvest@gmail.com). Solicita los datos bancarios actualizados por WhatsApp o espera la carga oficial.',
  pagoMovil: 'Por configurar por el Administrador en el Panel Admin.',
  binancePay: 'Por configurar (Binance Pay ID / Correo USDT TRC20).',
  bybitPay: 'Por configurar (Bybit UID / Correo interno sin comisión).',
  supportWhatsapp: '+584220273766',
  warehousePosEnabled: false,
  referralRewardUSD: 25,
};

export function isSuperAdminUser(user: User | null | undefined): boolean {
  return Boolean(
    user &&
      user.emailVerified &&
      user.email &&
      user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
  );
}

export async function signInWithGoogleAccount(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  if (isSuperAdminUser(result.user)) {
    await ensureSuperAdminRecord(result.user);
  }
  return result.user;
}

export async function signOutAccount(): Promise<void> {
  await signOut(auth);
}

export function slugifyStoreName(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base.length >= 2 ? base : `tienda-${Date.now().toString().slice(-6)}`;
}

export function makeSafeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Compresses an uploaded image file to JPEG DataURL (max 420px, <= ~60KB) so it safely fits Firestore limits (< 150KB)
 */
export function compressImageFileToDataURL(
  file: File,
  maxDimension = 420,
  quality = 0.72
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo no es una imagen válida.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas no disponible para compresión de imagen.'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length > 140000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.48);
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

// -----------------------------------------------------------------------------
// Super Admin & Billing Settings
// -----------------------------------------------------------------------------

export async function ensureSuperAdminRecord(user: User): Promise<void> {
  if (!isSuperAdminUser(user)) return;
  const path = `admins/${user.uid}`;
  try {
    const ref = doc(db, 'admins', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email: user.email || SUPER_ADMIN_EMAIL,
        role: 'superadmin',
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getPlatformBillingSettings(): Promise<PlatformBillingSettings> {
  const path = 'platformSettings/billing';
  try {
    const ref = doc(db, 'platformSettings', 'billing');
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return DEFAULT_BILLING_SETTINGS;
    }
    const data = snap.data() as Partial<PlatformBillingSettings>;
    return {
      monthlyPriceUSD: typeof data.monthlyPriceUSD === 'number' ? data.monthlyPriceUSD : 25,
      bankTransfers: data.bankTransfers || DEFAULT_BILLING_SETTINGS.bankTransfers,
      pagoMovil: data.pagoMovil || DEFAULT_BILLING_SETTINGS.pagoMovil,
      binancePay: data.binancePay || DEFAULT_BILLING_SETTINGS.binancePay,
      bybitPay: data.bybitPay || DEFAULT_BILLING_SETTINGS.bybitPay,
      supportWhatsapp: data.supportWhatsapp || DEFAULT_BILLING_SETTINGS.supportWhatsapp,
      warehousePosEnabled: Boolean(data.warehousePosEnabled),
      referralRewardUSD: typeof data.referralRewardUSD === 'number' ? data.referralRewardUSD : 25,
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    console.warn('No se pudo leer platformSettings/billing, usando configuración base.', error);
    return DEFAULT_BILLING_SETTINGS;
  }
}

export function subscribePlatformBillingSettings(
  onData: (settings: PlatformBillingSettings) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'platformSettings', 'billing'),
    (snap) => {
      if (!snap.exists()) {
        onData(DEFAULT_BILLING_SETTINGS);
        return;
      }
      const data = snap.data() as Partial<PlatformBillingSettings>;
      onData({
        monthlyPriceUSD: typeof data.monthlyPriceUSD === 'number' ? data.monthlyPriceUSD : 25,
        bankTransfers: data.bankTransfers || DEFAULT_BILLING_SETTINGS.bankTransfers,
        pagoMovil: data.pagoMovil || DEFAULT_BILLING_SETTINGS.pagoMovil,
        binancePay: data.binancePay || DEFAULT_BILLING_SETTINGS.binancePay,
        bybitPay: data.bybitPay || DEFAULT_BILLING_SETTINGS.bybitPay,
        supportWhatsapp: data.supportWhatsapp || DEFAULT_BILLING_SETTINGS.supportWhatsapp,
        warehousePosEnabled: Boolean(data.warehousePosEnabled),
        referralRewardUSD: typeof data.referralRewardUSD === 'number' ? data.referralRewardUSD : 25,
        updatedAt: data.updatedAt,
      });
    },
    () => {
      onData(DEFAULT_BILLING_SETTINGS);
    }
  );
}

export async function savePlatformBillingSettings(
  settings: PlatformBillingSettings
): Promise<void> {
  const path = 'platformSettings/billing';
  try {
    const ref = doc(db, 'platformSettings', 'billing');
    await setDoc(ref, {
      monthlyPriceUSD: Number(settings.monthlyPriceUSD) || 25,
      bankTransfers: settings.bankTransfers.trim().slice(0, 1000) || DEFAULT_BILLING_SETTINGS.bankTransfers,
      pagoMovil: settings.pagoMovil.trim().slice(0, 500) || DEFAULT_BILLING_SETTINGS.pagoMovil,
      binancePay: settings.binancePay.trim().slice(0, 300) || DEFAULT_BILLING_SETTINGS.binancePay,
      bybitPay: settings.bybitPay.trim().slice(0, 300) || DEFAULT_BILLING_SETTINGS.bybitPay,
      supportWhatsapp: settings.supportWhatsapp.trim().slice(0, 40) || '+584220273766',
      warehousePosEnabled: Boolean(settings.warehousePosEnabled),
      referralRewardUSD:
        typeof settings.referralRewardUSD === 'number' && !Number.isNaN(settings.referralRewardUSD)
          ? Math.max(0, Math.min(1000, Number(settings.referralRewardUSD)))
          : 25,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function adminSetGlobalWarehousePos(
  enabled: boolean,
  currentSettings?: PlatformBillingSettings
): Promise<void> {
  const base = currentSettings || (await getPlatformBillingSettings());
  await savePlatformBillingSettings({
    ...base,
    warehousePosEnabled: enabled,
  });
}

// -----------------------------------------------------------------------------
// Store Tenant Registration, Updates & Subscriptions
// -----------------------------------------------------------------------------

export interface StoreRegistrationInput {
  storeName: string;
  registeredOwnerName: string;
  rif?: string;
  logoUrl?: string;
  businessWhatsapp: string;
  category?: string;
  description?: string;
  nationalShippingEnabled: boolean;
  nationalCouriers?: string;
  localDeliveryEnabled: boolean;
  localDeliveryFeeUSD?: number;
  localDeliveryZone?: string;
  pickupEnabled: boolean;
  referredByCode?: string;
}

export function normalizeReferralCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, '')
    .slice(0, 32);
}

export function generateStoreReferralCode(storeName: string, storeId: string): string {
  const cleanPrefix = slugifyStoreName(storeName)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6) || 'TIENDA';
  const suffix = storeId
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(-4);
  const rand = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  return `SM-${cleanPrefix}-${suffix}${rand}`.slice(0, 32);
}

export async function resolveReferralCode(code: string): Promise<ReferralCodeLookup | null> {
  const normalized = normalizeReferralCode(code);
  if (normalized.length < 4) return null;
  try {
    const snap = await getDoc(doc(db, 'referralCodes', normalized));
    if (!snap.exists()) return null;
    return snap.data() as ReferralCodeLookup;
  } catch {
    return null;
  }
}

export async function ensureStoreReferralCode(store: StoreTenant): Promise<string> {
  if (store.referralCode && store.referralCode.length >= 4) {
    return store.referralCode;
  }
  const code = generateStoreReferralCode(store.storeName, store.id);
  const path = `stores/${store.id}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'stores', store.id), {
      referralCode: code,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'referralCodes', code), {
      code,
      storeId: store.id,
      storeName: store.storeName.trim().slice(0, 100),
      ownerUid: store.ownerUid,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
    return code;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

function buildCleanStoreOptionalFields(input: Partial<StoreRegistrationInput>): Record<string, unknown> {
  const optional: Record<string, unknown> = {};
  if (input.rif && input.rif.trim()) optional.rif = input.rif.trim().slice(0, 30);
  if (input.logoUrl && input.logoUrl.trim()) optional.logoUrl = input.logoUrl.trim().slice(0, 150000);
  if (input.category && input.category.trim()) optional.category = input.category.trim().slice(0, 60);
  if (input.description && input.description.trim())
    optional.description = input.description.trim().slice(0, 500);
  if (input.nationalCouriers && input.nationalCouriers.trim())
    optional.nationalCouriers = input.nationalCouriers.trim().slice(0, 200);
  if (typeof input.localDeliveryFeeUSD === 'number' && !Number.isNaN(input.localDeliveryFeeUSD)) {
    optional.localDeliveryFeeUSD = Math.max(0, Math.min(500, Number(input.localDeliveryFeeUSD)));
  }
  if (input.localDeliveryZone && input.localDeliveryZone.trim())
    optional.localDeliveryZone = input.localDeliveryZone.trim().slice(0, 150);
  return optional;
}

export async function registerStoreTenant(
  user: User,
  input: StoreRegistrationInput
): Promise<StoreTenant> {
  const storeId = makeSafeDocId('store');
  const slug = `${slugifyStoreName(input.storeName)}-${storeId.slice(-4)}`;
  const myReferralCode = generateStoreReferralCode(input.storeName, storeId);
  const path = `stores/${storeId}`;

  let matchedReferrer: ReferralCodeLookup | null = null;
  if (input.referredByCode && input.referredByCode.trim()) {
    const cleanRef = normalizeReferralCode(input.referredByCode);
    if (cleanRef.length >= 4) {
      matchedReferrer = await resolveReferralCode(cleanRef);
      if (!matchedReferrer) {
        throw new Error(`El código de referido "${cleanRef}" no existe o no es válido.`);
      }
      if (matchedReferrer.ownerUid === user.uid) {
        throw new Error('No puedes usar tu propio código de referido en tu misma cuenta.');
      }
    }
  }

  const payload: Record<string, unknown> = {
    id: storeId,
    slug,
    ownerUid: user.uid,
    storeName: input.storeName.trim().slice(0, 100),
    registeredOwnerName: input.registeredOwnerName.trim().slice(0, 100),
    businessWhatsapp: input.businessWhatsapp.trim().slice(0, 25),
    status: 'pending' as StoreStatus,
    subscriptionPriceUSD: 25,
    nationalShippingEnabled: Boolean(input.nationalShippingEnabled),
    localDeliveryEnabled: Boolean(input.localDeliveryEnabled),
    pickupEnabled: Boolean(input.pickupEnabled),
    referralCode: myReferralCode,
    ...buildCleanStoreOptionalFields(input),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (matchedReferrer) {
    payload.referredByCode = matchedReferrer.code;
    payload.referredByStoreId = matchedReferrer.storeId;
    payload.referredByStoreName = matchedReferrer.storeName;
    payload.referralRewardGranted = false;
  }

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'stores', storeId), payload);
    batch.set(doc(db, 'referralCodes', myReferralCode), {
      code: myReferralCode,
      storeId,
      storeName: input.storeName.trim().slice(0, 100),
      ownerUid: user.uid,
      createdAt: serverTimestamp(),
    });

    if (matchedReferrer) {
      const referralId = makeSafeDocId('ref');
      batch.set(doc(db, 'referrals', referralId), {
        id: referralId,
        referrerStoreId: matchedReferrer.storeId,
        referrerStoreName: matchedReferrer.storeName.trim().slice(0, 100),
        referrerOwnerUid: matchedReferrer.ownerUid,
        referrerCode: matchedReferrer.code,
        referredStoreId: storeId,
        referredStoreName: input.storeName.trim().slice(0, 100),
        referredOwnerUid: user.uid,
        status: 'registered',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    await setDoc(doc(db, 'stores', storeId, 'private', 'account'), {
      storeId,
      ownerUid: user.uid,
      ownerEmail: user.email || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as StoreTenant;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateStoreTenantByOwner(
  store: StoreTenant,
  updates: Partial<StoreRegistrationInput>
): Promise<void> {
  const path = `stores/${store.id}`;
  const cleanName = (updates.storeName ?? store.storeName).trim().slice(0, 100);
  const optionalMerged: StoreRegistrationInput = {
    storeName: cleanName,
    registeredOwnerName: (updates.registeredOwnerName ?? store.registeredOwnerName).trim().slice(0, 100),
    rif: updates.rif !== undefined ? updates.rif : store.rif,
    logoUrl: updates.logoUrl !== undefined ? updates.logoUrl : store.logoUrl,
    businessWhatsapp: (updates.businessWhatsapp ?? store.businessWhatsapp).trim().slice(0, 25),
    category: updates.category !== undefined ? updates.category : store.category,
    description: updates.description !== undefined ? updates.description : store.description,
    nationalShippingEnabled:
      updates.nationalShippingEnabled ?? store.nationalShippingEnabled,
    nationalCouriers:
      updates.nationalCouriers !== undefined ? updates.nationalCouriers : store.nationalCouriers,
    localDeliveryEnabled: updates.localDeliveryEnabled ?? store.localDeliveryEnabled,
    localDeliveryFeeUSD:
      updates.localDeliveryFeeUSD !== undefined
        ? updates.localDeliveryFeeUSD
        : store.localDeliveryFeeUSD,
    localDeliveryZone:
      updates.localDeliveryZone !== undefined ? updates.localDeliveryZone : store.localDeliveryZone,
    pickupEnabled: updates.pickupEnabled ?? store.pickupEnabled,
  };

  const nextPayload: Record<string, unknown> = {
    id: store.id,
    slug: store.slug,
    ownerUid: store.ownerUid,
    storeName: optionalMerged.storeName,
    registeredOwnerName: optionalMerged.registeredOwnerName,
    businessWhatsapp: optionalMerged.businessWhatsapp,
    status: store.status,
    subscriptionPriceUSD: 25,
    nationalShippingEnabled: optionalMerged.nationalShippingEnabled,
    localDeliveryEnabled: optionalMerged.localDeliveryEnabled,
    pickupEnabled: optionalMerged.pickupEnabled,
    ...(store.warehousePosEnabled !== undefined
      ? { warehousePosEnabled: store.warehousePosEnabled }
      : {}),
    ...(store.referralCode ? { referralCode: store.referralCode } : {}),
    ...(store.referredByCode ? { referredByCode: store.referredByCode } : {}),
    ...(store.referredByStoreId ? { referredByStoreId: store.referredByStoreId } : {}),
    ...(store.referredByStoreName ? { referredByStoreName: store.referredByStoreName } : {}),
    ...(store.referralRewardGranted !== undefined
      ? { referralRewardGranted: store.referralRewardGranted }
      : {}),
    ...buildCleanStoreOptionalFields(optionalMerged),
    createdAt: store.createdAt,
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'stores', store.id), nextPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminSetStoreStatus(
  store: StoreTenant,
  status: StoreStatus
): Promise<void> {
  const path = `stores/${store.id}`;
  try {
    await updateDoc(doc(db, 'stores', store.id), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminSetStoreWarehousePos(
  store: StoreTenant,
  enabled: boolean
): Promise<void> {
  const path = `stores/${store.id}`;
  try {
    await updateDoc(doc(db, 'stores', store.id), {
      warehousePosEnabled: enabled,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function submitSubscriptionPayment(
  user: User,
  store: StoreTenant,
  data: {
    amountUSD: number;
    paymentMethod: SubscriptionPaymentMethod;
    referenceNumber: string;
    payerInfo?: string;
    notes?: string;
    coupon?: ReferralCoupon | null;
  }
): Promise<void> {
  const paymentId = makeSafeDocId('pay');
  const path = `subscriptionPayments/${paymentId}`;
  const basePrice = Math.max(1, Number(data.amountUSD) || 25);
  const coupon = data.coupon || null;
  const netAmountUSD = coupon
    ? Math.max(0, Number((basePrice - coupon.discountUSD).toFixed(2)))
    : basePrice;

  const payload: Record<string, unknown> = {
    id: paymentId,
    storeId: store.id,
    storeName: store.storeName,
    ownerUid: user.uid,
    ownerEmail: user.email || '',
    amountUSD: netAmountUSD,
    paymentMethod: netAmountUSD === 0 && coupon ? 'Cupón Referido' : data.paymentMethod,
    referenceNumber:
      (data.referenceNumber || coupon?.code || `CUPON-${Date.now()}`).trim().slice(0, 80),
    status: 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (data.payerInfo && data.payerInfo.trim()) {
    payload.payerInfo = data.payerInfo.trim().slice(0, 120);
  }
  if (data.notes && data.notes.trim()) {
    payload.notes = data.notes.trim().slice(0, 400);
  }
  if (coupon) {
    payload.couponId = coupon.id;
    payload.couponCode = coupon.code;
    payload.discountUSD = coupon.discountUSD;
  }

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'subscriptionPayments', paymentId), payload);
    if (coupon) {
      batch.update(doc(db, 'coupons', coupon.id), {
        status: 'applied',
        appliedPaymentId: paymentId,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function adminResolveSubscriptionPayment(
  payment: SubscriptionPayment,
  nextStatus: 'approved' | 'rejected',
  activateStoreToo: boolean,
  adminNote?: string
): Promise<{ couponIssuedCode?: string; referrerStoreName?: string }> {
  const path = `subscriptionPayments/${payment.id}`;
  let couponIssuedCode: string | undefined;
  let referrerStoreName: string | undefined;

  try {
    const batch = writeBatch(db);
    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      updatedAt: serverTimestamp(),
    };
    if (adminNote !== undefined) {
      updatePayload.notes = adminNote.trim().slice(0, 400);
    }
    batch.update(doc(db, 'subscriptionPayments', payment.id), updatePayload);

    if (payment.couponId) {
      if (nextStatus === 'approved') {
        batch.update(doc(db, 'coupons', payment.couponId), {
          status: 'redeemed',
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.update(doc(db, 'coupons', payment.couponId), {
          status: 'available',
          appliedPaymentId: deleteField(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    const storeUpdates: Record<string, unknown> = {};
    if (nextStatus === 'approved') {
      if (activateStoreToo) {
        storeUpdates.status = 'active';
      }

      // Check if this store was referred and hasn't unlocked the referrer's coupon yet
      const storeSnap = await getDoc(doc(db, 'stores', payment.storeId));
      if (storeSnap.exists()) {
        const storeData = storeSnap.data() as StoreTenant;
        if (storeData.referredByStoreId && !storeData.referralRewardGranted) {
          const refQuery = query(
            collection(db, 'referrals'),
            where('referredStoreId', '==', storeData.id)
          );
          const refSnap = await getDocs(refQuery);
          const matchingRef = refSnap.docs[0]?.data() as StoreReferral | undefined;

          if (matchingRef && matchingRef.status === 'registered') {
            const billing = await getPlatformBillingSettings();
            const rewardUSD =
              typeof billing.referralRewardUSD === 'number' && billing.referralRewardUSD > 0
                ? billing.referralRewardUSD
                : 25;

            const couponId = makeSafeDocId('coup');
            const randPart = Math.random()
              .toString(36)
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, '')
              .slice(0, 6);
            const couponCode = `RENOVA-${Date.now().toString(36).toUpperCase().slice(-4)}-${randPart}`;

            batch.set(doc(db, 'coupons', couponId), {
              id: couponId,
              code: couponCode,
              storeId: matchingRef.referrerStoreId,
              storeName: matchingRef.referrerStoreName,
              ownerUid: matchingRef.referrerOwnerUid,
              discountUSD: rewardUSD,
              sourceReferralId: matchingRef.id,
              referredStoreName: storeData.storeName,
              status: 'available',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            batch.update(doc(db, 'referrals', matchingRef.id), {
              status: 'rewarded',
              rewardCouponId: couponId,
              rewardCouponCode: couponCode,
              updatedAt: serverTimestamp(),
            });

            storeUpdates.referralRewardGranted = true;

            // Notify referrer store's inbox automatically
            const inboxMsgId = makeSafeDocId('msg');
            batch.set(doc(db, 'stores', matchingRef.referrerStoreId, 'inbox', inboxMsgId), {
              id: inboxMsgId,
              storeId: matchingRef.referrerStoreId,
              storeOwnerUid: matchingRef.referrerOwnerUid,
              subject: `¡Ganaste un Cupón de Renovación ($${rewardUSD} USD)! Código: ${couponCode}`,
              body: `Tu tienda referida "${storeData.storeName}" pagó su suscripción y fue aprobada por el Administrador. Ya tienes disponible tu cupón de renovación ${couponCode} por $${rewardUSD} USD para renovar tu servicio en la pestaña "Suscripción $25/mes".`,
              senderEmail: SUPER_ADMIN_EMAIL,
              category: 'referral_reward',
              isRead: false,
              createdAt: serverTimestamp(),
            });

            couponIssuedCode = couponCode;
            referrerStoreName = matchingRef.referrerStoreName;
          }
        }
      }

      if (Object.keys(storeUpdates).length > 0) {
        storeUpdates.updatedAt = serverTimestamp();
        batch.update(doc(db, 'stores', payment.storeId), storeUpdates);
      }
    }

    await batch.commit();
    return { couponIssuedCode, referrerStoreName };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// -----------------------------------------------------------------------------
// Real-Time Store & Payment Subscriptions
// -----------------------------------------------------------------------------

export function subscribeActiveStores(
  onData: (stores: StoreTenant[]) => void
): Unsubscribe {
  const q = query(collection(db, 'stores'), where('status', '==', 'active'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as StoreTenant);
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'stores');
    }
  );
}

export function subscribeOwnerStores(
  ownerUid: string,
  onData: (stores: StoreTenant[]) => void
): Unsubscribe {
  const q = query(collection(db, 'stores'), where('ownerUid', '==', ownerUid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as StoreTenant);
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'stores');
    }
  );
}

export function subscribeOwnerPayments(
  ownerUid: string,
  onData: (payments: SubscriptionPayment[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'subscriptionPayments'),
    where('ownerUid', '==', ownerUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as SubscriptionPayment);
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'subscriptionPayments');
    }
  );
}

export function subscribeAllStoresForAdmin(
  onData: (stores: StoreTenant[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'stores'),
    (snap) => {
      const list = snap.docs.map((d) => d.data() as StoreTenant);
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'stores');
    }
  );
}

export function subscribeAllPaymentsForAdmin(
  onData: (payments: SubscriptionPayment[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'subscriptionPayments'),
    (snap) => {
      const list = snap.docs.map((d) => d.data() as SubscriptionPayment);
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'subscriptionPayments');
    }
  );
}

// -----------------------------------------------------------------------------
// Per-Store Products CRUD + Export / Import Database
// -----------------------------------------------------------------------------

export interface StoreProductInput {
  id?: string;
  name: string;
  description: string;
  priceUSD: number;
  costUSD?: number;
  rating: number;
  reviewCount?: number;
  imageUrl?: string;
  category?: string;
  sku?: string;
  stock: number;
  minStock?: number;
  unit?: string;
  isActive?: boolean;
}

function buildProductFirestoreDoc(
  storeId: string,
  ownerUid: string,
  productId: string,
  input: StoreProductInput,
  existingCreatedAt?: unknown
): Record<string, unknown> {
  const clampedRating = Math.max(1, Math.min(5, Number(input.rating) || 5));
  const payload: Record<string, unknown> = {
    id: productId,
    storeId,
    ownerUid,
    name: (input.name || 'Producto').trim().slice(0, 120),
    description: (input.description || 'Producto disponible en catálogo').trim().slice(0, 1000),
    priceUSD: Math.max(0, Number(input.priceUSD) || 0),
    rating: Number(clampedRating.toFixed(1)),
    stock: Math.max(0, Number(input.stock) || 0),
    isActive: input.isActive !== undefined ? Boolean(input.isActive) : true,
    createdAt: existingCreatedAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (typeof input.costUSD === 'number' && !Number.isNaN(input.costUSD) && input.costUSD >= 0) {
    payload.costUSD = Number(input.costUSD);
  }
  if (typeof input.reviewCount === 'number' && input.reviewCount >= 0) {
    payload.reviewCount = Math.floor(input.reviewCount);
  }
  if (input.imageUrl && input.imageUrl.trim()) {
    payload.imageUrl = input.imageUrl.trim().slice(0, 150000);
  }
  if (input.category && input.category.trim()) {
    payload.category = input.category.trim().slice(0, 60);
  }
  if (input.sku && input.sku.trim()) {
    payload.sku = input.sku.trim().slice(0, 60);
  }
  if (typeof input.minStock === 'number' && input.minStock >= 0) {
    payload.minStock = Number(input.minStock);
  }
  if (input.unit && input.unit.trim()) {
    payload.unit = input.unit.trim().slice(0, 30);
  }
  return payload;
}

export function subscribePublicStoreProducts(
  storeId: string,
  onData: (products: StoreProduct[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'stores', storeId, 'products'),
    where('isActive', '==', true)
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as StoreProduct));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `stores/${storeId}/products`);
    }
  );
}

export function subscribeOwnerStoreProducts(
  storeId: string,
  ownerUid: string,
  onData: (products: StoreProduct[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'stores', storeId, 'products'),
    where('ownerUid', '==', ownerUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as StoreProduct));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `stores/${storeId}/products`);
    }
  );
}

export async function saveStoreProduct(
  storeId: string,
  ownerUid: string,
  input: StoreProductInput,
  existingProduct?: StoreProduct
): Promise<void> {
  const productId = existingProduct?.id || input.id || makeSafeDocId('prod');
  const path = `stores/${storeId}/products/${productId}`;
  const docPayload = buildProductFirestoreDoc(
    storeId,
    ownerUid,
    productId,
    input,
    existingProduct?.createdAt
  );
  try {
    await setDoc(doc(db, 'stores', storeId, 'products', productId), docPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteStoreProduct(storeId: string, productId: string): Promise<void> {
  const path = `stores/${storeId}/products/${productId}`;
  try {
    await deleteDoc(doc(db, 'stores', storeId, 'products', productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function importStoreProductsBatch(
  storeId: string,
  ownerUid: string,
  items: StoreProductInput[]
): Promise<number> {
  const path = `stores/${storeId}/products`;
  const cleanItems = items.filter((item) => item.name && item.name.trim().length > 0);
  if (cleanItems.length === 0) return 0;

  try {
    let imported = 0;
    // Chunk into batches of 400 to respect Firestore 500-op batch limit
    for (let i = 0; i < cleanItems.length; i += 400) {
      const chunk = cleanItems.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const item of chunk) {
        const productId = makeSafeDocId('imp');
        const ref = doc(db, 'stores', storeId, 'products', productId);
        batch.set(ref, buildProductFirestoreDoc(storeId, ownerUid, productId, item));
        imported += 1;
      }
      await batch.commit();
    }
    return imported;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface PortableProductRecord {
  nombre: string;
  descripcion: string;
  precioUSD: number;
  calificacionEstrellas: number;
  foto: string;
  categoria?: string;
  sku?: string;
  stock: number;
  costoUSD?: number;
  unidad?: string;
}

export function exportProductsToJSON(store: StoreTenant, products: StoreProduct[]): void {
  const records: PortableProductRecord[] = products.map((p) => ({
    nombre: p.name,
    descripcion: p.description,
    precioUSD: p.priceUSD,
    calificacionEstrellas: p.rating,
    foto: p.imageUrl || '',
    categoria: p.category || 'General',
    sku: p.sku || '',
    stock: p.stock,
    costoUSD: p.costUSD ?? 0,
    unidad: p.unit || 'und',
  }));
  const blob = new Blob([JSON.stringify({ tienda: store.storeName, exportado: new Date().toISOString(), productos: records }, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bd_${store.slug}_productos.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(val: string | number | undefined): string {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportProductsToCSV(store: StoreTenant, products: StoreProduct[]): void {
  const headers = [
    'nombre',
    'descripcion',
    'precioUSD',
    'calificacionEstrellas',
    'foto',
    'categoria',
    'sku',
    'stock',
    'costoUSD',
    'unidad',
  ];
  const rows = products.map((p) =>
    [
      escapeCsvCell(p.name),
      escapeCsvCell(p.description),
      escapeCsvCell(p.priceUSD),
      escapeCsvCell(p.rating),
      escapeCsvCell(p.imageUrl || ''),
      escapeCsvCell(p.category || 'General'),
      escapeCsvCell(p.sku || ''),
      escapeCsvCell(p.stock),
      escapeCsvCell(p.costUSD ?? 0),
      escapeCsvCell(p.unit || 'und'),
    ].join(',')
  );
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bd_${store.slug}_productos.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsvLines(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(current);
      current = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && next === '\n') i++;
      row.push(current);
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
  }
  return rows;
}

export function parseImportedDatabaseFile(
  rawText: string,
  fileName: string
): StoreProductInput[] {
  const trimmed = rawText.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return [];

  if (fileName.toLowerCase().endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    const list: Record<string, unknown>[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.productos)
        ? parsed.productos
        : Array.isArray(parsed.products)
          ? parsed.products
          : [];
    return list
      .map((item) => ({
        name: String(item.nombre || item.name || item.producto || '').trim(),
        description: String(item.descripcion || item.description || 'Producto importado').trim(),
        priceUSD: Number(item.precioUSD ?? item.precio ?? item.priceUSD ?? item.price ?? 0) || 0,
        costUSD:
          item.costoUSD !== undefined || item.costUSD !== undefined
            ? Number(item.costoUSD ?? item.costUSD) || 0
            : undefined,
        rating: Math.max(
          1,
          Math.min(5, Number(item.calificacionEstrellas ?? item.calificacion ?? item.rating ?? item.estrellas ?? 5) || 5)
        ),
        imageUrl: String(item.foto || item.imageUrl || item.imagen || item.image || '').trim(),
        category: String(item.categoria || item.category || 'General').trim(),
        sku: String(item.sku || '').trim(),
        stock: Number(item.stock ?? item.cantidad ?? 10) || 0,
        unit: String(item.unidad || item.unit || 'und').trim(),
        isActive: true,
      }))
      .filter((p) => p.name.length > 0);
  }

  // CSV Parser
  const matrix = parseCsvLines(trimmed);
  if (matrix.length < 2) return [];
  const headerRow = matrix[0].map((h) => h.trim().toLowerCase());
  const idx = (candidates: string[]) =>
    headerRow.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));

  const iName = idx(['nombre', 'name', 'producto', 'title']);
  const iDesc = idx(['descripcion', 'description', 'detalle']);
  const iPrice = idx(['preciousd', 'precio', 'priceusd', 'price']);
  const iRating = idx(['calificacionestrellas', 'calificacion', 'rating', 'estrellas']);
  const iPhoto = idx(['foto', 'imageurl', 'imagen', 'image', 'url']);
  const iCat = idx(['categoria', 'category']);
  const iSku = idx(['sku', 'codigo']);
  const iStock = idx(['stock', 'cantidad', 'existencia']);
  const iCost = idx(['costousd', 'costo', 'costusd']);
  const iUnit = idx(['unidad', 'unit']);

  return matrix
    .slice(1)
    .map((cols) => {
      const get = (colIndex: number) => (colIndex >= 0 && colIndex < cols.length ? cols[colIndex].trim() : '');
      const name = get(iName >= 0 ? iName : 0);
      return {
        name,
        description: get(iDesc >= 0 ? iDesc : 1) || 'Producto importado',
        priceUSD: Number(get(iPrice >= 0 ? iPrice : 2).replace(',', '.')) || 0,
        rating: Math.max(1, Math.min(5, Number(get(iRating >= 0 ? iRating : 3).replace(',', '.')) || 5)),
        imageUrl: get(iPhoto >= 0 ? iPhoto : 4),
        category: get(iCat) || 'General',
        sku: get(iSku) || '',
        stock: Number(get(iStock)) || 10,
        costUSD: iCost >= 0 ? Number(get(iCost).replace(',', '.')) || 0 : undefined,
        unit: get(iUnit) || 'und',
        isActive: true,
      };
    })
    .filter((p) => p.name.length > 0);
}

// -----------------------------------------------------------------------------
// Per-Store Orders & Sales Ledger
// -----------------------------------------------------------------------------

export async function createStoreOrderInCloud(
  user: User,
  store: StoreTenant,
  orderInput: Omit<StoreOrder, 'id' | 'storeId' | 'storeOwnerUid' | 'customerUid' | 'status' | 'createdAt' | 'updatedAt'>,
  cartItems: StoreCartItem[] = [],
  options?: {
    initialStatus?: 'pending' | 'confirmed' | 'completed';
    deductStockImmediately?: boolean;
  }
): Promise<StoreOrder> {
  const orderId = makeSafeDocId('ord');
  const path = `stores/${store.id}/orders/${orderId}`;
  const isOwnerCreated = user.uid === store.ownerUid;
  const requestedStatus =
    isOwnerCreated && options?.initialStatus ? options.initialStatus : 'pending';
  const deductNow = Boolean(
    isOwnerCreated && options?.deductStockImmediately && cartItems.length > 0
  );

  const itemsCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const estimatedCostUSD = Number(
    cartItems
      .reduce((acc, item) => acc + (item.product.costUSD || 0) * item.quantity, 0)
      .toFixed(2)
  );
  const estimatedProfitUSD = Number(
    (Math.max(0, Number(orderInput.subtotalUSD) || 0) - estimatedCostUSD).toFixed(2)
  );

  const payload: Record<string, unknown> = {
    id: orderId,
    storeId: store.id,
    storeOwnerUid: store.ownerUid,
    customerUid: user.uid,
    invoiceNumber: orderInput.invoiceNumber.trim().slice(0, 40),
    customerName: orderInput.customerName.trim().slice(0, 100),
    customerPhone: orderInput.customerPhone.trim().slice(0, 25),
    shippingType: orderInput.shippingType,
    shippingFeeUSD: Math.max(0, Number(orderInput.shippingFeeUSD) || 0),
    paymentMethod: orderInput.paymentMethod.trim().slice(0, 60),
    subtotalUSD: Math.max(0, Number(orderInput.subtotalUSD) || 0),
    totalUSD: Math.max(0, Number(orderInput.totalUSD) || 0),
    totalBs: Math.max(0, Number(orderInput.totalBs) || 0),
    exchangeRate: Math.max(0.01, Number(orderInput.exchangeRate) || 1),
    itemsSummary: orderInput.itemsSummary.trim().slice(0, 2000),
    saleChannel: orderInput.saleChannel || (isOwnerCreated ? 'Venta Directa Tienda' : 'Carrito Web'),
    stockDeducted: deductNow,
    status: requestedStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (itemsCount > 0) {
    payload.itemsCount = itemsCount;
    payload.estimatedCostUSD = estimatedCostUSD;
    payload.estimatedProfitUSD = estimatedProfitUSD;
  }

  if (orderInput.customerRif && orderInput.customerRif.trim()) {
    payload.customerRif = orderInput.customerRif.trim().slice(0, 30);
  }
  if (orderInput.customerEmail && orderInput.customerEmail.trim()) {
    payload.customerEmail = orderInput.customerEmail.trim().slice(0, 160);
  }
  if (orderInput.shippingDetails && orderInput.shippingDetails.trim()) {
    payload.shippingDetails = orderInput.shippingDetails.trim().slice(0, 300);
  }

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'stores', store.id, 'orders', orderId), payload);

    cartItems.forEach((item, idx) => {
      const itemId = makeSafeDocId(`item${idx}`);
      const itemPayload: Record<string, unknown> = {
        id: itemId,
        orderId,
        storeId: store.id,
        storeOwnerUid: store.ownerUid,
        customerUid: user.uid,
        productId: item.product.id,
        productName: (item.product.name || 'Producto').trim().slice(0, 140),
        quantity: Math.max(1, Math.floor(item.quantity)),
        unitPriceUSD: Math.max(0, Number(item.product.priceUSD) || 0),
        subtotalUSD: Number((item.product.priceUSD * item.quantity).toFixed(2)),
      };
      if (item.product.sku && item.product.sku.trim()) {
        itemPayload.sku = item.product.sku.trim().slice(0, 60);
      }
      if (item.product.unit && item.product.unit.trim()) {
        itemPayload.unit = item.product.unit.trim().slice(0, 30);
      }
      if (typeof item.product.costUSD === 'number' && !Number.isNaN(item.product.costUSD)) {
        itemPayload.unitCostUSD = Math.max(0, Number(item.product.costUSD));
      }

      batch.set(doc(db, 'stores', store.id, 'orders', orderId, 'items', itemId), itemPayload);

      if (deductNow) {
        const nextStock = Math.max(0, (Number(item.product.stock) || 0) - item.quantity);
        batch.update(doc(db, 'stores', store.id, 'products', item.product.id), {
          stock: nextStock,
          updatedAt: serverTimestamp(),
        });
      }
    });

    await batch.commit();
    return {
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as StoreOrder;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeOwnerStoreOrders(
  storeId: string,
  ownerUid: string,
  onData: (orders: StoreOrder[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'stores', storeId, 'orders'),
    where('storeOwnerUid', '==', ownerUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as StoreOrder);
      list.sort((a, b) => b.invoiceNumber.localeCompare(a.invoiceNumber));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `stores/${storeId}/orders`);
    }
  );
}

export async function fetchStoreOrderItems(
  storeId: string,
  order: StoreOrder,
  requesterUid: string
): Promise<StoreOrderItem[]> {
  const path = `stores/${storeId}/orders/${order.id}/items`;
  try {
    const field = requesterUid === order.storeOwnerUid ? 'storeOwnerUid' : 'customerUid';
    const q = query(collection(db, 'stores', storeId, 'orders', order.id, 'items'), where(field, '==', requesterUid));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map((d) => d.data() as StoreOrderItem);
    }
  } catch (err) {
    console.warn('Cargando detalle desde resumen de orden:', err);
  }

  // Graceful fallback for legacy orders without items subcollection
  return parseOrderItemsFallback(order);
}

export function parseOrderItemsFallback(order: StoreOrder): StoreOrderItem[] {
  const parts = order.itemsSummary
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);

  return parts.map((segment, idx) => {
    const match = segment.match(/^(\d+)x\s+(.+?)\s*\(\$([0-9.]+)\)$/i);
    if (match) {
      const quantity = Math.max(1, Number(match[1]) || 1);
      const productName = match[2].trim();
      const lineTotal = Math.max(0, Number(match[3]) || 0);
      return {
        id: `legacy-${idx}`,
        orderId: order.id,
        storeId: order.storeId,
        storeOwnerUid: order.storeOwnerUid,
        customerUid: order.customerUid,
        productId: `legacy-${idx}`,
        productName,
        unit: 'und',
        quantity,
        unitPriceUSD: Number((lineTotal / quantity).toFixed(2)),
        subtotalUSD: lineTotal,
      };
    }
    return {
      id: `legacy-${idx}`,
      orderId: order.id,
      storeId: order.storeId,
      storeOwnerUid: order.storeOwnerUid,
      customerUid: order.customerUid,
      productId: `legacy-${idx}`,
      productName: segment,
      unit: 'und',
      quantity: 1,
      unitPriceUSD: order.subtotalUSD,
      subtotalUSD: order.subtotalUSD,
    };
  });
}

export async function updateStoreOrderStatus(
  storeId: string,
  order: StoreOrder,
  status: StoreOrder['status'],
  ownerProducts: StoreProduct[] = []
): Promise<boolean> {
  const path = `stores/${storeId}/orders/${order.id}`;
  const shouldDeductStock =
    !order.stockDeducted &&
    (status === 'confirmed' || status === 'shipped' || status === 'completed');

  try {
    const batch = writeBatch(db);
    let didDeduct = Boolean(order.stockDeducted);

    if (shouldDeductStock) {
      const items = await fetchStoreOrderItems(storeId, order, order.storeOwnerUid);
      items.forEach((item) => {
        const matchedProd = ownerProducts.find((p) => p.id === item.productId);
        if (matchedProd) {
          const nextStock = Math.max(0, (Number(matchedProd.stock) || 0) - item.quantity);
          batch.update(doc(db, 'stores', storeId, 'products', matchedProd.id), {
            stock: nextStock,
            updatedAt: serverTimestamp(),
          });
        }
      });
      didDeduct = true;
    }

    batch.update(doc(db, 'stores', storeId, 'orders', order.id), {
      status,
      stockDeducted: didDeduct,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
    return didDeduct && !order.stockDeducted;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function exportStoreSalesToCSV(store: StoreTenant, orders: StoreOrder[]): void {
  const headers = [
    'factura',
    'canal',
    'estado',
    'cliente',
    'ci_rif',
    'telefono',
    'entrega',
    'metodo_pago',
    'productos',
    'subtotal_usd',
    'envio_usd',
    'total_usd',
    'total_bs',
    'costo_estimado_usd',
    'ganancia_estimada_usd',
  ];
  const esc = (v: unknown) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const rows = orders.map((o) =>
    [
      esc(o.invoiceNumber),
      esc(o.saleChannel || 'Carrito Web'),
      esc(o.status),
      esc(o.customerName),
      esc(o.customerRif || ''),
      esc(o.customerPhone),
      esc(o.shippingType),
      esc(o.paymentMethod),
      esc(o.itemsSummary),
      esc(o.subtotalUSD.toFixed(2)),
      esc(o.shippingFeeUSD.toFixed(2)),
      esc(o.totalUSD.toFixed(2)),
      esc(o.totalBs.toFixed(2)),
      esc((o.estimatedCostUSD ?? 0).toFixed(2)),
      esc((o.estimatedProfitUSD ?? o.subtotalUSD).toFixed(2)),
    ].join(',')
  );

  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ventas_${store.slug}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchStoreByIdOrSlug(slugOrId: string): Promise<StoreTenant | null> {
  try {
    const direct = await getDoc(doc(db, 'stores', slugOrId));
    if (direct.exists()) return direct.data() as StoreTenant;
    const q = query(
      collection(db, 'stores'),
      where('slug', '==', slugOrId),
      where('status', '==', 'active')
    );
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0].data() as StoreTenant;
    return null;
  } catch (error) {
    console.warn('Error resolviendo tienda por slug:', error);
    return null;
  }
}

// -----------------------------------------------------------------------------
// Referrals, Coupons, Admin Email Broadcasts & Store Owner Inbox
// -----------------------------------------------------------------------------

export function subscribeOwnerReferrals(
  ownerUid: string,
  onData: (referrals: StoreReferral[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'referrals'),
    where('referrerOwnerUid', '==', ownerUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as StoreReferral));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'referrals');
    }
  );
}

export function subscribeOwnerCoupons(
  ownerUid: string,
  onData: (coupons: ReferralCoupon[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'coupons'),
    where('ownerUid', '==', ownerUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as ReferralCoupon));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'coupons');
    }
  );
}

export function subscribeAllReferralsForAdmin(
  onData: (referrals: StoreReferral[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'referrals'),
    (snap) => {
      onData(snap.docs.map((d) => d.data() as StoreReferral));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'referrals');
    }
  );
}

export function subscribeAllCouponsForAdmin(
  onData: (coupons: ReferralCoupon[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'coupons'),
    (snap) => {
      onData(snap.docs.map((d) => d.data() as ReferralCoupon));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'coupons');
    }
  );
}

export function subscribeStoreInbox(
  storeId: string,
  ownerUid: string,
  onData: (messages: StoreInboxMessage[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'stores', storeId, 'inbox'),
    where('storeOwnerUid', '==', ownerUid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => d.data() as StoreInboxMessage);
      list.sort((a, b) => (b.id > a.id ? 1 : -1));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, `stores/${storeId}/inbox`);
    }
  );
}

export async function markStoreInboxMessageRead(
  storeId: string,
  messageId: string
): Promise<void> {
  const path = `stores/${storeId}/inbox/${messageId}`;
  try {
    await updateDoc(doc(db, 'stores', storeId, 'inbox', messageId), {
      isRead: true,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeAdminEmails(
  onData: (emails: AdminEmailDispatch[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'adminEmails'),
    (snap) => {
      const list = snap.docs.map((d) => d.data() as AdminEmailDispatch);
      list.sort((a, b) => (b.id > a.id ? 1 : -1));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'adminEmails');
    }
  );
}

export async function fetchStoreOwnerEmailsForAdmin(
  stores: StoreTenant[],
  payments: SubscriptionPayment[]
): Promise<Record<string, string>> {
  const emailMap: Record<string, string> = {};

  payments.forEach((p) => {
    if (p.ownerEmail && p.storeId && !emailMap[p.storeId]) {
      emailMap[p.storeId] = p.ownerEmail;
    }
  });

  await Promise.allSettled(
    stores.map(async (store) => {
      if (emailMap[store.id]) return;
      try {
        const snap = await getDoc(doc(db, 'stores', store.id, 'private', 'account'));
        if (snap.exists()) {
          const data = snap.data() as { ownerEmail?: string };
          if (data.ownerEmail) {
            emailMap[store.id] = data.ownerEmail;
          }
        }
      } catch {
        // Fallback already checked from payments
      }
    })
  );

  return emailMap;
}

export async function sendAdminEmailsToOwners(params: {
  adminUser: User;
  mode: 'individual' | 'collective';
  targets: Array<{ store: StoreTenant; email?: string }>;
  subject: string;
  body: string;
}): Promise<{
  deliveryChannel: EmailDeliveryChannel;
  sentCount: number;
  message: string;
  emailsList: string[];
}> {
  const { adminUser, mode, targets, subject, body } = params;
  const cleanSubject = subject.trim().slice(0, 180);
  const cleanBody = body.trim().slice(0, 5000);
  if (!cleanSubject || !cleanBody || targets.length === 0) {
    throw new Error('Debes seleccionar al menos una tienda, asunto y mensaje.');
  }

  const validEmailEntries = targets
    .filter((t) => Boolean(t.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.email.trim())))
    .map((t) => ({
      email: t.email!.trim(),
      storeName: t.store.storeName,
      ownerName: t.store.registeredOwnerName,
    }));

  let deliveryChannel: EmailDeliveryChannel = 'cloud_inbox_mailto';
  let serverMessage = 'Entregado a la Bandeja Oficial de cada tienda.';

  try {
    const idToken = await adminUser.getIdToken();
    const resp = await fetch('/api/admin/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        mode,
        subject: cleanSubject,
        body: cleanBody,
        recipients: validEmailEntries,
      }),
    });
    if (resp.ok) {
      const json = (await resp.json()) as {
        deliveryChannel?: EmailDeliveryChannel;
        message?: string;
      };
      if (json.deliveryChannel) deliveryChannel = json.deliveryChannel;
      if (json.message) serverMessage = json.message;
    }
  } catch (err) {
    console.warn('Error llamando API de correo, guardando en Bandeja Cloud:', err);
  }

  const dispatchId = makeSafeDocId('mail');
  const uniqueEmails = Array.from(new Set(validEmailEntries.map((r) => r.email)));
  const emailsSummary =
    uniqueEmails.length > 0
      ? uniqueEmails.join(', ').slice(0, 2000)
      : 'Bandeja Interna de Tienda (sin correo externo)';
  const storeNamesSummary = targets
    .map((t) => t.store.storeName)
    .join(', ')
    .slice(0, 1000);

  try {
    // 1. Log global Admin email dispatch
    await setDoc(doc(db, 'adminEmails', dispatchId), {
      id: dispatchId,
      mode,
      subject: cleanSubject,
      body: cleanBody,
      recipientCount: targets.length,
      recipientEmailsSummary: emailsSummary,
      targetStoreNames: storeNamesSummary,
      sentByEmail: adminUser.email || SUPER_ADMIN_EMAIL,
      deliveryChannel,
      createdAt: serverTimestamp(),
    });

    // 2. Deliver directly to every targeted store's official inbox in chunks of 400
    for (let i = 0; i < targets.length; i += 400) {
      const chunk = targets.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const item of chunk) {
        const msgId = makeSafeDocId('msg');
        batch.set(doc(db, 'stores', item.store.id, 'inbox', msgId), {
          id: msgId,
          storeId: item.store.id,
          storeOwnerUid: item.store.ownerUid,
          subject: cleanSubject,
          body: cleanBody,
          senderEmail: adminUser.email || SUPER_ADMIN_EMAIL,
          category: 'admin_email',
          isRead: false,
          createdAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }

    return {
      deliveryChannel,
      sentCount: targets.length,
      message: serverMessage,
      emailsList: uniqueEmails,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'adminEmails');
  }
}
