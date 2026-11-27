import { StyleSheet, Text, View } from 'react-native';

import { Icon } from './ui';
import { fmtDateTime } from '@/lib/dates';
import { useOffline } from '@/lib/offline';
import { colors, fonts, space } from '@/lib/theme';

/** Aviso arriba de todo cuando no hay internet: se está mirando la copia local. */
export function OfflineBanner() {
  const { online, mirror } = useOffline();
  if (online) return null;
  return (
    <View style={styles.bar} accessibilityRole="alert">
      <Icon name="wifi-off" size={18} color={colors.warning} />
      <Text style={styles.text}>
        <Text style={styles.strong}>Sin internet. </Text>
        {mirror
          ? `Mostrando la copia guardada el ${fmtDateTime(mirror.syncedAt)}. Podés ver todo; para cargar o editar hace falta conexión.`
          : 'Todavía no hay una copia guardada en este dispositivo.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: colors.warningSoft,
    borderBottomWidth: 1,
    borderBottomColor: '#fcd34d',
  },
  text: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: colors.warning },
  strong: { fontFamily: fonts.semibold },
});
