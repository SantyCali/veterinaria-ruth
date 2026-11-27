# CLAUDE.md

Contexto del proyecto para Claude Code. Lo comparten Santi y Gabi, los dos desarrolladores.

@AGENTS.md

## Proyecto

**Veterinaria Ruth**: sistema de gestión para una clínica veterinaria real. Cubre clientes, mascotas, historia clínica, tratamientos, estudios (archivos), turnos con calendario, agenda diaria y un panel principal.

- Requerimientos completos: [docs/requerimientos.md](docs/requerimientos.md). Es la fuente de verdad del alcance y se carga completa al final de este archivo.
- Hoja de ruta por etapas y cómo arrancar: [README.md](README.md).
- Flujo de ramas y Pull Requests: [CONTRIBUTING.md](CONTRIBUTING.md).
- Diseño de referencia: proyecto de Google Stitch "Veterinaria Ruth Web App", con pantallas de escritorio de panel, turnos y perfil de mascota. De ahí salen los colores y la tipografía de `src/lib/theme.ts`.

## Estado actual (26/11/2026)

- **Primera versión completa (etapas 1 a 6)** en la rama `feature/setup`, PR #2 hacia `develop`. Incluye login, panel, clientes, mascotas, consultas, tratamientos, estudios, turnos (día, semana y mes), agenda y perfil con gestión de usuarios.
- Verificado: `tsc` y `expo lint` sin errores, la versión web compila completa, y el login se probó en el navegador (PC y celular).
- **Base de datos ya creada en Supabase.** La migración inicial se ejecutó a mano desde el SQL Editor el 26/11/2026; quedaron 10 tablas con RLS, 27 políticas y el bucket privado `pet-files`.
- Santi ya está registrado como **admin** (fue el primer usuario).
- **Falta:** probar con datos reales todas las pantallas que leen o escriben en la base (todavía nadie cargó clientes, mascotas ni turnos), y publicar la versión web.

## Supabase

- El proyecto `Veterinaria-Rut` está en la **organización de Gabi**, plan Free, región West US (Oregon). Santi es miembro de esa organización.
- URL: `https://yyuyvkshqqacedvrsvcr.supabase.co`. La clave pública va en el `.env` local (ver `.env.example`) y nunca se commitea.
- **"Confirm email" está desactivado** (Authentication → Sign In / Providers). No hace falta, porque los usuarios nuevos quedan inactivos hasta que un admin los aprueba.
- El plan Free permite **2 proyectos activos por persona**, contando todas las organizaciones donde sea Owner o Admin. A los colaboradores conviene invitarlos con el rol **Developer**.
- Todavía **no se usa la CLI de Supabase** (no hay `supabase link`). Las migraciones nuevas se agregan como archivo en `supabase/migrations/` y se ejecutan en el SQL Editor. Hay que anotar en el PR que se aplicaron.

## Idioma

- La app, la interfaz, los mensajes de commit, los PR y la documentación van en **español (Argentina)**.
- Los nombres de código (variables, funciones, tablas, columnas) van en **inglés**, en `snake_case` para la base de datos y en `camelCase` para TypeScript. Los textos visibles para el usuario van en español.

## Stack

- **Expo SDK 58 + React Native + TypeScript**, con **Expo Router** (rutas en `src/app/`). Una sola base de código para Android, iOS y web. La web se usa en la PC del mostrador, así que todas las pantallas tienen que funcionar bien en pantalla grande y en celular.
- **Supabase**: Postgres, Auth (email + contraseña), Storage (estudios en PDF, Excel e imágenes) y RLS para los permisos. Se usa directamente con `@supabase/supabase-js`, sin servidor propio.
- La web se exporta como SPA (`web.output: "single"` en `app.json`), así que se puede alojar en cualquier hosting estático (Firebase Hosting, Vercel).
- Antes de usar una API de Expo, React Native o Supabase, consultar la documentación actual con Context7. Expo cambia mucho entre versiones (ver AGENTS.md).

## Estructura del código

