# ADR 0014 · La mascota viaja con la cuenta

- **Estado:** aceptada
- **Fecha:** 2026-11-26

## Contexto
La pantalla de inicio saluda con la mascota elegida en el conteo. Esa mascota, y las desbloqueadas con premios (ADR 0013), se guardaban solo en el dispositivo: con la misma cuenta, el celular podía saludar con el vikingo y el computador con el alien. Se pide que la mascota se guarde en la cuenta.

## Decisión
- **Dónde:** dos columnas nuevas en `profiles`: `muneco` (la elegida) y `mascotas_elegidas` (las desbloqueadas). Migración `20261126000100_mascota_en_perfil.sql`. Cada persona solo puede cambiar las suyas (permiso de columna + la regla "Corregir mi perfil").
- **Al ingresar** en un dispositivo:
  - la mascota de la cuenta reemplaza la del dispositivo;
  - las desbloqueadas se **juntan** (las del dispositivo más las de la cuenta), para que nadie pierda una mascota;
  - si la cuenta aún no tenía mascota, se sube la del dispositivo.
- **Al cambiarla** con la sesión iniciada, se guarda en la cuenta (`src/nube/mascota.ts`, con una espera corta para no escribir en cada toque).
- **Sin sesión**, todo sigue como antes: solo en el dispositivo.
- El **modo editor** sigue siendo del dispositivo y no se sube.

## Consecuencias
- El desbloqueo sigue siendo un juego, no una medida de seguridad: quien edite su perfil puede desbloquear todo, y no importa. La base solo valida la forma (nombres cortos en minúsculas, máximo 50).
- No es un dato personal: no cambia la Política de Tratamiento de Datos.
- Si la base aún no tiene las columnas, la app falla en silencio y guarda solo en el dispositivo.
- Si se cambia la mascota en dos dispositivos a la vez, gana el último que se abra con sesión.
