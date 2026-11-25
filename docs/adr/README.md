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
| [0009](0009-sincronizacion-local-primero.md) | Jugadas en la nube: primero el dispositivo, sincronización por versión | aceptada |
| [0010](0010-compartir-por-enlace.md) | Compartir por enlace con permisos validados en la base de datos | aceptada |
| [0011](0011-libros-de-jugadas.md) | Libros de jugadas solo en la nube y siempre del mismo dueño | aceptada |
| [0012](0012-interfaz-celular-y-zoom.md) | En el celular la cancha sigue al aparato, con zoom con dos dedos | aceptada |
| [0013](0013-munecos-y-premios.md) | Muñecos del conteo: premios que elige la persona | aceptada |

Plantilla para uno nuevo: `# ADR 00XX · Título`, seguido de Estado, Fecha, Contexto, Decisión y Consecuencias.
