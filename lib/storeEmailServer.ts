import nodemailer from 'nodemailer';
import { verifyUnifiedBearerToken } from './authSyncServer';

async function verifyAuthenticatedUserBearerToken(
  authHeader?: string
): Promise<{ ok: boolean; email?: string; uid?: string }> {
  const verified = await verifyUnifiedBearerToken(authHeader);
  return { ok: verified.ok, email: verified.email, uid: verified.uid };
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHeaderLine(value: string, maxLen = 180): string {
  return value.replace(/[\r\n]+/g, ' ').trim().slice(0, maxLen);
}

function isValidEmail(email?: string): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isBlockedInternalSmtpHost(host: string): boolean {
  const lower = host.trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !lower ||
    lower === 'localhost' ||
    lower === '::1' ||
    lower === '0.0.0.0' ||
    lower.startsWith('127.') ||
    lower.startsWith('10.') ||
    lower.startsWith('169.254.') ||
    lower.startsWith('192.168.') ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe80') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }
  const m172 = /^172\.(\d{1,3})\./.exec(lower);
  if (m172) {
    const secondOctet = Number(m172[1]);
    if (secondOctet >= 16 && secondOctet <= 31) {
      return true;
    }
  }
  return false;
}

export interface StoreEmailProviderConfigInput {
  provider: 'resend' | 'smtp';
  recipientEmail: string;
  secondaryEmail?: string;
  fromName?: string;
  fromEmail?: string;
  resendApiKey?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
}

export interface StockAlertItemInput {
  id: string;
  name: string;
  sku: string;
  stock: number;
  minStock: number;
  unit: string;
  costUSD: number;
}

export interface SalesReportItemInput {
  name: string;
  quantity: number;
  revenueUSD: number;
}

export interface StoreEmailDispatchPayload {
  action: 'test' | 'stock_alert' | 'sales_report';
  storeId?: string;
  storeName: string;
  exchangeRate?: number;
  config: StoreEmailProviderConfigInput;
  testRecipientEmail?: string;
  triggerEvent?: string;
  products?: StockAlertItemInput[];
  salesReport?: {
    periodLabel: string;
    totalOrders: number;
    grossRevenueUSD: number;
    costOfGoodsUSD?: number;
    mermasLossUSD?: number;
    netProfitUSD?: number;
    receiptNumber?: string;
    customerName?: string;
    paymentMethod?: string;
    cashierName?: string;
    paymentBreakdown?: Array<{ method: string; count: number; totalUSD: number }>;
    topItems?: SalesReportItemInput[];
    recentReceipts?: Array<{
      receiptNumber: string;
      date: string;
      customerName: string;
      paymentMethod: string;
      totalUSD: number;
    }>;
  };
}

export interface StoreEmailDispatchResponse {
  ok: boolean;
  status?: number;
  deliveryChannel?: 'smtp' | 'resend';
  messageId?: string;
  latencyMs?: number;
  testedAt?: string;
  recipientEmail?: string;
  stage?: 'syntax' | 'network' | 'auth' | 'api_key' | 'sender' | 'unauthorized';
  message: string;
  error?: string;
}

function buildEmailContent(payload: StoreEmailDispatchPayload, authenticatedEmail?: string) {
  const storeName = sanitizeHeaderLine(payload.storeName || 'Mi Tienda', 100);
  const rate =
    typeof payload.exchangeRate === 'number' && payload.exchangeRate > 0
      ? payload.exchangeRate
      : 1;
  const nowStr = new Date().toLocaleString('es-VE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  if (payload.action === 'test') {
    const targetAdminEmail =
      isValidEmail(payload.testRecipientEmail)
        ? payload.testRecipientEmail.trim()
        : payload.config.recipientEmail;
    const providerLabel =
      payload.config.provider === 'resend'
        ? 'Resend API'
        : `SMTP (${sanitizeHeaderLine(payload.config.smtpHost || '', 120)}:${Number(payload.config.smtpPort || 587)})`;
    const subject = sanitizeHeaderLine(
      `[PRUEBA EXITOSA] Correo configurado para ${storeName} · Smith Solutions`
    );
    const text = [
      `Smith Solutions E-Commerce — Verificación de Correo`,
      `Tienda: ${storeName}`,
      `Proveedor activo: ${providerLabel}`,
      `Administrador receptor: ${targetAdminEmail}`,
      payload.config.secondaryEmail ? `Copia (CC): ${payload.config.secondaryEmail}` : '',
      `Cuenta verificada: ${authenticatedEmail || targetAdminEmail}`,
      `Fecha de prueba: ${nowStr}`,
      ``,
      `Tu canal de notificaciones está listo para entregar alertas de stock crítico y reportes de ventas.`,
    ]
      .filter(Boolean)
      .join('\n');

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;background:#09090b;color:#f4f4f5;padding:24px;border-radius:14px;border:1px solid #27272a;">
        <div style="border-bottom:1px solid #27272a;padding-bottom:14px;margin-bottom:18px;">
          <div style="font-size:11px;letter-spacing:1.2px;color:#fbbf24;font-weight:700;">SMITH SOLUTIONS E-COMMERCE</div>
          <h2 style="margin:6px 0 0;color:#ffffff;font-size:20px;">Conexión de Correo Verificada</h2>
        </div>
        <p style="font-size:14px;line-height:1.6;color:#d4d4d8;margin:0 0 16px;">
          Tu servidor de correo para <strong style="color:#ffffff;">${escapeHtml(storeName)}</strong> ha sido probado y validado correctamente tras guardar tus credenciales.
        </p>
        <div style="background:#111114;border:1px solid #27272a;border-radius:10px;padding:16px;font-size:13px;line-height:1.8;">
          <div><span style="color:#a1a1aa;">Proveedor:</span> <strong style="color:#fbbf24;">${escapeHtml(providerLabel)}</strong></div>
          <div><span style="color:#a1a1aa;">Administrador receptor:</span> <span style="color:#ffffff;">${escapeHtml(targetAdminEmail)}</span></div>
          ${
            payload.config.secondaryEmail
              ? `<div><span style="color:#a1a1aa;">Copia (CC):</span> <span style="color:#ffffff;">${escapeHtml(payload.config.secondaryEmail)}</span></div>`
              : ''
          }
          <div><span style="color:#a1a1aa;">Fecha:</span> <span style="color:#ffffff;">${escapeHtml(nowStr)}</span></div>
        </div>
        <p style="font-size:12px;color:#71717a;margin:18px 0 0;">
          A partir de ahora recibirás alertas de inventario crítico y reportes de ventas en esta dirección.
        </p>
      </div>
    `;
    return { subject, text, html };
  }

  if (payload.action === 'stock_alert') {
    const items = Array.isArray(payload.products) ? payload.products : [];
    const triggerEvent = sanitizeHeaderLine(
      payload.triggerEvent || 'Monitoreo automático de stock crítico',
      180
    );
    const subject = sanitizeHeaderLine(
      items.length === 1
        ? `[STOCK CRÍTICO] ${storeName} · ${items[0].name} (${items[0].stock} ${items[0].unit})`
        : `[STOCK CRÍTICO] ${storeName} · ${items.length} producto(s) requieren reposición`
    );

    const textLines = [
      `ALERTA DE STOCK CRÍTICO — ${storeName}`,
      `Evento: ${triggerEvent}`,
      `Fecha: ${nowStr} | Tasa ref.: ${rate.toFixed(2)} Bs/USD`,
      `--------------------------------------------------`,
      ...items.map(
        (p) =>
          `• ${p.name} (SKU: ${p.sku}) -> Stock: ${p.stock} / Mín: ${p.minStock} ${p.unit} | Costo unit.: $${Number(p.costUSD || 0).toFixed(2)}`
      ),
      items.length === 0 ? 'No hay productos por debajo del stock mínimo en este momento.' : '',
    ].filter(Boolean);

    const rowsHtml =
      items.length === 0
        ? `<tr><td colspan="4" style="padding:14px;text-align:center;color:#a1a1aa;">Todos los productos están por encima de su stock mínimo.</td></tr>`
        : items
            .map((p) => {
              const reorderQty = Math.max(1, (Number(p.minStock) || 1) * 2 - (Number(p.stock) || 0));
              const estUsd = reorderQty * (Number(p.costUSD) || 0);
              const estBs = estUsd * rate;
              return `
                <tr style="border-top:1px solid #27272a;">
                  <td style="padding:10px 12px;">
                    <div style="font-weight:700;color:#ffffff;">${escapeHtml(p.name)}</div>
                    <div style="font-size:11px;color:#a1a1aa;font-family:monospace;">${escapeHtml(p.sku)}</div>
                  </td>
                  <td style="padding:10px 12px;text-align:center;font-weight:700;color:#f87171;font-family:monospace;">
                    ${Number(p.stock)} ${escapeHtml(p.unit)}
                  </td>
                  <td style="padding:10px 12px;text-align:center;color:#d4d4d8;font-family:monospace;">
                    ${Number(p.minStock)} ${escapeHtml(p.unit)}
                  </td>
                  <td style="padding:10px 12px;text-align:right;font-family:monospace;">
                    <div style="font-weight:700;color:#fbbf24;">$${estUsd.toFixed(2)} USD</div>
                    <div style="font-size:11px;color:#a1a1aa;">≈ ${estBs.toLocaleString('es-VE', { maximumFractionDigits: 0 })} Bs.</div>
                  </td>
                </tr>
              `;
            })
            .join('');

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:660px;margin:0 auto;background:#09090b;color:#f4f4f5;padding:24px;border-radius:14px;border:1px solid #3f3f46;">
        <div style="border-bottom:1px solid #27272a;padding-bottom:14px;margin-bottom:16px;">
          <div style="font-size:11px;letter-spacing:1.2px;color:#f87171;font-weight:700;">ALERTA DE STOCK CRÍTICO</div>
          <h2 style="margin:6px 0 0;color:#ffffff;font-size:20px;">${escapeHtml(storeName)}</h2>
          <p style="margin:4px 0 0;font-size:12px;color:#a1a1aa;">Disparador: ${escapeHtml(triggerEvent)} · ${escapeHtml(nowStr)}</p>
        </div>
        <div style="background:#111114;border:1px solid #27272a;border-radius:10px;overflow:hidden;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left;">
            <thead style="background:#18181b;color:#a1a1aa;font-size:11px;text-transform:uppercase;">
              <tr>
                <th style="padding:10px 12px;">Producto</th>
                <th style="padding:10px 12px;text-align:center;">Stock Actual</th>
                <th style="padding:10px 12px;text-align:center;">Mínimo</th>
                <th style="padding:10px 12px;text-align:right;">Reposición Est.</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <p style="font-size:11px;color:#71717a;margin:16px 0 0;">
          Tasa BCV/Ref aplicada: ${rate.toFixed(2)} Bs/USD · Smith Solutions E-Commerce
        </p>
      </div>
    `;
    return { subject, text: textLines.join('\n'), html };
  }

  // action === 'sales_report'
  const rep = payload.salesReport || {
    periodLabel: 'Resumen de Ventas',
    totalOrders: 0,
    grossRevenueUSD: 0,
  };
  const grossUSD = Number(rep.grossRevenueUSD || 0);
  const grossBs = grossUSD * rate;
  const cogsUSD = Number(rep.costOfGoodsUSD || 0);
  const mermasUSD = Number(rep.mermasLossUSD || 0);
  const netProfitUSD =
    typeof rep.netProfitUSD === 'number'
      ? rep.netProfitUSD
      : Math.max(0, grossUSD - cogsUSD - mermasUSD);

  const isSingleReceipt = Boolean(rep.receiptNumber);
  const subject = sanitizeHeaderLine(
    isSingleReceipt
      ? `[VENTA #${rep.receiptNumber}] ${storeName} · $${grossUSD.toFixed(2)} USD`
      : `[REPORTE DE VENTAS] ${storeName} · ${rep.periodLabel} · $${grossUSD.toFixed(2)} USD`
  );

  const textLines = [
    `REPORTE DE VENTAS — ${storeName}`,
    `Período / Referencia: ${rep.receiptNumber ? `Recibo #${rep.receiptNumber}` : rep.periodLabel}`,
    rep.customerName ? `Cliente: ${rep.customerName}` : '',
    rep.paymentMethod ? `Método de pago: ${rep.paymentMethod}` : '',
    `Órdenes: ${rep.totalOrders} | Facturación Bruta: $${grossUSD.toFixed(2)} USD (≈ ${grossBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.)`,
    cogsUSD > 0 ? `Costo de Reposición: -$${cogsUSD.toFixed(2)} USD` : '',
    mermasUSD > 0 ? `Mermas / Auditoría: -$${mermasUSD.toFixed(2)} USD` : '',
    `Ganancia Neta Estimada: $${netProfitUSD.toFixed(2)} USD`,
    ``,
    rep.topItems && rep.topItems.length > 0 ? 'Productos destacados:' : '',
    ...(rep.topItems || []).map(
      (it) => `• ${it.quantity}x ${it.name} — $${Number(it.revenueUSD).toFixed(2)} USD`
    ),
    ``,
    `Emitido el ${nowStr} (Tasa: ${rate.toFixed(2)} Bs/USD)`,
  ].filter(Boolean);

  const paymentRows = (rep.paymentBreakdown || [])
    .map(
      (pm) => `
      <tr style="border-top:1px solid #27272a;">
        <td style="padding:8px 12px;color:#e4e4e7;">${escapeHtml(pm.method)}</td>
        <td style="padding:8px 12px;text-align:center;color:#a1a1aa;font-family:monospace;">${pm.count}</td>
        <td style="padding:8px 12px;text-align:right;color:#fbbf24;font-weight:700;font-family:monospace;">$${Number(pm.totalUSD).toFixed(2)}</td>
      </tr>
    `
    )
    .join('');

  const topItemRows = (rep.topItems || [])
    .map(
      (it) => `
      <tr style="border-top:1px solid #27272a;">
        <td style="padding:8px 12px;color:#ffffff;">${escapeHtml(it.name)}</td>
        <td style="padding:8px 12px;text-align:center;color:#d4d4d8;font-family:monospace;">${it.quantity}</td>
        <td style="padding:8px 12px;text-align:right;color:#34d399;font-weight:700;font-family:monospace;">$${Number(it.revenueUSD).toFixed(2)}</td>
      </tr>
    `
    )
    .join('');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:660px;margin:0 auto;background:#09090b;color:#f4f4f5;padding:24px;border-radius:14px;border:1px solid #27272a;">
      <div style="border-bottom:1px solid #27272a;padding-bottom:14px;margin-bottom:18px;">
        <div style="font-size:11px;letter-spacing:1.2px;color:#fbbf24;font-weight:700;">REPORTE DE VENTAS & RENTABILIDAD</div>
        <h2 style="margin:6px 0 0;color:#ffffff;font-size:20px;">${escapeHtml(storeName)}</h2>
        <p style="margin:4px 0 0;font-size:12px;color:#a1a1aa;">
          ${escapeHtml(rep.receiptNumber ? `Ticket #${rep.receiptNumber}` : rep.periodLabel)} · ${escapeHtml(nowStr)}
        </p>
      </div>

      <table style="width:100%;border-collapse:separate;border-spacing:8px 0;margin:0 -8px 18px;">
        <tr>
          <td style="background:#111114;border:1px solid #27272a;border-radius:10px;padding:12px;width:33%;">
            <div style="font-size:11px;color:#a1a1aa;">Facturación Bruta</div>
            <div style="font-size:18px;font-weight:800;color:#fbbf24;font-family:monospace;margin-top:4px;">$${grossUSD.toFixed(2)}</div>
            <div style="font-size:11px;color:#71717a;font-family:monospace;">${grossBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.</div>
          </td>
          <td style="background:#111114;border:1px solid #27272a;border-radius:10px;padding:12px;width:33%;">
            <div style="font-size:11px;color:#a1a1aa;">Ganancia Neta Est.</div>
            <div style="font-size:18px;font-weight:800;color:#34d399;font-family:monospace;margin-top:4px;">$${netProfitUSD.toFixed(2)}</div>
            <div style="font-size:11px;color:#71717a;font-family:monospace;">COGS -$${cogsUSD.toFixed(2)}</div>
          </td>
          <td style="background:#111114;border:1px solid #27272a;border-radius:10px;padding:12px;width:33%;">
            <div style="font-size:11px;color:#a1a1aa;">Órdenes Procesadas</div>
            <div style="font-size:18px;font-weight:800;color:#ffffff;font-family:monospace;margin-top:4px;">${rep.totalOrders}</div>
            <div style="font-size:11px;color:#71717a;">${escapeHtml(rep.paymentMethod || 'Multimétodo')}</div>
          </td>
        </tr>
      </table>

      ${
        rep.customerName
          ? `<div style="background:#111114;border:1px solid #27272a;border-radius:10px;padding:12px 14px;font-size:13px;margin-bottom:16px;">
              <div><span style="color:#a1a1aa;">Cliente:</span> <strong style="color:#ffffff;">${escapeHtml(rep.customerName)}</strong></div>
              ${rep.cashierName ? `<div><span style="color:#a1a1aa;">Caja / Responsable:</span> <span style="color:#d4d4d8;">${escapeHtml(rep.cashierName)}</span></div>` : ''}
            </div>`
          : ''
      }

      ${
        paymentRows
          ? `<div style="background:#111114;border:1px solid #27272a;border-radius:10px;overflow:hidden;margin-bottom:16px;">
              <div style="padding:10px 12px;font-size:12px;font-weight:700;color:#fbbf24;background:#18181b;">Desglose por Método de Pago</div>
              <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <tbody>${paymentRows}</tbody>
              </table>
            </div>`
          : ''
      }

      ${
        topItemRows
          ? `<div style="background:#111114;border:1px solid #27272a;border-radius:10px;overflow:hidden;margin-bottom:16px;">
              <div style="padding:10px 12px;font-size:12px;font-weight:700;color:#ffffff;background:#18181b;">Detalle de Productos Vendidos</div>
              <table style="width:100%;border-collapse:collapse;font-size:12px;">
                <tbody>${topItemRows}</tbody>
              </table>
            </div>`
          : ''
      }

      <p style="font-size:11px;color:#71717a;margin:14px 0 0;">
        Tasa de referencia aplicada: ${rate.toFixed(2)} Bs/USD · Reporte generado por Smith Solutions E-Commerce
      </p>
    </div>
  `;

  return { subject, text: textLines.join('\n'), html };
}

export async function handleStoreEmailDispatch(
  payload: StoreEmailDispatchPayload,
  authHeader?: string
): Promise<StoreEmailDispatchResponse> {
  const verified = await verifyAuthenticatedUserBearerToken(authHeader);
  if (!verified.ok) {
    return {
      ok: false,
      status: 403,
      message: 'Sesión no autorizada. Inicia sesión con Google verificado para enviar correos.',
      error: 'UNAUTHORIZED',
    };
  }

  const cfg = payload?.config;
  const overrideTestEmail =
    payload.action === 'test' && isValidEmail(payload.testRecipientEmail)
      ? payload.testRecipientEmail.trim()
      : undefined;
  const targetEmail = overrideTestEmail || (isValidEmail(cfg?.recipientEmail) ? cfg!.recipientEmail.trim() : '');

  if (!cfg || !targetEmail) {
    return {
      ok: false,
      status: 400,
      stage: 'syntax',
      message: 'Ingresa un correo electrónico destinatario válido para realizar el envío.',
      error: 'INVALID_RECIPIENT',
    };
  }

  const toEmail = targetEmail;
  const ccEmail =
    payload.action !== 'test' &&
    isValidEmail(cfg.secondaryEmail) &&
    cfg.secondaryEmail.trim().toLowerCase() !== toEmail.toLowerCase()
      ? cfg.secondaryEmail.trim()
      : undefined;

  const { subject, text, html } = buildEmailContent(payload, verified.email);
  const fromName = sanitizeHeaderLine(cfg.fromName || payload.storeName || 'Smith Solutions', 80);
  const startedAt = Date.now();
  const testedAt = new Date().toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  if (cfg.provider === 'smtp') {
    const host = sanitizeHeaderLine(cfg.smtpHost || '', 160);
    const port = Number(cfg.smtpPort || 587);
    const secure = typeof cfg.smtpSecure === 'boolean' ? cfg.smtpSecure : port === 465;
    const user = sanitizeHeaderLine(cfg.smtpUser || '', 160);
    const pass = String(cfg.smtpPass || '');

    if (!host || !/^[a-zA-Z0-9.-]+$/.test(host) || !host.includes('.') || isBlockedInternalSmtpHost(host)) {
      return {
        ok: false,
        status: 400,
        stage: 'syntax',
        message: 'Ingresa un servidor SMTP externo válido (ej. smtp.gmail.com o smtp-relay.brevo.com).',
        error: 'INVALID_OR_BLOCKED_HOST',
      };
    }

    if (!user || !pass || Number.isNaN(port) || port < 1 || port > 65535) {
      return {
        ok: false,
        status: 400,
        stage: 'syntax',
        message: 'Completa Servidor SMTP (host), Puerto (1-65535), Usuario y Contraseña.',
        error: 'INCOMPLETE_SMTP_CONFIG',
      };
    }

    const fromAddress = isValidEmail(cfg.fromEmail)
      ? cfg.fromEmail.trim()
      : isValidEmail(user)
        ? user
        : toEmail;

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      if (payload.action === 'test') {
        await transporter.verify();
      }

      const info = await transporter.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to: toEmail,
        cc: ccEmail,
        replyTo: verified.email || fromAddress,
        subject,
        text,
        html,
      });
      const latencyMs = Math.max(1, Date.now() - startedAt);
      transporter.close?.();

      return {
        ok: true,
        deliveryChannel: 'smtp',
        messageId: info.messageId,
        latencyMs,
        testedAt,
        recipientEmail: toEmail,
        message: `Email de prueba enviado correctamente vía SMTP (${host}:${port}) a ${toEmail} en ${latencyMs} ms.`,
      };
    } catch (err) {
      const latencyMs = Math.max(1, Date.now() - startedAt);
      const friendly = formatFriendlySmtpError(err, host, port, secure);
      return {
        ok: false,
        status: 502,
        deliveryChannel: 'smtp',
        latencyMs,
        testedAt,
        recipientEmail: toEmail,
        stage: friendly.stage,
        message: friendly.message,
        error: friendly.raw,
      };
    }
  }

  // Provider: Resend API
  const resendKey = String(cfg.resendApiKey || '').trim();
  if (!resendKey || !resendKey.startsWith('re_') || resendKey.length < 10) {
    return {
      ok: false,
      status: 400,
      stage: 'api_key',
      message: 'Ingresa una clave de API de Resend válida (debe iniciar con re_...).',
      error: 'INVALID_RESEND_API_KEY',
    };
  }

  const fromEmail = isValidEmail(cfg.fromEmail)
    ? cfg.fromEmail.trim()
    : 'onboarding@resend.dev';

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromEmail}>`,
        to: [toEmail],
        cc: ccEmail ? [ccEmail] : undefined,
        reply_to: verified.email || toEmail,
        subject,
        text,
        html,
      }),
    });

    const latencyMs = Math.max(1, Date.now() - startedAt);
    const bodyText = await resp.text();
    let parsed: { id?: string; message?: string; name?: string } = {};
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      parsed = { message: bodyText };
    }

    if (!resp.ok) {
      const rawErr = parsed?.message || `HTTP ${resp.status} desde Resend API`;
      const lowerErr = rawErr.toLowerCase();
      let friendlyMsg = `Error Resend API (${resp.status}): ${rawErr}`;
      let stage: StoreEmailDispatchResponse['stage'] = 'api_key';

      if (resp.status === 401 || resp.status === 403 || lowerErr.includes('api key')) {
        if (lowerErr.includes('testing emails') || lowerErr.includes('verify a domain')) {
          stage = 'sender';
          friendlyMsg = `Resend API rechazó el envío porque estás en modo prueba o sin dominio verificado: envía al correo dueño de tu cuenta Resend o verifica tu dominio en resend.com/domains. (${rawErr})`;
        } else {
          stage = 'api_key';
          friendlyMsg = `API Key de Resend inválida o revocada. Verifica tu clave re_... en resend.com/api-keys. (${rawErr})`;
        }
      } else if (lowerErr.includes('domain') || lowerErr.includes('from')) {
        stage = 'sender';
        friendlyMsg = `Dominio remitente no verificado en Resend. Deja vacío "Correo Remitente" para usar onboarding@resend.dev o verifica tu dominio. (${rawErr})`;
      }

      return {
        ok: false,
        status: 502,
        deliveryChannel: 'resend',
        latencyMs,
        testedAt,
        recipientEmail: toEmail,
        stage,
        message: friendlyMsg,
        error: rawErr,
      };
    }

    return {
      ok: true,
      deliveryChannel: 'resend',
      messageId: parsed.id,
      latencyMs,
      testedAt,
      recipientEmail: toEmail,
      message: `Email de prueba enviado vía Resend API a ${toEmail} en ${latencyMs} ms${parsed.id ? ` (ID: ${parsed.id})` : ''}.`,
    };
  } catch (err) {
    const latencyMs = Math.max(1, Date.now() - startedAt);
    const msg = err instanceof Error ? err.message : 'Error de red contactando a Resend API';
    return {
      ok: false,
      status: 502,
      deliveryChannel: 'resend',
      latencyMs,
      testedAt,
      recipientEmail: toEmail,
      stage: 'network',
      message: `Error Resend API: ${msg}`,
      error: msg,
    };
  }
}