```
src/app/_layout.tsx        fuentes, AuthProvider y rutas protegidas (Stack.Protected)
src/app/login.tsx          ingreso / registro / olvidé mi contraseña
src/app/pendiente.tsx      usuario registrado pero todavía no aprobado
src/app/(app)/_layout.tsx  menú lateral (ancho >= 900px) o barra inferior (celu)
src/app/(app)/...          pantallas: index (panel), clientes, mascotas, consultas,
                           tratamientos, turnos, agenda, perfil
src/components/ui.tsx      kit de UI propio (Screen, Card, Button, Field, Input,
                           Segmented, Chip, ListItem, StatCard...)
src/components/pickers.tsx buscadores para elegir cliente y mascota
src/components/rows.tsx    AppointmentRow + APPOINTMENT_SELECT
src/components/motion.tsx  FadeIn y staggerDelay (animaciones de entrada)
src/components/dialog-host.tsx  toasts y ventana de confirmación
src/lib/supabase.ts        cliente de Supabase y cleanSearch() para filtros .or()
src/lib/auth.tsx           sesión + perfil (useAuth)
src/lib/use-query.ts       carga datos al enfocar la pantalla (useQuery)
src/lib/types.ts           tipos de las tablas (escritos a mano)
src/lib/labels.ts          textos y colores de los enums (estados, especies...)
src/lib/dates.ts           fechas en formato DD/MM/AAAA y HH:MM
src/lib/dialogs.ts         toast.* y confirm() (se dibujan en components/dialog-host.tsx)
src/lib/files.ts           subir y abrir estudios del bucket privado
supabase/migrations/       esquema de la base de datos
```

## Convenciones del código

- **Fechas en formularios:** se escriben como texto `DD/MM/AAAA` y `HH:MM`, con `inputToDbDate` e `inputToDateTime` de `src/lib/dates.ts`. No se usan selectores nativos, para que funcione igual en web y en el celu.
- **Avisos y confirmaciones:** usar `toast.success / error / warning / info(título, detalle?)` y `await confirm(título, mensaje, { okText, danger })` de `src/lib/dialogs.ts`. Se dibujan en `<DialogHost />` (`src/components/dialog-host.tsx`), que está montado en el layout raíz. **Nunca** usar `window.alert`, `window.confirm` ni `Alert.alert`. Toda acción que guarda o cambia algo avisa con un toast de éxito o de error.
- **Animaciones de entrada:** `Screen` hace entrar el encabezado y cada bloque hijo en cascada (fundido + leve subida), y lo repite cada vez que la pantalla vuelve a estar en foco.
  - **Siempre pasar `loading` a `Screen`** en vez de poner un `<Loading />` entre los hijos. En listas y pantallas con `useQuery` va `loading={loading && !data}`; en formularios, `loading={loading}`. Así la cascada arranca cuando ya están los datos, y no se anima vacío ni salta al cargar.
  - Para ítems de una lista o grilla, usar `<StaggerItem index={i}>` de `src/components/motion.tsx`. Hace fundido + zoom (`pop`), sin desplazamiento, para no sumarse al movimiento del bloque, y **solo anima los primeros 12** (`MAX_ANIMATED_ITEMS`). Si el ítem usaba `flex`/`flexBasis`, ese estilo pasa al `StaggerItem`.
  - Usa Reanimated con `.get()`/`.set()`, compatible con el React Compiler, y respeta "reducir movimiento".
