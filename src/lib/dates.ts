// Ayudas para fechas. En los formularios se escribe DD/MM/AAAA y HH:MM
// (funciona igual en web, Android e iOS, sin depender de selectores nativos).

const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const pad = (n: number) => String(n).padStart(2, '0');

export const dayNameShort = (d: Date) => DAYS_SHORT[d.getDay()];
export const monthName = (d: Date) => MONTHS[d.getMonth()];

/** 24/10/2026 */
export function fmtDate(value: string | Date | null | undefined) {
  if (!value) return '';
  const d = typeof value === 'string' ? parseDbDate(value) : value;
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** 10:30 */
export function fmtTime(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 24/10/2026 10:30 */
export function fmtDateTime(value: string | Date) {
  return `${fmtDate(new Date(value))} ${fmtTime(value)}`;
}

/** "lunes 24 de octubre" */
export function fmtLongDate(d: Date) {
  return `${DAYS[d.getDay()]} ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
}

/** Interpreta "2026-10-24" como fecha local (sin correrse por zona horaria). */
export function parseDbDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

/** Date -> "2026-10-24" (para columnas tipo date). */
export function toDbDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "24/10/2026" -> "2026-10-24" o null si es inválida. */
export function inputToDbDate(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m.map(Number) as unknown as [number, number, number, number];
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return toDbDate(d);
}

/**
 * Arma "DD/MM/AAAA" con lo que se va escribiendo: deja solo los números y pone las
 * barras. Al escribir, la barra aparece apenas se completa el día o el mes; al
 * borrar no se vuelve a poner, así se puede borrar de corrido.
 */
export function maskDateInput(next: string, prev: string) {
  return maskDigits(next, prev, [2, 4], '/', 8);
}

/** Igual que maskDateInput, para "HH:MM". */
export function maskTimeInput(next: string, prev: string) {
  return maskDigits(next, prev, [2], ':', 4);
}

function maskDigits(next: string, prev: string, cuts: number[], sep: string, max: number) {
  const digits = next.replace(/\D/g, '').slice(0, max);
  let out = '';
  let from = 0;
  for (const cut of cuts) {
    if (digits.length <= cut) break;
    out += digits.slice(from, cut) + sep;
    from = cut;
  }
  out += digits.slice(from);
  const deleting = next.length < prev.length;
  if (!deleting && cuts.includes(digits.length)) out += sep;
  return out;
}

/** "24/10/2026" + "10:30" -> Date o null. */
export function inputToDateTime(dateText: string, timeText: string): Date | null {
  const day = inputToDbDate(dateText);
  const t = timeText.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!day || !t) return null;
  const h = Number(t[1]);
  const min = Number(t[2]);
  if (h > 23 || min > 59) return null;
  const d = parseDbDate(day);
  d.setHours(h, min, 0, 0);
  return d;
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Lunes de la semana de d. */
export function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const diff = (x.getDay() + 6) % 7;
  return addDays(x, -diff);
}

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/** "3 a, 4 m" a partir de la fecha de nacimiento. */
export function fmtAge(birth: string | null) {
  if (!birth) return '';
  const b = parseDbDate(birth);
  const now = new Date();
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) return '';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) return `${rest} ${rest === 1 ? 'mes' : 'meses'}`;
  return rest ? `${years} a, ${rest} m` : `${years} ${years === 1 ? 'año' : 'años'}`;
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Buen día';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}
