# ADR 0007 · Menores de edad: bloqueados por ahora

- **Estado:** aceptada (temporal)
- **Fecha:** 2026-11-12

## Contexto
La Ley 1098 de 2006, la Ley 2489 de 2025 y el Decreto 0769 de 2026 exigen autorización del representante legal y protecciones adicionales para niñas, niños y adolescentes. El flujo con el representante (enlace por correo y registro de su aceptación) todavía no está construido.

## Decisión
- La fecha de nacimiento es obligatoria, se usa solo para verificar la edad y la persona no puede cambiarla después.
- Si la persona tiene menos de 14 años, el registro se rechaza.
- Si tiene de 14 a 17 años, la app muestra "disponible pronto" y no crea la cuenta.
- El esquema ya admite consentimientos con `actor = representante_legal`, para cuando se construya ese flujo (fase 5E).

## Consecuencias
- Por ahora solo pueden registrarse adultos.
- Los integrantes menores del equipo pueden usar la pizarra sin cuenta, solo en su dispositivo.
- Habrá que revisar esta decisión al llegar a la fase 5E.
