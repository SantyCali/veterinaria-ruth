import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { addDays, monthName, sameDay, startOfMonth, startOfWeek } from '@/lib/dates';
import { colors, fonts, radius, space } from '@/lib/theme';

// Calendario propio (sin librerías nativas): funciona igual en web, Android, iOS y Expo Go.
// No importa nada de ui.tsx para evitar importaciones circulares.

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

/** Grilla de un mes para elegir un día. */
export function CalendarGrid({
  value,
  onSelect,
  highlight,
}: {
  value: Date | null;
  onSelect: (d: Date) => void;
  /** Días a marcar con un puntito (ej: días con turnos). */
  highlight?: (d: Date) => boolean;
}) {
  const [month, setMonth] = useState(() => startOfMonth(value ?? new Date()));
  const first = startOfWeek(month);
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));
  const today = new Date();

  const move = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.head}>
        <Pressable accessibilityRole="button" accessibilityLabel="Mes anterior" onPress={() => move(-1)} style={styles.arrow}>
          <MaterialCommunityIcons name="chevron-left" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.month}>
          {monthName(month).charAt(0).toUpperCase() + monthName(month).slice(1)} {month.getFullYear()}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Mes siguiente" onPress={() => move(1)} style={styles.arrow}>
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.row}>
        {WEEKDAYS.map((w) => (
          <Text key={w} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>
      {Array.from({ length: 6 }, (_, w) => (
        <View key={w} style={styles.row}>
          {days.slice(w * 7, w * 7 + 7).map((d) => {
            const selected = value ? sameDay(d, value) : false;
            const isToday = sameDay(d, today);
            const outside = d.getMonth() !== month.getMonth();
            return (
              <Pressable
                key={d.toISOString()}
                accessibilityRole="button"
                accessibilityLabel={`${d.getDate()} de ${monthName(d)}`}
                accessibilityState={{ selected }}
                onPress={() => onSelect(d)}
                style={[styles.day, isToday && styles.today, selected && styles.selected]}
              >
                <Text
                  style={[
                    styles.dayText,
                    outside && { color: colors.borderStrong },
                    selected && { color: colors.primaryText, fontFamily: fonts.bold },
                  ]}
                >
                  {d.getDate()}
                </Text>
                {highlight?.(d) ? (
                  <View style={[styles.dot, selected && { backgroundColor: colors.primaryText }]} />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Ventana con el calendario. Se usa en los campos de fecha y en "Ir a fecha". */
export function DatePickerModal({
  visible,
  value,
  title = 'Elegí una fecha',
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: Date | null;
  title?: string;
  onClose: () => void;
  onSelect: (d: Date) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.sheetHead}>
            <Text style={styles.title}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} style={styles.arrow}>
              <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>
          {/* Se monta al abrir, así arranca en el mes de la fecha elegida */}
          {visible ? (
            <CalendarGrid
              value={value}
              onSelect={(d) => {
                onSelect(d);
                onClose();
              }}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              onSelect(new Date());
              onClose();
            }}
            style={styles.todayBtn}
          >
            <Text style={styles.todayBtnText}>Hoy</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const CELL = 40;

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  arrow: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  weekday: {
    width: CELL,
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.textSubtle,
  },
  day: {
    width: CELL,
    height: CELL,
    borderRadius: CELL / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: { borderWidth: 1, borderColor: colors.primary },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  dot: { position: 'absolute', bottom: 5, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 28, 48, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 340,
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  todayBtn: {
    alignSelf: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  todayBtnText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.primary },
});
