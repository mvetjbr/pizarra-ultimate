# ADR 0013 · Muñecos del conteo: premios que elige la persona

- **Estado:** aceptada
- **Fecha:** 2026-11-25

## Contexto
El conteo de 10 muestra un muñeco sobre la cancha. Al principio había 8 muñecos libres y 5 mascotas (jaguar, toro, fresa, tornado, disco) que se desbloqueaban **en orden fijo**, una por cada 5 jugadas guardadas. Se agregan 7 mascotas más (porro, planta, duende, chancla, títere, Jesús y Buda) y se pide que la persona **elija** cuál desbloquear cada vez que gana un premio. Esta decisión no estaba escrita en ningún lado, y el sistema de premios va a seguir creciendo.

## Decisión
- **Dónde están los dibujos:** en `src/conteo/munecosSvg.ts`, como SVG propios de la app (constantes del código, nunca contenido externo).
  - Usan el viewBox `-6 -8 82 104`, la sombra en el piso en `y = 93` y el contorno en tinta `#1e2a33`.
  - Los brazos van en `<g class="armL">` y `<g class="armR">`, que giran desde (26, 46) y (44, 46).
  - La boca lleva la clase `mth`, para animarla al hablar.
- **Qué muñecos hay:** las listas están en `src/conteo/munecos.ts`.
  - `MUNECOS_BASICOS`: siempre libres.
  - `MASCOTAS`: se ganan. El orden de la lista es el de la grilla, no el del desbloqueo.
- **Premios:**
  - Cada 5 jugadas en la biblioteca (`JUGADAS_POR_MASCOTA`) dan un premio.
  - Los premios pendientes son: premios ganados − mascotas ya elegidas.
- **Qué se guarda:** la lista `mascotasElegidas`, dentro de las preferencias (`pizarra:preferencias`, en IndexedDB de este dispositivo).
  - Una mascota elegida queda desbloqueada para siempre, aunque después se borren jugadas.
  - Si se borran jugadas, los premios pendientes no bajan de 0.
- **Cómo se elige:**
  - Cuando el número de jugadas alcanza un premio nuevo, se abre la ventana "¡Ganaste un muñeco!" con las mascotas bloqueadas. La persona toca una y la confirma. También puede cerrarla con "Luego".
  - Si cierra con "Luego", el premio queda pendiente. En Ajustes del conteo, al tocar una mascota bloqueada, se usa un premio pendiente para desbloquearla.
- **Paso desde el sistema viejo:** si las preferencias guardadas no traen `mascotasElegidas`, se llena con las primeras N mascotas del orden viejo (N = jugadas ÷ 5). Así nadie pierde lo que ya tenía.
- **Modo editor** (7 toques en "Muñeco"): todas las mascotas quedan libres en este dispositivo y no aparece la ventana.

## Consecuencias
- Es un juego local, no una medida de seguridad. Quien edite IndexedDB puede desbloquear todo, y no importa.
- Los premios no viajan a la nube ni a otros dispositivos. Si algún día se sincronizan, hará falta un ADR nuevo. (Actualización: desde el [ADR 0014](0014-mascota-en-la-cuenta.md), con sesión iniciada la mascota y las desbloqueadas viajan con la cuenta.)
- Para agregar un muñeco:
  1. Se dibuja en `munecosSvg.ts` con las reglas de arriba.
  2. Se suma a `MUNECOS_BASICOS` o a `MASCOTAS`.
- Para cambiar la regla de premios (por ejemplo, premios por presentar o compartir), se cambia la cuenta de premios ganados en `munecos.ts`. La ventana y la lista guardada no cambian.