export interface VerifySmtpPayload {
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
}

export interface VerifySmtpResponse {
  ok: boolean;
  status?: number;
  latencyMs?: number;
  authVerified?: boolean;
  stage?: 'syntax' | 'network' | 'auth' | 'unauthorized';
  host?: string;
  port?: number;
  secure?: boolean;
  message: string;
  error?: string;
}

function formatFriendlySmtpError(
  err: unknown,
  host: string,
  port: number,
  secure: boolean
): { stage: 'network' | 'auth'; message: string; raw: string } {
  const errObj = err as { code?: string; responseCode?: number; command?: string; message?: string };
  const raw = errObj?.message || 'Error de conexión SMTP';
  const code = String(errObj?.code || '').toUpperCase();
  const responseCode = Number(errObj?.responseCode || 0);
  const lower = raw.toLowerCase();

  if (
    code === 'EAUTH' ||
    responseCode === 535 ||
    responseCode === 534 ||
    responseCode === 530 ||
    lower.includes('invalid login') ||
    lower.includes('authentication failed') ||
    lower.includes('username and password not accepted') ||
    lower.includes('535')
  ) {
    return {
      stage: 'auth',
      raw,
      message: `Autenticación rechazada en ${host}:${port}. Verifica el usuario SMTP y utiliza una Contraseña de Aplicación (App Password).`,
    };
  }

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN' || lower.includes('getaddrinfo')) {
    return {
      stage: 'network',
      raw,
      message: `No se pudo resolver el servidor "${host}". Verifica que el host SMTP esté escrito correctamente.`,
    };
  }

  if (code === 'ECONNREFUSED') {
    return {
      stage: 'network',
      raw,
      message: `Conexión rechazada en ${host}:${port}. Verifica que el puerto (${port}) acepte conexiones SMTP.`,
    };
  }

  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || lower.includes('timeout')) {
    return {
      stage: 'network',
      raw,
      message: `Tiempo de espera agotado al hacer ping a ${host}:${port}. Prueba cambiar entre puerto 465 (SSL) y 587 (STARTTLS).`,
    };
  }

  if (
    lower.includes('wrong version number') ||
    lower.includes('ssl') ||
    lower.includes('tls') ||
    code === 'EPROTO' ||
    code.startsWith('ERR_SSL')
  ) {
    return {
      stage: 'network',
      raw,
      message: `Incompatibilidad SSL/TLS en ${host}:${port}. ${
        secure
          ? 'Prueba desactivar "SSL / TLS (465)" o usar el puerto 587.'
          : 'Prueba activar "SSL / TLS (465)" o usar el puerto 465.'
      }`,
    };
  }

  return {
    stage: 'network',
    raw,
    message: `Fallo al conectar con ${host}:${port}: ${raw}`,
  };
}

