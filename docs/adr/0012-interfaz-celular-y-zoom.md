# ADR 0012 · En el celular la cancha sigue al aparato, con zoom con dos dedos

- **Estado:** aceptada
- **Fecha:** 2026-11-24

## Contexto
En un celular de pie, la cancha horizontal ocupaba un tercio de la pantalla y las fichas medían unos 8 px. Además la barra superior escondía Compartir y Cuenta.

## Decisión
- **Orientación:** en celulares la cancha se dibuja vertical si el teléfono está de pie y horizontal si está acostado. La orientación guardada en la jugada no cambia y se respeta en computador y en las exportaciones.
- **Fichas:** en pantallas pequeñas se dibujan hasta 1,5 veces más grandes.
- **Zoom:** se hace con dos dedos (hasta 5x) o con la rueda del mouse; con un dedo en un espacio vacío se mueve la cancha. Hay un botón para volver a ver toda la cancha.
- **Toques seguros:** "Borrar" y "Texto" actúan al levantar el dedo. Si se pone un segundo dedo en medio de un arrastre, se deshace el arrastre. Así un zoom nunca cambia la jugada.
- **Barra superior en el celular:** solo muestra Biblioteca, el nombre, deshacer/rehacer, Compartir y "⋯". Lo demás pasa al menú.

## Consecuencias
- En el celular el botón "Rotar" no aparece, porque la orientación la decide el aparato.
- El zoom es solo de la vista: no se guarda en la jugada.
