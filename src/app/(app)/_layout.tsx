import { router, Stack, usePathname, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlobalSearch, SearchFab, SearchTrigger, useSearchShortcut } from '@/components/global-search';
import { OfflineBanner } from '@/components/offline-banner';
import { useOfflineSync } from '@/lib/offline';
import { Avatar, Icon, initials, Txt, type IconName } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { roleLabel } from '@/lib/labels';
import { colors, fonts, radius, space, WIDE_BREAKPOINT } from '@/lib/theme';

type NavItem = { href: Href; match: string; label: string; short: string; icon: IconName };

const NAV: NavItem[] = [
  { href: '/', match: '/', label: 'Panel principal', short: 'Inicio', icon: 'view-dashboard-outline' },
  { href: '/turnos', match: '/turnos', label: 'Turnos y calendario', short: 'Turnos', icon: 'calendar-month-outline' },
  { href: '/mascotas', match: '/mascotas', label: 'Mascotas', short: 'Mascotas', icon: 'paw' },
  { href: '/clientes', match: '/clientes', label: 'Clientes', short: 'Clientes', icon: 'account-group-outline' },
  { href: '/agenda', match: '/agenda', label: 'Agenda del día', short: 'Agenda', icon: 'clipboard-check-outline' },
  { href: '/perfil', match: '/perfil', label: 'Mi perfil', short: 'Perfil', icon: 'account-cog-outline' },
];

// En el celu la barra inferior muestra 5 (Perfil queda accesible desde Agenda/Inicio).
const MOBILE_NAV = NAV.slice(0, 5);

function isActive(pathname: string, item: NavItem) {
  if (item.match === '/') return pathname === '/';
  return pathname === item.match || pathname.startsWith(`${item.match}/`);
}

/**
 * Ir a una sección desde el menú sin apilar pantallas: si la sección ya está en el
 * historial vuelve a ella; si no, reemplaza la actual. Así la memoria no crece con el uso.
 */
function goToSection(pathname: string, item: NavItem) {
  if (pathname === item.match) return;
  router.dismissTo(item.href);
}

export default function AppLayout() {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const pathname = usePathname();
  useSearchShortcut();
  // Copia local automática de la base (backup + modo sin internet).
  useOfflineSync();

  // Misma estructura en PC y celu (solo cambia qué menú se muestra), para que al
  // cruzar el ancho límite no se vuelva a montar toda la navegación.
  return (
    <View style={{ flex: 1, flexDirection: wide ? 'row' : 'column', backgroundColor: colors.background }}>
      {wide ? <Sidebar pathname={pathname} /> : null}
      <View style={{ flex: 1 }}>
        <OfflineBanner />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        {wide ? null : <SearchFab bottom={16} />}
      </View>
      {wide ? null : <BottomBar pathname={pathname} />}
      <GlobalSearch />
    </View>
  );
}

function Sidebar({ pathname }: { pathname: string }) {
  const { profile, signOut } = useAuth();
  return (
    <View style={styles.sidebar}>
      <View style={styles.brand}>
        <View style={styles.brandLogo}>
          <Icon name="paw" size={20} color={colors.primaryText} />
        </View>
        <View>
          <Text style={styles.brandTitle}>Veterinaria Ruth</Text>
          <Txt variant="label">Gestión clínica</Txt>
        </View>
      </View>

      <SearchTrigger />

      <View style={{ gap: 4, flex: 1 }}>
        {NAV.map((item) => {
          const active = isActive(pathname, item);
          return (
            <Pressable
              key={item.match}
              accessibilityRole="link"
              accessibilityState={{ selected: active }}
              onPress={() => goToSection(pathname, item)}
              style={(state) => [
                styles.navItem,
                active && styles.navItemActive,
                // `hovered` solo existe en web (react-native-web).
                (state as { hovered?: boolean }).hovered && !active && { backgroundColor: colors.surfaceAlt },
              ]}
            >
              <Icon name={item.icon} size={20} color={active ? colors.primary : colors.textMuted} />
              <Text style={[styles.navText, active && { color: colors.primary, fontFamily: fonts.semibold }]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {profile && (
        <View style={styles.userBox}>
          <Avatar text={initials(profile.first_name, profile.last_name)} size={36} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt variant="bodyStrong" numberOfLines={1}>
              {`${profile.first_name} ${profile.last_name}`.trim() || profile.email}
            </Txt>
            <Txt variant="small">{roleLabel[profile.role]}</Txt>
          </View>
          <Pressable accessibilityLabel="Cerrar sesión" onPress={signOut} style={{ padding: 6 }}>
            <Icon name="logout" size={20} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function BottomBar({ pathname }: { pathname: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {MOBILE_NAV.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Pressable
            key={item.match}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => goToSection(pathname, item)}
            style={styles.tab}
          >
            <View style={[styles.tabIcon, active && { backgroundColor: colors.primarySoft }]}>
              <Icon name={item.icon} size={22} color={active ? colors.primary : colors.textSubtle} />
            </View>
            <Text style={[styles.tabText, active && { color: colors.primary }]}>{item.short}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 250,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    padding: space.lg,
    gap: space.xl,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  brandLogo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.primary },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 10,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  navItemActive: { backgroundColor: colors.primarySoft },
  navText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted },
  userBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2 },
  tabIcon: { paddingHorizontal: 14, paddingVertical: 3, borderRadius: radius.pill },
  tabText: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSubtle },
});
