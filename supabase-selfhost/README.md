# Supabase Autohospedado (Respaldo / Switch de Autenticación)

Esta carpeta contiene la infraestructura lista para Docker (**PostgreSQL + GoTrue Auth + PostgREST + Kong Gateway**) para desplegar tu respaldo de Supabase desde GitHub hacia **Coolify, Railway, Render o un VPS** (ya que Vercel solo ejecuta funciones *serverless* y no puede alojar PostgreSQL persistente).

## Despliegue seguro en 4 pasos

1. **Sube esta configuración a GitHub (sin `.env`)**
   - `.gitignore` bloquea cualquier `.env` real; solo se versiona `.env.example`.
2. **Configura las variables secretas en tu panel de contenedores (Coolify / Railway / VPS)**
   - Copia las variables de `supabase-selfhost/.env.example`:
     - `POSTGRES_PASSWORD` (mínimo 32 caracteres aleatorios)
     - `JWT_SECRET` (mínimo 32 caracteres aleatorios)
     - `ANON_KEY` y `SERVICE_ROLE_KEY` (JWT firmados con `JWT_SECRET`)
     - `SUPABASE_PUBLIC_URL=https://supabase.tu-dominio.com`
     - `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET`
3. **Agrega el Callback en Google Cloud Console**
   - En **Credenciales → Cliente OAuth Web → URIs de redirección autorizados**, añade:
     `https://supabase.tu-dominio.com/auth/v1/callback`
4. **Conecta tu Frontend en Vercel y GitHub Pages**
   - Variables **públicas** de cliente (Vercel Env Vars y GitHub Actions Repository Variables):
     - `VITE_SUPABASE_URL=https://supabase.tu-dominio.com`
     - `VITE_SUPABASE_ANON_KEY=<tu_anon_key>`
   - Variables **exclusivas de servidor** en Vercel (NUNCA usar prefijo `VITE_`):
     - `SUPABASE_URL=https://supabase.tu-dominio.com`
     - `SUPABASE_SERVICE_ROLE_KEY=<tu_service_role_key>`

## Cómo opera el Switch automático en la app
- **Login principal:** Usa Firebase Authentication (con compatibilidad móvil Safari/iOS/Android/Mac).
- **Failover automático:** Si Firebase falla por error de red/caída de servicio (`auth/network-request-failed`, `auth/internal-error`, `auth/timeout`) y `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` están configurados, el sistema conmuta automáticamente a `@supabase/supabase-js` usando flujo **OAuth PKCE** móvil.
- **Espejo sincronizado en backend:** Cuando el usuario inicia con Firebase y existen `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` en Vercel/Express, `/api/auth/sync-backup` registra de forma segura la referencia en `public.synced_users` (protegida por RLS).
