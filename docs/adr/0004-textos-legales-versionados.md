# ADR 0004 · Textos legales versionados, inmutables y con huella

- **Estado:** aceptada
- **Fecha:** 2026-11-11 (ajustada el 2026-11-13)

## Contexto
Un consentimiento debe remitir al texto exacto que la persona aceptó. Si el texto cambia sin control, la prueba se pierde.

## Decisión
- Los textos viven en el repositorio como `legal/<tipo>/v<versión>.md`. La versión vigente de cada tipo está en `legal/vigentes.json` y sus hashes en `legal/hashes.json`.
- `scripts/legal.mjs` hace tres cosas:
  - calcula los hashes;
  - verifica que no quede ningún `[MARCADOR]` sin llenar;
  - genera la migración SQL que carga los documentos.
- En la tabla `legal_documents` no se puede editar ni borrar una versión ya cargada, y el hash tiene que coincidir con el texto. Para cambiar un texto se publica una versión nueva con `publicar_documento`.
- **La huella siempre se calcula con saltos de línea LF**, tanto en Node como en el navegador y en Postgres. El trigger normaliza CRLF a LF antes de verificar, porque al pegar el SQL desde Windows los saltos llegan como CRLF. Ese fue el error del 2026-11-13. Además, `.gitattributes` fija `eol=lf` en `legal/` y `supabase/`.
- Cuando cambia la versión vigente de términos o de privacidad, `documentos_pendientes()` lo detecta y la app pide aceptarla de nuevo.

## Consecuencias
- Cada consentimiento remite a un texto que se puede verificar byte a byte.
- Para corregir una errata hay que publicar una versión nueva.
- El build de producción falla mientras haya marcadores sin llenar (ver ADR 0008).
