# ADR 0001 · La app principal es la de Vite + React + TypeScript

- **Estado:** aceptada
- **Fecha:** 2026-11-12

## Contexto
Había dos versiones de la pizarra. Una está hecha con Vite + React + TypeScript y la otra es un solo `index.html` que se construyó desde el celular y está publicado en `pizarra-ultimate.pages.dev`. Mantener las dos duplicaba el trabajo y hacía que se fueran separando.

## Decisión
- La app principal es la de Vite, en el repositorio `pizarra-ultimate`.
- La versión del celular se guarda aparte, en `pizarra-ultimate-celular/`, solo como referencia.
- Sus funciones útiles se pasaron a la app de Vite: cantidad de jugadores de 0 a 7, proporción 4M-3F / 3M-4F / sin género y muñecos del conteo.
- Los datos locales viven en el navegador (IndexedDB con idb-keyval) y la app funciona sin conexión como PWA (vite-plugin-pwa).

## Consecuencias
- Hay una sola base de código, con tipos estrictos y build reproducible.
- La app de Cloudflare se reemplazará por la de Vite cuando la fase 5A esté probada.
- Lo que se haga en el celular hay que portarlo a mano a esta app.