export async function handleVerifySmtpConnection(
  payload: VerifySmtpPayload,
  authHeader?: string
): Promise<VerifySmtpResponse> {
  const verified = await verifyAuthenticatedUserBearerToken(authHeader);
  if (!verified.ok) {
    return {
      ok: false,
      status: 403,
      stage: 'unauthorized',
      message: 'Inicia sesión con Google verificado para ejecutar la prueba de conexión SMTP.',
      error: 'UNAUTHORIZED',
    };
  }

  const host = sanitizeHeaderLine(payload?.smtpHost || '', 160);
  const port = Number(payload?.smtpPort || 587);
  const secure = typeof payload?.smtpSecure === 'boolean' ? payload.smtpSecure : port === 465;
  const user = sanitizeHeaderLine(payload?.smtpUser || '', 160);
  const pass = String(payload?.smtpPass || '');

  if (!host || !/^[a-zA-Z0-9.-]+$/.test(host) || !host.includes('.')) {
    return {
      ok: false,
      status: 400,
      stage: 'syntax',
      host,
      port,
      secure,
      message: 'Ingresa un servidor SMTP (host) válido, por ejemplo smtp.gmail.com.',
      error: 'INVALID_HOST',
    };
  }

  if (isBlockedInternalSmtpHost(host)) {
    return {
      ok: false,
      status: 400,
      stage: 'syntax',
      host,
      port,
      secure,
      message: 'Host SMTP no permitido para verificación remota.',
      error: 'BLOCKED_HOST',
    };
  }

  if (Number.isNaN(port) || port < 1 || port > 65535) {
    return {
      ok: false,
      status: 400,
      stage: 'syntax',
      host,
      port,
      secure,
      message: 'El puerto SMTP debe estar entre 1 y 65535 (comúnmente 465 o 587).',
      error: 'INVALID_PORT',
    };
  }

  const hasCredentials = Boolean(user && pass);
  const startedAt = Date.now();

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      ...(hasCredentials ? { auth: { user, pass } } : {}),
      connectionTimeout: 6500,
      greetingTimeout: 6500,
      socketTimeout: 8000,
    });

    await transporter.verify();
    const latencyMs = Math.max(1, Date.now() - startedAt);
    transporter.close?.();

    if (!hasCredentials) {
      return {
        ok: false,
        status: 400,
        latencyMs,
        authVerified: false,
        stage: 'auth',
        host,
        port,
        secure,
        message: `Ping TCP/SMTP exitoso a ${host}:${port} (${latencyMs} ms), pero faltan Usuario y Contraseña SMTP para validar credenciales.`,
        error: 'MISSING_CREDENTIALS',
      };
    }

    return {
      ok: true,
      latencyMs,
      authVerified: true,
      stage: 'auth',
      host,
      port,
      secure,
      message: `Ping SMTP exitoso · ${host}:${port} (${secure ? 'SSL/TLS' : 'STARTTLS'}) autenticado en ${latencyMs} ms.`,
    };
  } catch (err) {
    const latencyMs = Math.max(1, Date.now() - startedAt);
    const friendly = formatFriendlySmtpError(err, host, port, secure);
    return {
      ok: false,
      status: 502,
      latencyMs,
      authVerified: false,
      stage: friendly.stage,
      host,
      port,
      secure,
      message: friendly.message,
      error: friendly.raw,
    };
  }
}
