import { useEffect, useRef, useSyncExternalStore } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Icon, type IconName } from './ui';
import { dialogStore, dismissToast, type Toast, type ToastType } from '@/lib/dialogs';
import { colors, fonts, radius, space, WIDE_BREAKPOINT } from '@/lib/theme';

const EXIT_MS = 160;

const TONES: Record<ToastType, { icon: IconName; fg: string; bg: string }> = {
  success: { icon: 'check-circle', fg: colors.success, bg: colors.successSoft },
  error: { icon: 'alert-circle', fg: colors.danger, bg: colors.dangerSoft },
  warning: { icon: 'alert', fg: colors.warning, bg: colors.warningSoft },
  info: { icon: 'information', fg: colors.info, bg: colors.infoSoft },
};

/** Dibuja los toasts y la ventana de confirmación. Se monta una vez en el layout raíz. */
export function DialogHost() {
  const { toasts, confirm } = useSyncExternalStore(
    dialogStore.subscribe,
    dialogStore.getSnapshot,
    dialogStore.getSnapshot,
  );
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= WIDE_BREAKPOINT;

  return (
    <>
      <View
        pointerEvents="box-none"
        style={[
          styles.stack,
          { top: insets.top + space.md },
          wide ? { right: space.lg, width: 360 } : { left: space.md, right: space.md },
        ]}
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </View>

      <Modal visible={!!confirm} transparent animationType="fade" onRequestClose={() => confirm?.resolve(false)}>
        <Pressable style={styles.backdrop} onPress={() => confirm?.resolve(false)}>
          {confirm ? (
            <Pressable style={styles.dialog} onPress={() => {}}>
              <View style={[styles.dialogIcon, { backgroundColor: confirm.danger ? colors.dangerSoft : colors.primarySoft }]}>
                <Icon
                  name={confirm.danger ? 'alert-outline' : 'help-circle-outline'}
                  size={26}
                  color={confirm.danger ? colors.danger : colors.primary}
                />
              </View>
              <Text style={styles.dialogTitle}>{confirm.title}</Text>
              <Text style={styles.dialogMessage}>{confirm.message}</Text>
              <View style={styles.dialogActions}>
                <Button title={confirm.cancelText} variant="secondary" onPress={() => confirm.resolve(false)} style={{ flex: 1 }} />
                <Button
                  title={confirm.okText}
                  variant={confirm.danger ? 'accent' : 'primary'}
                  onPress={() => confirm.resolve(true)}
                  style={{ flex: 1 }}
                />
              </View>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  const tone = TONES[toast.type];
  // Todo corre en el hilo de UI (Reanimated) y solo se animan opacity/transform:
  // nada recalcula el diseño en cada cuadro, así va fluido a 120/144 Hz.
  const enter = useSharedValue(0);
  const progress = useSharedValue(1);
  const closing = useRef(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function close() {
    if (closing.current) return;
    closing.current = true;
    enter.set(withTiming(0, { duration: EXIT_MS }));
    exitTimer.current = setTimeout(() => dismissToast(toast.id), EXIT_MS);
  }

  useEffect(() => {
    enter.set(withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }));
    // Barra de tiempo (como toastify) y cierre automático al terminar.
    progress.set(withTiming(0, { duration: toast.duration, easing: Easing.linear }));
    const autoClose = setTimeout(close, toast.duration);
    return () => {
      clearTimeout(autoClose);
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: enter.get(),
    transform: [{ translateY: (1 - enter.get()) * -12 }],
  }));
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }));

  return (
    <Animated.View style={[styles.toast, cardStyle]}>
      <Pressable accessibilityRole="alert" onPress={close} style={styles.toastBody}>
        <View style={[styles.toastIcon, { backgroundColor: tone.bg }]}>
          <Icon name={tone.icon} size={20} color={tone.fg} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.toastTitle}>{toast.title}</Text>
          {toast.message ? <Text style={styles.toastMessage}>{toast.message}</Text> : null}
        </View>
        <Icon name="close" size={16} color={colors.textSubtle} />
      </Pressable>
      <Animated.View style={[styles.toastBar, { backgroundColor: tone.fg }, barStyle]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stack: { position: 'absolute', zIndex: 1000, gap: space.sm },
  toast: {
    overflow: 'hidden',
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0b1c30',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  toastBody: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, padding: space.md },
  toastIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  toastTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  toastMessage: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  // La barra se achica con scaleX desde la izquierda (no cambia el ancho: no recalcula diseño).
  toastBar: { height: 3, width: '100%', transformOrigin: 'left' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 28, 48, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
  },
  dialogIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  dialogTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, textAlign: 'center' },
  dialogMessage: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21, color: colors.textMuted, textAlign: 'center' },
  dialogActions: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch', marginTop: space.sm },
});
