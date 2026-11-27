import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,

  type TextInputKeyPressEvent,
} from 'react-native';

import { PetAvatar } from './pet-avatar';
import { Avatar, Chip, Icon, initials, NO_FOCUS_RING, type IconName } from './ui';
import { petStatus, speciesLabel } from '@/lib/labels';
import { getMirror, isNetworkError, isOnline, loadMirror } from '@/lib/offline';
import { searchOffline } from '@/lib/offline-queries';
import { cleanSearch, supabase } from '@/lib/supabase';
import { colors, fonts, radius, space } from '@/lib/theme';
import type { Client, PetSpecies, PetWithClient } from '@/lib/types';

// ---------------------------------------------------------------- Estado (abrir/cerrar)

let isOpen = false;
const listeners = new Set<() => void>();
const searchStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get: () => isOpen,
};
function setOpen(v: boolean) {
  isOpen = v;
  listeners.forEach((l) => l());
}
export const openSearch = () => setOpen(true);
export const closeSearch = () => setOpen(false);

/** En web: Ctrl+K (o Cmd+K en Mac) abre el buscador desde cualquier pantalla. */
export function useSearchShortcut() {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

// ---------------------------------------------------------------- Búsqueda

type ClientHit = Pick<Client, 'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'active'> & {
  pets: { id: string; name: string }[];
};
type Results = { pets: PetWithClient[]; clients: ClientHit[] };

async function search(term: string): Promise<Results> {
  const t = cleanSearch(term);
  if (t.length < 2) return { pets: [], clients: [] };

  // Sin internet: buscar en la copia local.
  const offline = async () => {
    const m = getMirror() ?? (await loadMirror());
    return m ? searchOffline(m, t) : { pets: [], clients: [] };
  };
  if (!isOnline()) return offline();

  const [pets, clients] = await Promise.all([
    supabase
      .from('pets')
      .select('*, client:clients(id, first_name, last_name, phone)')
      .or(`name.ilike.%${t}%,breed.ilike.%${t}%,microchip.ilike.%${t}%`)
      .order('name')
      .limit(8),
    supabase
      .from('clients')
      .select('id, first_name, last_name, email, phone, active, pets(id, name)')
      .or(`first_name.ilike.%${t}%,last_name.ilike.%${t}%,email.ilike.%${t}%,phone.ilike.%${t}%`)
      .order('last_name')
      .limit(8),
  ]);
  if (isNetworkError(pets.error?.message) || isNetworkError(clients.error?.message)) return offline();
  return {
    pets: (pets.data as PetWithClient[] | null) ?? [],
    clients: (clients.data as ClientHit[] | null) ?? [],
  };
}

// ---------------------------------------------------------------- Entradas de la lista

/** Todo lo que se puede elegir en el buscador (resultado, acceso rápido o reciente). */
type Entry = {
  key: string;
  href: Href;
  title: string;
  subtitle: string;
  badge: string;
  pet?: { photo_path: string | null; species: PetSpecies };
  initials?: string;
  icon?: IconName;
  status?: { label: string; fg: string; bg: string };
};

const QUICK_ACTIONS: Entry[] = [
  { key: 'a-turno', href: '/turnos/form', title: 'Nuevo turno', subtitle: 'Agendar un turno', badge: 'Acción', icon: 'calendar-plus' },
  { key: 'a-mascota', href: '/mascotas/form', title: 'Nueva mascota', subtitle: 'Registrar un paciente', badge: 'Acción', icon: 'paw' },
  { key: 'a-cliente', href: '/clientes/form', title: 'Nuevo cliente', subtitle: 'Registrar un dueño o tutor', badge: 'Acción', icon: 'account-plus-outline' },
  { key: 'a-agenda', href: '/agenda', title: 'Agenda del día', subtitle: 'Tareas, recordatorios y notas', badge: 'Ir a', icon: 'clipboard-check-outline' },
];

// Lo último que se abrió desde el buscador (mientras la app está abierta).
let recent: Entry[] = [];
function remember(e: Entry) {
  if (e.badge === 'Acción' || e.badge === 'Ir a') return;
  recent = [{ ...e, key: `r-${e.key}` }, ...recent.filter((r) => r.href !== e.href)].slice(0, 5);
}

function petEntry(p: PetWithClient): Entry {
  return {
    key: `p-${p.id}`,
    href: `/mascotas/${p.id}`,
    title: p.name,
    subtitle: [
      speciesLabel[p.species],
      p.breed,
      p.microchip ? `Chip ${p.microchip}` : null,
      p.client ? `${p.client.first_name} ${p.client.last_name}` : 'Sin dueño',
    ]
      .filter(Boolean)
      .join(' · '),
    badge: 'Mascota',
    pet: { photo_path: p.photo_path, species: p.species },
    status: p.status !== 'activa' ? petStatus[p.status] : undefined,
  };
}

