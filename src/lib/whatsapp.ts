import { Linking, Platform } from 'react-native';

import { fmtDate, fmtTime } from './dates';

// Recordatorios por WhatsApp con "click to chat" (wa.me): abre WhatsApp con el
// mensaje ya escrito y se envía con un toque. No necesita cuentas ni API.

/**
 * Pasa un teléfono argentino al formato internacional que pide wa.me (solo números).
 * "11 4829-1923" -> "5491148291923". Si ya viene con 54, se respeta.
 */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('54')) return digits;
  if (digits.startsWith('0')) digits = digits.slice(1);
  // Celulares de Argentina: 54 + 9 + código de área + número.
  return digits.length >= 10 ? `549${digits}` : digits;
}

/** Abre WhatsApp con el mensaje. Sin teléfono, WhatsApp deja elegir el contacto. */
export async function openWhatsApp(phone: string | null | undefined, text: string) {
  const number = toWhatsAppNumber(phone);
  const url = `https://wa.me/${number ?? ''}?text=${encodeURIComponent(text)}`;
  if (Platform.OS === 'web') window.open(url, '_blank', 'noopener');
  else await Linking.openURL(url);
}

const CLINIC = 'Veterinaria Ruth';

export const whatsappTemplates = {
  appointment: (o: { owner?: string | null; pet: string; startsAt: string; reason: string }) =>
    `¡Hola${o.owner ? ` ${o.owner}` : ''}! Te recordamos el turno de ${o.pet} en ${CLINIC} ` +
    `el ${fmtDate(new Date(o.startsAt))} a las ${fmtTime(o.startsAt)} hs. Motivo: ${o.reason}. ¡Te esperamos! 🐾`,

  vaccine: (o: { owner?: string | null; pet: string; vaccine: string; due: string }) =>
    `¡Hola${o.owner ? ` ${o.owner}` : ''}! Te recordamos que a ${o.pet} le corresponde la vacuna ` +
    `${o.vaccine} el ${fmtDate(o.due)}. Podés pedir turno respondiendo este mensaje. ${CLINIC} 🐾`,

  reminder: (o: { title: string; dueAt?: string | null; detail?: string | null }) =>
    `⏰ Recordatorio (${CLINIC}): ${o.title}` +
    (o.dueAt ? ` — ${fmtDate(new Date(o.dueAt))} ${fmtTime(o.dueAt)} hs` : '') +
    (o.detail ? `\n${o.detail}` : ''),
};
