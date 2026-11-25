# Pizarra Ultimate — instrucciones para Claude

App web (PWA) en español para diseñar jugadas de Ultimate. Vite + React + TypeScript, Zustand, Supabase.

## Diseño (obligatorio)

**Antes de tocar cualquier cosa visual, lee [DESIGN.md](DESIGN.md) y síguelo.** Es el estilo vintage (afiche deportivo de los 70-80):
- **Colores:** como variables CSS. Nunca un hex suelto en un componente.
- **Fuentes:** Shrikhand en los títulos y Work Sans en todo lo demás.
- **Forma:** bordes de 3 px en tinta, sombras sólidas desplazadas, y los íconos con un círculo de color detrás.

Si una decisión de diseño no está en DESIGN.md, tómala con sus reglas y agrégala a DESIGN.md.

## Otros documentos

- **[docs/adr](docs/adr/README.md):** decisiones de arquitectura. Lee las que toquen lo que vas a cambiar.
- **[docs/FORMATO_JUGADAS.md](docs/FORMATO_JUGADAS.md):** formato JSON de las jugadas.
- **Pruebas de la base de datos:** `npm run prueba:sql`. Deben pasar antes de cambiar `supabase/migrations`.

## Reglas de trabajo

- **Idioma:** todo en español (interfaz, comentarios y documentos).
- **Celular primero:** todo se prueba a 375 px de ancho y en escritorio.
- **Textos legales:** no se publica una versión con cuentas mientras los textos legales tengan `[MARCADORES]` sin llenar.
- **Secretos:** nunca se sube la clave secreta de Supabase. `.env.local` no va a git.
