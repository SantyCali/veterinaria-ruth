# Cómo trabajamos

## Ramas

| Rama | Para qué |
|---|---|
| `main` | Versión estable. Solo recibe cambios desde `develop` cuando algo está probado. |
| `develop` | Donde se integran las features terminadas. |
| `feature/<nombre>` | Una rama por cada funcionalidad nueva (ej: `feature/login`, `feature/clientes`). |
| `fix/<nombre>` | Arreglo de un error (ej: `fix/hora-turno`). |

Nadie sube cambios directo a `main` ni a `develop`: todo entra por Pull Request.

## Flujo para una feature nueva

```bash
# 1. Traer lo último de develop
git checkout develop
git pull

# 2. Crear tu rama
git checkout -b feature/clientes

# 3. Trabajar y guardar cambios
git add .
git commit -m "Agrega alta de clientes"

# 4. Subir la rama
git push -u origin feature/clientes
```

5. En GitHub, abrir un **Pull Request** de `feature/clientes` hacia `develop`.
6. El otro lo revisa y, si está bien, lo aprueba y se hace merge.
7. Borrar la rama una vez mergeada.

## Antes de empezar cada día

```bash
git checkout develop
git pull
```

Si estás en medio de una feature, traé lo nuevo a tu rama:

```bash
git checkout feature/tu-rama
git merge develop
```

## Reglas

- Commits chicos y con mensajes claros en español.
- Nunca subir claves ni archivos `.env` (el repo es público).
- Avisarse quién está trabajando en qué, para no tocar los mismos archivos a la vez.
