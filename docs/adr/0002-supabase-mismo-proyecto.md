# ADR 0002 · Supabase como nube, en el mismo proyecto que ya existía

- **Estado:** aceptada
- **Fecha:** 2026-11-13

## Contexto
Para tener cuentas, playbooks y compartir con permisos hace falta un servidor. La versión del celular ya usaba un proyecto de Supabase, `dvdixliuqziremlythxv` en São Paulo, con las tablas `docs`, `admins`, `contadores` y `mascotas`.

## Decisión
- Se usa Supabase: Postgres con RLS, Auth y Edge Functions.
- Las tablas de la fase 5A se crean en ese mismo proyecto, sin tocar las que ya existían.
- La app solo conoce la URL y la clave pública (`sb_publishable_…`), que vienen de las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`.
- La clave secreta nunca sale del servidor.
- Los cambios de esquema viven en `supabase/migrations/`. Antes de aplicarse se prueban en Postgres local con PGlite (32 verificaciones). Mientras no haya CLI con contraseña de base de datos, se aplican pegando `supabase/para-pegar-en-supabase-fase-5a.sql` en el SQL Editor, dentro de una sola transacción.

## Consecuencias
- No hay que administrar servidores y el plan gratuito alcanza para un equipo.
- Las cuentas creadas en la app de Cloudflare con Google no tienen perfil ni consentimientos en el esquema 5A. Hay que resolver esa migración antes de reemplazarla.
- El correo de Supabase tiene un límite muy bajo, así que hará falta un SMTP propio (por ejemplo Resend) antes de invitar al equipo.
- Toda la seguridad de los datos depende de las políticas RLS, por eso se prueban.
