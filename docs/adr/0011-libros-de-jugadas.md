# ADR 0011 · Libros de jugadas solo en la nube y siempre del mismo dueño

- **Estado:** aceptada
- **Fecha:** 2026-11-24

## Contexto
Un libro es una colección ordenada de jugadas (por ejemplo "Zona 3-3-1" o "Salidas de pull") que se comparte completa con el equipo.

## Decisión
- Los libros (`playbooks` y `playbook_plays`) viven solo en la nube y necesitan cuenta. Se cargan al abrirlos; no hay copia sin conexión.
- Un libro solo contiene jugadas de su mismo dueño, y lo verifica un trigger. Si quien tiene permiso de editar agrega una jugada suya, entra una **copia** a nombre del dueño del libro, con crédito para quien la aportó.
- Borrar un libro no borra sus jugadas.

## Consecuencias
- Los permisos de un libro y de sus jugadas no se contradicen: todo lo que hay en un libro es del mismo dueño.
- Sin conexión no se pueden abrir libros. Si llega a hacer falta, se puede agregar una copia local más adelante.
