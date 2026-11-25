# ADR 0008 · Despliegue: Cloudflare Pages como destino y build bloqueado por textos incompletos

- **Estado:** aceptada (Cloudflare pendiente de ejecutar)
- **Fecha:** 2026-11-13

## Contexto
La app está publicada en GitHub Pages (`mvetjbr.github.io/pizarra-ultimate`). El equipo ya conoce `pizarra-ultimate.pages.dev`, que hoy sirve la versión del celular.

## Decisión
- El destino principal será `pizarra-ultimate.pages.dev`, que pasará a servir la app de Vite una vez probada la fase 5A. GitHub Pages queda como espejo.
- El workflow `.github/workflows/deploy.yml` corre `node scripts/legal.mjs verificar` antes del build. **Si algún texto legal tiene marcadores sin llenar, no se publica.**
- Las variables `VITE_SUPABASE_*` salen de las *variables* del repositorio, no de los secretos, porque son públicas por diseño.
- Cada publicación se confirma antes con el responsable.

## Consecuencias
- No se puede publicar por accidente una versión con cuentas y textos legales incompletos.
- Antes del cambio a Cloudflare hay que hacer tres cosas:
  - llenar los datos del responsable;
  - resolver las cuentas de Google existentes;
  - configurar las Redirect URLs de Auth.
