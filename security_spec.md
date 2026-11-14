# Security Specification — Smith Solutions E-Commerce Multi-SaaS

## 1. Core Data Invariants
1. **Exclusive Super Admin Identity**: Only Google-verified `empresaalhadiqainvest@gmail.com` (`request.auth.token.email_verified == true`) or an existing `/admins/{uid}` document can activate/deactivate store accounts, approve/reject subscription payments, send platform emails, issue referral reward coupons manually, or modify `/platformSettings/billing`.
2. **Self-Registration Guard (Anti-Privilege Escalation)**: When a store owner creates a `/stores/{storeId}` document, `status` MUST start as `'pending'`, `ownerUid` MUST equal `request.auth.uid`, `subscriptionPriceUSD` MUST be `25`, and `referralRewardGranted` MUST NOT be `true`. Owners can NEVER activate or unsuspend their own store (`status` updates are restricted to Super Admin).
3. **PII Isolation (Split Collection)**: Storefront public catalog fields live in `/stores/{storeId}` without personal email addresses; personal emails live strictly in `/stores/{storeId}/private/account` and `/subscriptionPayments/{paymentId}`, readable only by the owner (`ownerUid == request.auth.uid`) or Super Admin.
4. **Order Privacy & Integrity**: `/stores/{storeId}/orders/{orderId}` contains customer PII (name, RIF, phone, address). It is readable ONLY by the store owner, the ordering customer (`customerUid == request.auth.uid`), or Super Admin. Once an order reaches a terminal state (`completed` or `cancelled`), only Super Admin can modify it.
5. **Catalog Synchronization & Immutability**: Products in `/stores/{storeId}/products/{productId}` require parent store existence (`exists(/databases/$(database)/documents/stores/$(storeId))`), owner verification via `get()`, and immutable `storeId` / `ownerUid` / `createdAt`.
6. **Referral & Renewal Coupon Integrity**:
   - Store referral codes in `/referralCodes/{code}` contain ZERO PII and require valid parent store ownership on creation. Self-referrals (`referrerOwnerUid == referredOwnerUid`) are strictly blocked in both `/stores` creation and `/referrals` rules.
   - Store owners CANNOT forge, mint, or escalate discount values on `/coupons/{couponId}`. Only Super Admin can create `/coupons/{couponId}` or mark them `redeemed`. Store owners can ONLY transition an owned coupon from `available` to `applied` when attaching it to a valid `SubscriptionPayment`.
7. **Admin Email & Store Inbox Integrity**: `/adminEmails/{emailId}` is strictly Super Admin-only read/write. `/stores/{storeId}/inbox/{messageId}` is readable only by the store owner or Super Admin, creatable only by Super Admin, and the store owner can only toggle `isRead: true`.
8. **Strict Server Timestamps & Schema Locks**: Every document creation enforces `createdAt == request.time && updatedAt == request.time`, strict `hasAll` + `hasOnly` key checks, string `.size()` bounds, and regex ID validation (`^[a-zA-Z0-9_\-]+$`).

## 2. The "Dirty Dozen" Attack Payloads (Must All Return PERMISSION_DENIED)
1. **Self-Activation Bypass**: Store owner attempts `create /stores/s1` with `status: "active"` instead of `"pending"`.
2. **Owner Status Escalation**: Store owner attempts `update /stores/s1` changing `status` from `"pending"` to `"active"`.
3. **Unverified Admin Spoof**: Attacker signs in with `email: "empresaalhadiqainvest@gmail.com"` where `email_verified: false` and tries to update `/stores/s1`.
4. **Shadow Field Injection**: Owner creates `/stores/s1` with extra ghost field `isAdminVerified: true`.
5. **ID Poisoning**: Attacker creates `/stores/invalid$$id_1500chars...` exceeding 128 chars or invalid regex.
6. **Private PII Scraping**: Non-owner authenticated user tries `get /stores/s1/private/account`.
7. **Subscription Payment Hijack**: Store owner A creates `/subscriptionPayments/p1` claiming `ownerUid: "ownerB"` or `status: "approved"`.
8. **Platform Billing Tampering**: Non-admin user tries `update /platformSettings/billing` to swap Super Admin's Pago Móvil/Binance Pay receiving details.
9. **Cross-Tenant Product Injection**: Store owner A tries `create /stores/storeB/products/prod1` targeting Store B.
10. **Customer Order PII Scraping**: Random signed-in user tries `list /stores/s1/orders` without being Store Owner or Admin.
11. **Terminal Order Mutation**: Store owner tries to alter `totalUSD` on an order already in `status: "completed"`.
12. **Client Timestamp Forgery**: Attacker sends `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
13. **Coupon Forgery Attack**: Store owner attempts `create /coupons/c1` to grant themselves a `$25` discount coupon without referral payment approval.
14. **Self-Referral Abuse**: Store owner A creates a second store referring their own `referralCode` (`referrerOwnerUid == referredOwnerUid`).
15. **Admin Email Spoof**: Non-admin store owner attempts `create /stores/storeB/inbox/msg1` or `list /adminEmails`.
