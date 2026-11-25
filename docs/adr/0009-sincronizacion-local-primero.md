# ADR 0009 · Jugadas en la nube: primero el dispositivo, sincronización por versión

- **Estado:** aceptada
- **Fecha:** 2026-11-24

## Contexto
En la cancha a veces no hay señal, y la app debe seguir funcionando sin conexión. Al mismo tiempo, quien tiene cuenta quiere ver sus jugadas en el celular y en el computador.

## Decisión
- La biblioteca sigue guardándose en el dispositivo (IndexedDB). Con sesión iniciada, `src/nube/jugadas.ts` sincroniza con la tabla `plays` cada vez que hay cambios (a los 3 s), al volver la conexión, al volver a la app y cada minuto.
- Cada fila tiene una `version` que sube en cada cambio. Para subir un cambio se guarda solo si la versión de la nube es la que el dispositivo conocía (`update … where version = V`).
- Si una jugada cambió en los dos lados, gana la nube y la versión del dispositivo se guarda como copia "(copia de este dispositivo)". No se pierde nada.
- Lo borrado en un lado se borra en el otro (borrado lógico en la nube). Hay una protección: si de golpe falta más de la mitad de las jugadas, no se borra nada en la nube y se vuelven a bajar.
- La app genera los ids (UUID), así se pueden crear jugadas sin conexión.
- La primera vez que alguien ingresa en un dispositivo con jugadas guardadas, la app pregunta si subirlas a la cuenta. Si dice que no, quedan "solo en este dispositivo".
- Al cerrar sesión, las jugadas de la cuenta salen del dispositivo (siguen en la nube). Así, en un celular compartido, la siguiente persona no las ve.

## Consecuencias
- La sincronización es simple y no necesita servidor propio, pero no mezcla cambios dentro de una misma jugada: si dos dispositivos editan a la vez, uno de los dos queda como copia.
- Las jugadas viajan completas (JSON en `datos`). Es suficiente para el tamaño de un equipo.
