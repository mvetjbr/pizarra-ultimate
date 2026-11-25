# Decisiones de arquitectura (ADR)

Cada archivo registra una decisión: qué la motivó, qué se decidió y qué consecuencias trae. Las decisiones no se borran. Si una cambia, se escribe un ADR nuevo y el anterior se marca como **reemplazada por 00XX**.

| N.º | Decisión | Estado |
|---|---|---|
| [0001](0001-app-principal-vite.md) | La app principal es la de Vite + React + TypeScript | aceptada |
| [0002](0002-supabase-mismo-proyecto.md) | Supabase como nube, en el mismo proyecto que ya existía | aceptada |
| [0003](0003-consentimientos-solo-insercion.md) | Consentimientos que solo se insertan, encadenados con SHA-256 | aceptada |
| [0004](0004-textos-legales-versionados.md) | Textos legales versionados, inmutables y con huella (LF) | aceptada |
| [0005](0005-registro-en-funcion-del-servidor.md) | El registro y las aceptaciones pasan por funciones del servidor | aceptada |
| [0006](0006-enlace-compartir-sin-nombres.md) | El enlace para compartir no lleva nombres de jugadores | aceptada |
| [0007](0007-menores-de-edad.md) | Menores de edad: bloqueados por ahora | aceptada (temporal) |
| [0008](0008-despliegue.md) | Cloudflare Pages como destino y build bloqueado por textos incompletos | aceptada (pendiente) |

Plantilla para uno nuevo: `# ADR 00XX · Título`, seguido de Estado, Fecha, Contexto, Decisión y Consecuencias.
