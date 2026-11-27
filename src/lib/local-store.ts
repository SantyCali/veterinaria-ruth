import { File, Paths } from 'expo-file-system';

// Almacenamiento local en el celular: un archivo por clave en la carpeta privada de la app
// (sin el límite de tamaño de AsyncStorage). En web se usa local-store.web.ts (IndexedDB).

const fileFor = (key: string) => new File(Paths.document, `offline-${key.replace(/[^\w-]/g, '_')}.json`);

export const localStore = {
  async get(key: string): Promise<string | null> {
    try {
      const f = fileFor(key);
      return f.exists ? await f.text() : null;
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    const f = fileFor(key);
    if (!f.exists) f.create();
    f.write(value);
  },
  async remove(key: string): Promise<void> {
    const f = fileFor(key);
    if (f.exists) f.delete();
  },
};