function clientEntry(c: ClientHit): Entry {
  return {
    key: `c-${c.id}`,
    href: `/clientes/${c.id}`,
    title: `${c.first_name} ${c.last_name}`,
    subtitle: [
      c.phone,
      c.email,
      c.pets.length ? `🐾 ${c.pets.map((p) => p.name).join(', ')}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'Sin contacto',
    badge: 'Cliente',
    initials: initials(c.first_name, c.last_name),
    status: !c.active ? { label: 'Inactivo', fg: colors.neutral, bg: colors.neutralSoft } : undefined,
  };
}

/** Resalta en el texto lo que se escribió en el buscador. */
function Highlight({ text, term, style }: { text: string; term: string; style: object }) {
  const t = term.trim();
  if (t.length < 2) return <Text style={style}>{text}</Text>;
  const i = text.toLowerCase().indexOf(t.toLowerCase());
  if (i < 0) return <Text style={style}>{text}</Text>;
  return (
    <Text style={style}>
      {text.slice(0, i)}
      <Text style={styles.mark}>{text.slice(i, i + t.length)}</Text>
      {text.slice(i + t.length)}
    </Text>
  );
}

// ---------------------------------------------------------------- Ventana

export function GlobalSearch() {
  const open = useSyncExternalStore(searchStore.subscribe, searchStore.get, searchStore.get);
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={closeSearch}>
      {open ? <SearchPanel /> : null}
    </Modal>
  );
}

function SearchPanel() {
  const { height } = useWindowDimensions();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Results>({ pets: [], clients: [] });
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const requestId = useRef(0);
  const typing = q.trim().length >= 2;

  useEffect(() => {
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      const r = await search(q);
      if (id === requestId.current) {
        setResults(r);
        setActive(0);
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [q]);

  // Secciones que se muestran: resultados al escribir; accesos rápidos y recientes si está vacío.
  const sections: { title: string; icon: IconName; items: Entry[] }[] = typing
    ? [
        { title: `Mascotas (${results.pets.length})`, icon: 'paw' as IconName, items: results.pets.map(petEntry) },
        { title: `Clientes (${results.clients.length})`, icon: 'account-group-outline' as IconName, items: results.clients.map(clientEntry) },
      ].filter((s) => s.items.length > 0)
    : [
        { title: 'Accesos rápidos', icon: 'lightning-bolt-outline' as IconName, items: QUICK_ACTIONS },
        ...(recent.length ? [{ title: 'Vistos recientemente', icon: 'history' as IconName, items: recent }] : []),
      ];
  const flat = sections.flatMap((s) => s.items);
  const empty = typing && !loading && flat.length === 0;

  function go(e: Entry | undefined) {
    if (!e) return;
    remember(e);
    closeSearch();
    router.push(e.href);
  }

  function onKeyPress(e: TextInputKeyPressEvent) {
    const key = e.nativeEvent.key;
    if (key === 'ArrowDown') {
      e.preventDefault?.();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (key === 'ArrowUp') {
      e.preventDefault?.();
      setActive((a) => Math.max(a - 1, 0));
    } else if (key === 'Escape') {
      closeSearch();
    }
  }

  // Posición de cada ítem en la lista completa (para las flechas del teclado).
  const offsets = sections.map((_, s) => sections.slice(0, s).reduce((n, x) => n + x.items.length, 0));

  return (
    <Pressable style={styles.backdrop} onPress={closeSearch}>
      <Pressable style={styles.panel} onPress={() => {}}>
        {/* Campo de búsqueda */}
        <View style={styles.inputRow}>
          <Icon name="magnify" size={26} color={colors.primary} />
          <TextInput
            autoFocus
            value={q}
            onChangeText={setQ}
            onKeyPress={onKeyPress}
            placeholder="Buscar mascota o cliente…"
            placeholderTextColor={colors.textSubtle}
            style={[styles.input, NO_FOCUS_RING]}
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={() => go(flat[active])}
            accessibilityLabel="Buscar mascota o cliente"
          />
          {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          {q ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Borrar búsqueda" onPress={() => setQ('')} style={styles.clear}>
              <Icon name="close-circle" size={20} color={colors.textSubtle} />
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar buscador" onPress={closeSearch} style={styles.escBtn}>
            <Text style={styles.escText}>{Platform.OS === 'web' ? 'Esc' : 'Cerrar'}</Text>
          </Pressable>
        </View>

        {/* Resultados */}
        <ScrollView style={{ maxHeight: Math.max(260, height * 0.6) }} keyboardShouldPersistTaps="handled">
          {!typing ? (
            <Text style={styles.tip}>
              Mascotas por <Text style={styles.tipStrong}>nombre, raza o chip</Text> · Clientes por{' '}
              <Text style={styles.tipStrong}>nombre, email o teléfono</Text>
            </Text>
          ) : null}

          {empty ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="magnify-close" size={30} color={colors.textSubtle} />
              </View>
              <Text style={styles.emptyTitle}>Sin resultados para “{q.trim()}”</Text>
              <Text style={styles.emptyText}>Probá con otra parte del nombre, el chip o el teléfono.</Text>
            </View>
          ) : null}

          {sections.map((section, s) => (
            <View key={section.title} style={{ paddingBottom: space.sm }}>
              <View style={styles.groupRow}>
                <Icon name={section.icon} size={14} color={colors.textSubtle} />
                <Text style={styles.group}>{section.title}</Text>
              </View>
              {section.items.map((e, k) => {
                const i = offsets[s] + k;
                const selected = i === active;
                return (
                  <Pressable
                    key={e.key}
                    onPress={() => go(e)}
                    onHoverIn={() => setActive(i)}
                    style={[styles.item, selected && styles.itemActive]}
                  >
                    {selected ? <View style={styles.activeBar} /> : null}
                    {e.pet ? (
                      <PetAvatar path={e.pet.photo_path} species={e.pet.species} size={48} />
                    ) : e.icon ? (
                      <View style={styles.actionIcon}>
                        <Icon name={e.icon} size={24} color={colors.primary} />
                      </View>
                    ) : (
                      <Avatar text={e.initials} size={48} />
                    )}
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Highlight text={e.title} term={q} style={styles.itemTitle} />
                      <Highlight text={e.subtitle} term={q} style={styles.itemSub} />
                    </View>
                    {e.status ? <Chip label={e.status.label} fg={e.status.fg} bg={e.status.bg} /> : null}
                    <Text style={styles.badge}>{e.badge}</Text>
                    <Icon name={selected ? 'arrow-right' : 'chevron-right'} size={20} color={selected ? colors.primary : colors.borderStrong} />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* Atajos de teclado (solo en la compu) */}
        {Platform.OS === 'web' ? (
          <View style={styles.footer}>
            <Kbd keys={['↑', '↓']} label="moverse" />
            <Kbd keys={['Enter']} label="abrir" />
            <Kbd keys={['Esc']} label="cerrar" />
            <View style={{ flex: 1 }} />
            <Kbd keys={['Ctrl', 'K']} label="abrir desde cualquier pantalla" />
          </View>
        ) : null}
      </Pressable>
    </Pressable>
  );
}

function Kbd({ keys, label }: { keys: string[]; label: string }) {
  return (
    <View style={styles.kbdRow}>
      {keys.map((k) => (
        <Text key={k} style={styles.kbd}>
          {k}
        </Text>
      ))}
      <Text style={styles.kbdLabel}>{label}</Text>
    </View>
  );
}

/** Botón con forma de buscador (menú lateral de la PC). */
export function SearchTrigger() {
  return (
    <Pressable accessibilityRole="search" onPress={openSearch} style={styles.trigger}>
      <Icon name="magnify" size={18} color={colors.textSubtle} />
      <Text style={styles.triggerText}>Buscar…</Text>
      {Platform.OS === 'web' ? <Text style={styles.kbd}>Ctrl K</Text> : null}
    </Pressable>
  );
}

/** Botón flotante de búsqueda (celular). */
export function SearchFab({ bottom }: { bottom: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Buscar" onPress={openSearch} style={[styles.fab, { bottom }]}>
      <Icon name="magnify" size={24} color={colors.primaryText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 28, 48, 0.5)',
    alignItems: 'center',
    paddingTop: '8%',
    paddingHorizontal: space.md,
  },
  panel: {
    width: '100%',
    maxWidth: 780,
    borderRadius: 24,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    shadowColor: '#0b1c30',
    shadowOpacity: 0.25,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 20 },
    elevation: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.medium,
    fontSize: 20,
    color: colors.text,
    paddingVertical: 22,
  },
  clear: { padding: 4 },
  escBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  escText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textMuted },
  tip: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSubtle,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
  },
  tipStrong: { fontFamily: fonts.semibold, color: colors.textMuted },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  group: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textSubtle,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    borderRadius: radius.lg,
  },
  itemActive: { backgroundColor: colors.primarySoft },
  activeBar: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  itemTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
  itemSub: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textMuted },
  mark: { backgroundColor: '#fde68a', color: colors.text, borderRadius: 3 },
  badge: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.textSubtle,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.xl },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  emptyTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text, textAlign: 'center' },
  emptyText: { fontFamily: fonts.regular, fontSize: 14, color: colors.textSubtle, textAlign: 'center' },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.lg,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  kbdRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kbd: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.textMuted,
    minWidth: 22,
    textAlign: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderBottomWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  kbdLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.textSubtle, marginLeft: 2 },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: space.md,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  triggerText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.textSubtle },
  fab: {
    position: 'absolute',
    right: space.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: '#0b1c30',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
