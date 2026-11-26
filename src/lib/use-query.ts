import { useFocusEffect } from 'expo-router';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

/**
 * Carga datos al entrar a la pantalla (y cada vez que se vuelve a ella).
 * `fn` debe devolver { data, error } como las consultas de Supabase.
 * `deps`: valores que, si cambian, vuelven a disparar la carga (ej: el texto de búsqueda).
 */
export function useQuery<T>(
  fn: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  deps: unknown[],
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Siempre usar la versión más nueva de fn sin tener que listarla como dependencia.
  const fnRef = useRef(fn);
  useLayoutEffect(() => {
    fnRef.current = fn;
  });

  const reload = useCallback(async () => {
    setLoading(true);
    const res = await fnRef.current();
    if (res.error) setError(res.error.message);
    else {
      setError(null);
      setData(res.data);
    }
    setLoading(false);
  }, []);

  const depsKey = JSON.stringify(deps);

  useFocusEffect(
    useCallback(() => {
      reload();
      // depsKey es a propósito: recarga cuando cambian los filtros.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reload, depsKey]),
  );

  return { data, error, loading, reload };
}
