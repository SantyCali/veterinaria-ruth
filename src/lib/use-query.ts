import { useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { getMirror, isNetworkError, isOnline, loadMirror, type Mirror } from './offline';

// ---------------------------------------------------------------- Caché
// Guarda la última respuesta de cada consulta (por clave) mientras la app está abierta.
// Al volver a una pantalla ya visitada, se muestra al instante con esos datos y
// se actualiza por detrás ("stale-while-revalidate"). Se vacía al cerrar sesión.

const MAX_ENTRIES = 60;
const cache = new Map<string, unknown>();

function cacheSet(key: string, value: unknown) {
  cache.delete(key); // re-insertar la deja como la más reciente
  cache.set(key, value);
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
}

/** Vacía la caché (al cerrar sesión, para que otro usuario no vea datos viejos). */
export function clearQueryCache() {
  cache.clear();
}

// ---------------------------------------------------------------- Hook

/**
 * Carga datos al entrar a la pantalla (y cada vez que se vuelve a ella).
 * - `fn` debe devolver { data, error } como las consultas de Supabase.
 * - `deps`: valores que, si cambian, vuelven a disparar la carga (ej: el texto de búsqueda).
 * - `cacheKey` (opcional): nombre de la consulta. Si se pasa, los datos se guardan en
 *   caché y la pantalla aparece al instante cuando se vuelve a ella.
 * - `offline` (opcional): cómo armar los mismos datos desde la copia local
 *   (ver offline-queries.ts). Se usa cuando no hay internet.
 */
export function useQuery<T>(
  fn: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  deps: unknown[],
  cacheKey?: string,
  offline?: (m: Mirror) => T | null,
) {
  const depsKey = JSON.stringify(deps);
  const fullKey = cacheKey ? `${cacheKey}:${depsKey}` : null;

  const [data, setData] = useState<T | null>(() =>
    fullKey && cache.has(fullKey) ? (cache.get(fullKey) as T) : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !(fullKey && cache.has(fullKey)));

  // Siempre usar la versión más nueva de fn y de la clave sin listarlas como dependencia.
  const fnRef = useRef(fn);
  const keyRef = useRef(fullKey);
  const offlineRef = useRef(offline);
  useLayoutEffect(() => {
    fnRef.current = fn;
    keyRef.current = fullKey;
    offlineRef.current = offline;
  });

  const reload = useCallback(async () => {
    const key = keyRef.current;
    // Si hay datos en caché para esta clave, mostrarlos ya mientras se actualiza.
    if (key && cache.has(key)) setData(cache.get(key) as T);
    setLoading(true);

    // Sin internet: leer de la copia local en vez de esperar a que falle la red.
    const fromBackup = async () => {
      const build = offlineRef.current;
      const mirror = getMirror() ?? (await loadMirror());
      if (!build || !mirror) return false;
      if (key !== keyRef.current) return true;
      setData(build(mirror));
      setError(null);
      setLoading(false);
      return true;
    };
    if (!isOnline() && (await fromBackup())) return;

    const res = await fnRef.current();
    // Si mientras tanto cambió la clave (ej: se siguió escribiendo), descartar esta respuesta.
    if (key !== keyRef.current) return;
    if (res.error && isNetworkError(res.error.message) && (await fromBackup())) return;
    if (res.error) setError(res.error.message);
    else {
      setError(null);
      setData(res.data);
      if (key) cacheSet(key, res.data);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
      // depsKey es a propósito: recarga cuando cambian los filtros.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reload, depsKey]),
  );

  return { data, error, loading, reload };
}
