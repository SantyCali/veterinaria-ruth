// Notificaciones (toasts) y confirmaciones propias de la app.
// Funcionan igual en web, Android e iOS (no usan window.alert ni Alert.alert).
// Se dibujan en <DialogHost />, montado una sola vez en src/app/_layout.tsx.
//
// Uso:
//   toast.success('Cliente guardado');
//   toast.error('No se pudo guardar', error.message);
//   const ok = await confirm('Desactivar cliente', 'El cliente queda inactivo…', { okText: 'Desactivar', danger: true });

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type Toast = {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
  duration: number;
};

export type ConfirmRequest = {
  title: string;
  message: string;
  okText: string;
  cancelText: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
};

type State = { toasts: Toast[]; confirm: ConfirmRequest | null };

let state: State = { toasts: [], confirm: null };
const listeners = new Set<() => void>();
let nextId = 1;

function setState(next: State) {
  state = next;
  listeners.forEach((l) => l());
}

export const dialogStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => state,
};

const DURATION: Record<ToastType, number> = { success: 3500, info: 4000, warning: 5000, error: 6000 };
const MAX_TOASTS = 4;

function show(type: ToastType, title: string, message?: string) {
  const t: Toast = { id: nextId++, type, title, message, duration: DURATION[type] };
  setState({ ...state, toasts: [...state.toasts, t].slice(-MAX_TOASTS) });
  return t.id;
}

export function dismissToast(id: number) {
  setState({ ...state, toasts: state.toasts.filter((t) => t.id !== id) });
}

/** Los errores de red de Supabase llegan en inglés y técnicos: se traducen. */
function friendly(message?: string) {
  if (message && /failed to fetch|network request failed|networkerror|load failed|fetch failed/i.test(message)) {
    return 'Sin conexión a internet. Probá de nuevo cuando vuelva.';
  }
  return message;
}

export const toast = {
  success: (title: string, message?: string) => show('success', title, message),
  error: (title: string, message?: string) => show('error', title, friendly(message)),
  warning: (title: string, message?: string) => show('warning', title, message),
  info: (title: string, message?: string) => show('info', title, message),
};

/** Ventana de confirmación. Devuelve true si se tocó el botón de aceptar. */
export function confirm(
  title: string,
  message: string,
  opts: { okText?: string; cancelText?: string; danger?: boolean } = {},
): Promise<boolean> {
  // Si había otra confirmación abierta, se da por cancelada.
  state.confirm?.resolve(false);
  return new Promise((resolve) => {
    setState({
      ...state,
      confirm: {
        title,
        message,
        okText: opts.okText ?? 'Aceptar',
        cancelText: opts.cancelText ?? 'Cancelar',
        danger: opts.danger ?? false,
        resolve: (ok) => {
          setState({ ...state, confirm: null });
          resolve(ok);
        },
      },
    });
  });
}
