# CLAUDE.md

Contexto del proyecto para Claude Code. Lo comparten Santi y Gabi, los dos desarrolladores.

## Proyecto

**Veterinaria Ruth**: sistema de gestión para una clínica veterinaria real. Cubre clientes, mascotas, historia clínica, tratamientos, estudios (archivos), turnos con calendario, agenda diaria y un panel principal.

- Requerimientos completos: [docs/requerimientos.md](docs/requerimientos.md). Es la fuente de verdad del alcance y se carga completa al final de este archivo.
- Hoja de ruta por etapas: [README.md](README.md). Marcar las etapas a medida que se completan.
- Flujo de ramas y Pull Requests: [CONTRIBUTING.md](CONTRIBUTING.md).

## Idioma

- La app, la interfaz, los mensajes de commit, los PR y la documentación van en **español (Argentina)**.
- Los nombres de código (variables, funciones, tablas, columnas) van en **inglés**, en `snake_case` para la base de datos y en `camelCase` para TypeScript. Los textos visibles para el usuario van en español.

## Stack

- **Expo + React Native + TypeScript** con **Expo Router**. Una sola base de código para Android, iOS y web. La web se usa en la PC del mostrador, así que todas las pantallas tienen que funcionar bien en pantalla grande y en celular.
- **Supabase**: Postgres, Auth (email + contraseña), Storage (estudios en PDF, Excel e imágenes) y RLS para los permisos.
- Antes de usar una API de Expo, React Native o Supabase, consultar la documentación actual con Context7.

## Reglas de dominio (no negociables)

1. **Nunca se borra nada físicamente.** Todas las bajas son lógicas: se usa un campo de estado o `active`, nunca `DELETE`. No hay que exponer borrado físico ni en la app ni en las políticas RLS.
2. **El historial clínico es intocable.** Desactivar una mascota, marcarla fallecida o cambiarle el dueño no modifica ni oculta sus consultas, tratamientos ni estudios.
3. **Mascota sin dueño es válida.** `client_id` es nullable: hay animales rescatados, en adopción o de la propia veterinaria.
4. **Una mascota tiene a lo sumo un dueño a la vez.** Un cliente puede tener muchas mascotas. Cuando se cambia el dueño, el historial queda igual.
5. **Estados de mascota:** activa, inactiva y fallecida.
6. **Estados de turno:** pendiente, atendido y cancelado. Un turno cancelado se conserva.
7. **Historia clínica cronológica:** fecha y motivo son obligatorios; el resto de los campos son opcionales.
8. **Tratamientos y estudios** se asocian a la mascota y, cuando corresponde, a una consulta puntual.
9. **Agenda y tareas** son independientes de los turnos médicos.
10. **Roles:** `admin` y `veterinario`. Los permisos se aplican con RLS en Supabase, no solo en la interfaz.

Fuera de alcance por ahora: inventario y stock. Más adelante: avisos por WhatsApp para los recordatorios.

## Seguridad

- **El repositorio es público.** Nunca commitear claves, tokens, `.env` ni datos reales de clientes.
- En la app solo va la `anon key` de Supabase, por variables `EXPO_PUBLIC_*` definidas en `.env` (que está ignorado). La `service_role key` nunca va en el código de la app.
- Toda tabla nueva lleva RLS activado y sus políticas en la misma migración.
- Los archivos de estudios van en un bucket privado de Storage, nunca público.

## Forma de trabajo

- Ramas: `main` (estable) ← `develop` (integración) ← `feature/*` y `fix/*`. Las dos primeras están protegidas: todo entra por PR hacia `develop` con una aprobación.
- Una rama por funcionalidad. Commits chicos, con mensajes claros en español.
- Los cambios de base de datos van como migraciones versionadas en `supabase/migrations/`, nunca a mano en el panel.
- La UI tiene que ser clara, profesional y rápida para las tareas de todos los días. Siempre que se pueda, ir de la lista al detalle en pocos toques.

## Comandos

Todavía no hay proyecto Expo: se crea en la etapa 1 (`feature/setup`). Cuando exista, completar esta sección con los comandos para iniciar, testear, lintear y migrar.

## Requerimientos completos

@docs/requerimientos.md