- **Fluidez (120/144 Hz):** toda animación nueva va con **Reanimated** (hilo de UI), no con el `Animated` de React Native. Además, **solo se animan `opacity` y `transform`**: nunca `width`, `height`, `top`, `margin` ni otras propiedades de diseño, porque obligan a recalcular la página en cada cuadro. Para barras de progreso se usa `scaleX` con `transformOrigin: 'left'`. Las duraciones son en milisegundos, así que valen igual a 60, 120 o 144 Hz. En iOS, `CADisableMinimumFrameDurationOnPhone` (en `app.json`) habilita 120 Hz en ProMotion. La fluidez real se mide en un build de producción, no en modo desarrollo.
- **Carga de datos:** `useQuery(fn, deps, cacheKey)` recarga al volver a la pantalla y cuando cambian los `deps`. Con `cacheKey` (un nombre único por pantalla, ej. `'clientes'`), la última respuesta queda en caché: al volver a una pantalla ya visitada aparece al instante y se actualiza por detrás. La caché se vacía al cerrar sesión.
- **Navegación entre secciones:** desde el menú o desde atajos a otra sección (ej. "Ver calendario"), usar `router.dismissTo('/seccion')`, no `router.navigate`. En esta versión de Expo Router, `navigate` apila una pantalla nueva cada vez y la memoria crece con el uso. Para ir a un detalle o a un formulario sí se usa `router.push`.
- **Relaciones ambiguas:** cuando una tabla tiene varias FK a `profiles`, indicar la relación por su nombre, por ejemplo `vet:profiles!appointments_vet_id_fkey(...)` o `profiles!consultations_vet_id_fkey`.
- **Búsquedas con `.or()`:** pasar siempre el texto del usuario por `cleanSearch()`.
- **Formularios:** un solo archivo `form.tsx` por entidad, que sirve para crear y para editar (con `?id=`).
- El React Compiler está activo y el linter es estricto. Nada de `setState` sincrónico dentro de efectos, ni leer refs o llamar a `Date.now()` durante el render.

## Reglas de dominio (no negociables)

1. **Nunca se borra nada físicamente.** Todas las bajas son lógicas: se usa un campo de estado o `active`, nunca `DELETE`. En la base no hay políticas de DELETE y además se le quitó ese permiso a `anon` y `authenticated`.
2. **El historial clínico es intocable.** Desactivar una mascota, marcarla fallecida o cambiarle el dueño no modifica ni oculta sus consultas, tratamientos ni estudios.
3. **Mascota sin dueño es válida.** `client_id` es nullable: hay animales rescatados, en adopción o de la propia veterinaria.
4. **Una mascota tiene a lo sumo un dueño a la vez.** Un cliente puede tener muchas mascotas. Cuando cambia el dueño, el trigger `track_pet_owner` lo registra en `pet_owner_history`.
5. **Estados de mascota:** activa, inactiva y fallecida (con `deceased_at`).
6. **Estados de turno:** pendiente, atendido y cancelado. Un turno cancelado se conserva. El turno guarda su propio `client_id`, así queda registrado quién trajo la mascota ese día.
7. **Historia clínica cronológica:** fecha y motivo son obligatorios; el resto de los campos son opcionales. Cuando una consulta sale de un turno, ese turno pasa a "atendido".
8. **Tratamientos y estudios** se asocian a la mascota y, cuando corresponde, a una consulta puntual.
9. **Agenda y tareas** son independientes de los turnos médicos.
10. **Roles:** `admin` y `veterinario`. El **primer usuario** que se registra queda como admin y activo. **Los siguientes quedan inactivos** hasta que un admin los aprueba en *Mi perfil*. Los permisos se aplican con RLS (`is_active_staff()`, `is_admin()`), no solo en la interfaz.

Agregado respecto del documento de requerimientos, tomado del diseño de Stitch: microchip y alergias en la mascota, y peso en cada consulta.

Fuera de alcance por ahora: inventario y stock. Más adelante: avisos por WhatsApp, vacunas con vencimiento y facturación.

## Seguridad

- **El repositorio es público.** Nunca commitear claves, tokens, `.env` ni datos reales de clientes.
- En la app solo va la clave **publishable/anon** de Supabase, por variables `EXPO_PUBLIC_*` definidas en `.env` (que está ignorado). La clave **secret/service_role** nunca va en el código de la app.
- Toda tabla nueva lleva RLS activado y sus políticas en la misma migración.
- Los archivos de estudios van en el bucket privado `pet-files`, nunca público. Se abren con links firmados que duran 5 minutos.

## Forma de trabajo

- Ramas: `main` (estable) ← `develop` (integración) ← `feature/*`, `fix/*` y `docs/*`. Las dos primeras están protegidas: todo entra por PR hacia `develop` con una aprobación.
- Una rama por funcionalidad. Commits chicos, con mensajes claros en español.
- Los cambios de base de datos van como migraciones versionadas en `supabase/migrations/`, nunca a mano en el panel.
- La UI tiene que ser clara, profesional y rápida para las tareas de todos los días. Siempre que se pueda, ir de la lista al detalle en pocos toques.

