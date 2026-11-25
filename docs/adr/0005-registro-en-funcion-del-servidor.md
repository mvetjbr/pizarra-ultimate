# ADR 0005 · El registro y las aceptaciones pasan por funciones del servidor

- **Estado:** aceptada
- **Fecha:** 2026-11-12

## Contexto
Si la app escribiera los consentimientos directamente, la IP, la hora y el texto de la casilla vendrían del navegador, que se puede manipular. Además, la cuenta, el perfil y los consentimientos deben crearse juntos.

## Decisión
- Hay tres Edge Functions:
  - `registro` valida los datos, clasifica la edad, crea la cuenta, inserta el perfil y los dos consentimientos con la IP y la hora del servidor, y envía el correo de verificación;
  - `aceptar` registra la nueva aceptación cuando cambia un texto;
  - `eliminar-cuenta` pide escribir `ELIMINAR MI CUENTA`, seudonimiza y borra.
- Las reglas de validación están en `supabase/functions/_compartido/reglas.ts` y las usan tanto el cliente como el servidor.
- Las funciones van con `verify_jwt = false`, porque la clave nueva `sb_publishable_…` no es un JWT. Cada función verifica la sesión por dentro con `usuarioDe`.
- CORS solo admite los orígenes de la app: pages.dev, GitHub Pages y localhost. El enlace de verificación del correo solo puede volver a esos mismos orígenes (`redireccionPermitida`).

## Consecuencias
- La evidencia queda generada por el servidor y es confiable.
- Cada cambio en una función hay que desplegarlo con `supabase functions deploy <nombre> --project-ref dvdixliuqziremlythxv`.
- Si se agrega un dominio nuevo hay que sumarlo en `ORIGENES_PERMITIDOS` y en las Redirect URLs de Auth.
