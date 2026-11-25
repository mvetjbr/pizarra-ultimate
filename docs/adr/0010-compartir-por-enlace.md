# ADR 0010 · Compartir por enlace con permisos validados en la base de datos

- **Estado:** aceptada
- **Fecha:** 2026-11-24

## Contexto
El documento MULTIUSUARIO_Y_COMPARTIR.md pide varias cosas:
- compartir jugadas y libros por enlace, con permiso "ver" o "editar";
- poder quitar el acceso;
- guardar copias con crédito al autor;
- que no exista un directorio de usuarios;
- que las reglas se cumplan en el servidor y no solo ocultando botones.

## Decisión
- **Tablas:** `share_links` guarda los enlaces y `shares` guarda quién recibió acceso.
- **Tokens:** cada enlace lleva un token de 244 bits aleatorios. Se le puede poner vencimiento (1, 7 o 30 días) y se puede desactivar.
- **Permisos:** la función `nivel_acceso(tipo, id)` decide si alguien es dueño, puede editar, puede ver o no tiene acceso. Toda la RLS de jugadas y libros se apoya en ella. Compartir un libro da acceso a todas sus jugadas, también a las que se agreguen después.
- **Quien no es dueño** solo puede cambiar el contenido; dueño, borrado y crédito los protege un trigger. Compartir, cambiar permisos, revocar y borrar solo lo puede hacer el dueño (funciones RPC).
- **Datos visibles:** a otras personas solo se les muestra `nombre_publico` (apodo, o nombre si no hay apodo), nunca el correo ni la fecha de nacimiento. La función no se puede llamar directamente.
- **Límites:** máximo 30 enlaces creados y 30 intentos de abrir enlaces por minuto por persona. Un enlace inválido no da error: devuelve vacío, para que el intento quede contado.
- **Copias:** pertenecen a quien las hace y guardan `source_author_name`. Si el autor elimina su cuenta, el crédito pasa a "Autor que eliminó su cuenta".
- **Edición simultánea:** gana la última versión guardada y la app avisa: "Esta jugada fue modificada por [apodo] mientras la editabas".
- **Reportes:** cualquiera con acceso puede reportar contenido. La administración lo revisa en `#/admin` y puede retirarlo.
- **Pruebas:** `npm run prueba:sql` corre 49 pruebas con dueña, editora, lectora y una cuenta sin acceso, llamando la base de datos directamente.

## Consecuencias
- La seguridad no depende de la app: aunque alguien llame la API a mano, la base de datos aplica las reglas.
- Una jugada compartida con permiso "ver" se puede mover en pantalla, pero los cambios no se guardan. Para modificarla hay que guardar una copia.