## Comandos

```bash
npm install                 # dependencias
npx expo start              # servidor de desarrollo (QR para Expo Go)
npx expo start --web        # en el navegador (http://localhost:8081)
npx tsc --noEmit            # chequeo de tipos
npx expo lint               # linter
npx expo export -p web      # build web (carpeta dist/)
npx expo install <paquete>  # agregar dependencias (nunca npm install <paquete>)
```

Antes de abrir un PR: `npx tsc --noEmit` y `npx expo lint` tienen que pasar sin errores.

## Funciones transversales

- **Modo sin internet + backup automático** (`src/lib/offline.ts`): `useOfflineSync()` (montado en `(app)/_layout`) descarga toda la base cada 5 min, al abrir la app y al volver internet, y la guarda en el dispositivo (`local-store.ts`: archivo en el celu, IndexedDB en web). Sin conexión, `useQuery` usa su 4º parámetro `offline` (funciones en `src/lib/offline-queries.ts`) y aparece `OfflineBanner`. **Sin internet es solo lectura**: para cargar o editar hace falta conexión. La copia se borra al cerrar sesión. **Si agregás una tabla, sumala a `TABLES` en offline.ts; si agregás una pantalla con `useQuery`, escribí su versión offline.** El admin puede descargar la copia como JSON desde *Mi perfil*.
- **Buscador general** (`src/components/global-search.tsx`): mascotas por nombre, raza o chip, y clientes por nombre, email o teléfono. Se abre con Ctrl/Cmd+K, desde el menú lateral o con el botón flotante en el celu. También funciona sin internet.
- **WhatsApp** (`src/lib/whatsapp.ts`): botones "click to chat" (wa.me) con el mensaje armado. Se usan para recordar turnos y vacunas al dueño, para que el usuario se mande sus recordatorios y para contactar al cliente. `toWhatsAppNumber` pasa números argentinos a 549XXXXXXXXXX. No hay envío automático (eso necesitaría WhatsApp Business API).
- **Fechas:** `DateInput` permite escribir con números o elegir en un calendario (`src/components/date-picker.tsx`, sin librerías nativas). En turnos está el botón "Ir a fecha".
- **Fotos de mascota:** `pets.photo_path`, en el bucket `pet-files`. Se muestran con `PetAvatar` (links firmados de 1 hora, guardados en memoria). En listas, usar `prefetchPetPhotos()` para pedir todos los links juntos.
- **Vacunas:** tabla `vaccinations`, pestaña en el perfil de la mascota, formulario `vacunas/form` y tarjeta "Vacunas vencidas o por vencer" en el panel (`src/lib/vaccines.ts`). Solo la aplicación más reciente de cada vacuna define si está al día.
- **Tipos de la base:** `npm run gen:types` genera `src/lib/database.types.ts` (requiere `npx supabase login` una vez). Mientras tanto, los tipos de `src/lib/types.ts` están escritos a mano.

## Migraciones

| Archivo | Estado en Supabase |
|---|---|
| `20261126180000_esquema_inicial.sql` | Aplicada (26/11) |
| `20261127120000_especies_de_campo.sql` | Aplicada por Gabi (27/11) |
| `20261127200000_fotos_y_vacunas.sql` | Aplicada (27/11) |
| `20261127210000_notas_borrables.sql` | Aplicada (27/11): las notas del día se borran con baja lógica (`active`) |

## Próximos pasos

1. Generar los tipos (`npx supabase login` una vez y después `npm run gen:types`) y usarlos en `createClient<Database>`.
2. Cargar datos de prueba y recorrer todas las pantallas con la base real (incluido el modo sin internet).
3. Mergear los PR en `develop`.
4. Publicar la versión web (Firebase Hosting o Vercel) y configurar ahí la *Site URL* de Supabase Auth, para que funcione "Olvidé mi contraseña".
5. Más adelante: carga de datos sin internet (cola de cambios), WhatsApp automático, inventario y stock.

## Requerimientos completos

@docs/requerimientos.md
