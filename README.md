# Veterinaria Ruth

Sistema integral de gestión para una clínica veterinaria: clientes, mascotas, historias clínicas, turnos, agenda, tratamientos y estudios.

Requerimientos completos: [docs/requerimientos.md](docs/requerimientos.md)

## Stack

- **App:** Expo + React Native (Android, iOS y web con una sola base de código)
- **Backend:** Supabase (Postgres, autenticación, permisos por rol con RLS, almacenamiento de archivos)
- **Login:** email + contraseña. Roles: administrador y veterinario.

## Cómo arrancar

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Crear el proyecto en [supabase.com](https://supabase.com) (región São Paulo).
3. Cargar la base de datos: en Supabase → **SQL Editor**, pegar y ejecutar
   [supabase/migrations/20261126180000_esquema_inicial.sql](supabase/migrations/20261126180000_esquema_inicial.sql).
4. Copiar `.env.example` como `.env` y completar la URL y la clave **anon/publishable**
   (Supabase → Project Settings → API). El `.env` nunca se sube.
5. Levantar la app:
   ```bash
   npx expo start        # QR para Expo Go en el celu
   npx expo start --web  # en el navegador
   ```
6. **El primer usuario que se registra queda como administrador.** Los siguientes quedan
   pendientes hasta que el admin los active en *Mi perfil → Usuarios del sistema*.

Chequeos antes de un PR:

```bash
npx tsc --noEmit
npx expo lint
```

## Estructura

```
src/app/            pantallas (Expo Router: cada archivo es una ruta)
  login.tsx           ingreso / registro
  (app)/              todo lo que requiere sesión
    index.tsx           panel principal
    clientes/           lista, ficha y formulario
    mascotas/           lista, perfil (historia clínica, tratamientos, estudios, turnos, dueños) y formulario
    consultas/form.tsx  nueva consulta / edición
    tratamientos/       formulario de tratamientos
    turnos/             calendario (día, semana, mes) y formulario
    agenda/             tareas, recordatorios, actividades y notas del día
    perfil.tsx          mis datos + administración de usuarios (admin)
src/components/     UI reutilizable (botones, tarjetas, buscadores)
src/lib/            Supabase, sesión, tipos, fechas, colores
supabase/migrations/  esquema de la base de datos (tablas, RLS, triggers, storage)
```

## Hoja de ruta

- [x] Etapa 1: proyecto base, base de datos y login con roles
- [x] Etapa 2: clientes y mascotas
- [x] Etapa 3: historia clínica, tratamientos y estudios
- [x] Etapa 4: turnos y calendario (vista diaria, semanal y mensual)
- [x] Etapa 5: agenda y tareas
- [x] Etapa 6: panel principal y búsquedas
- [ ] Probar todo con el proyecto real de Supabase y ajustar
- [ ] Publicar la versión web (Firebase Hosting / Vercel)
- [ ] Futuro: avisos por WhatsApp, vacunas con vencimiento, inventario y stock

## Cómo trabajamos

Ver [CONTRIBUTING.md](CONTRIBUTING.md).
