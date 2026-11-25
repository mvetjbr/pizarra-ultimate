# ADR 0003 · Consentimientos que solo se insertan, encadenados con SHA-256

- **Estado:** aceptada
- **Fecha:** 2026-11-11

## Contexto
La Ley 1581 de 2012 y el Decreto 1074 de 2015 obligan a conservar prueba de la autorización para tratar datos, y la Ley 527 de 1999 da validez a la aceptación electrónica. En el esquema del celular, cada persona podía editar o borrar sus propios consentimientos, así que esos registros no servían como prueba.

## Decisión
- La tabla `consent_records` es de **solo inserción**. Unos triggers bloquean `UPDATE`, `DELETE` y `TRUNCATE`, incluso para el rol de servicio.
- Cada registro guarda un `evidence_hash`: el SHA-256 de su contenido más el hash del registro anterior de la misma persona. Así se forma una cadena, y un bloqueo por usuario (advisory lock) evita que dos inserciones simultáneas la rompan.
- La función `verificar_cadena(usuario)` recalcula la cadena y dice si está íntegra.
- Solo las funciones del servidor insertan consentimientos (ver ADR 0005). Quien tiene sesión puede leer los suyos, pero no insertarlos.
- Al eliminar una cuenta, `seudonimizar_consentimientos` reemplaza el nombre y el correo del representante por `seud:<hash>` y no borra nada. La cadena sigue íntegra porque el cálculo usa la huella del dato y no el dato.

## Consecuencias
- Queda una prueba fuerte ante la SIC de quién aceptó qué versión, cuándo y desde qué IP.
- Un registro equivocado no se corrige editándolo: se agrega otro, por ejemplo uno de revocación.
- Cambiar la estructura de la tabla más adelante exige mantener el mismo cálculo de evidencia.
