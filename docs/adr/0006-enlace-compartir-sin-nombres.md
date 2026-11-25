# ADR 0006 · El enlace para compartir no lleva nombres de jugadores

- **Estado:** aceptada
- **Fecha:** 2026-11-11

## Contexto
El enlace `#/ver/…` lleva la jugada completa comprimida con lz-string dentro de la URL. Las URL quedan en historiales, chats y registros de servidores. Los nombres del roster son datos personales.

## Decisión
- Al generar el enlace se quitan `nombre` y `rosterId` de cada jugador, es decir, de los objetos que tienen `equipo`.
- El nombre de la jugada se mantiene.
- Compartir con permisos de ver o editar pasará por la nube en las fases siguientes (5C y 5D), no por la URL.

## Consecuencias
- Quien abre el enlace ve las posiciones y los movimientos, pero no quién es cada jugador.
- Para ver los nombres hay que compartir la jugada desde la cuenta, cuando exista esa opción.
