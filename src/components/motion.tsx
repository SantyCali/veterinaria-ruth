import { useFocusEffect } from 'expo-router';
import { useCallback, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

/** Separación entre un bloque y el siguiente en las entradas en cascada (ms). */
export const STAGGER_MS = 50;
/** Tope de demora, para que en listas largas lo último no tarde en aparecer. */
const MAX_DELAY_MS = 320;

/**
 * Entrada animada. Se repite cada vez que la pantalla vuelve a estar en foco
 * (por ejemplo, al cambiar de sección en el menú), sin volver a montar el contenido:
 * no se pierde lo escrito en buscadores ni formularios.
 * Respeta la opción del sistema "reducir movimiento".
 *
 * - variant "rise" (por defecto): fundido + leve subida. Para bloques de una pantalla.
 * - variant "pop": fundido + leve zoom, sin desplazamiento. Para ítems DENTRO de un bloque
 *   que ya sube (tarjetas de una fila o grilla), así los movimientos no se suman.
 */
export function FadeIn({
  children,
  delay = 0,
  distance = 12,
  duration = 280,
  variant = 'rise',
  style,
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  variant?: 'rise' | 'pop';
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      progress.set(0);
      progress.set(
        withDelay(
          Math.min(delay, MAX_DELAY_MS),
          withTiming(1, { duration, easing: Easing.out(Easing.cubic) }),
        ),
      );
    }, [progress, delay, duration]),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform:
      variant === 'pop'
        ? [{ scale: 0.96 + progress.get() * 0.04 }]
        : [{ translateY: (1 - progress.get()) * distance }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/** Demora para el elemento número `index` de una cascada. */
export const staggerDelay = (index: number, base = 0) => base + index * STAGGER_MS;

/**
 * Cuántos ítems de una lista o grilla se animan. Los que siguen quedan fuera de la
 * pantalla al entrar, así que aparecen directo: animar 200 tarjetas a la vez satura
 * el hilo de UI y baja los cuadros por segundo.
 */
export const MAX_ANIMATED_ITEMS = 12;

/** Ítem de lista/grilla: se anima solo si está entre los primeros MAX_ANIMATED_ITEMS. */
export function StaggerItem({
  index,
  base = 0,
  style,
  children,
}: {
  index: number;
  base?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  if (index >= MAX_ANIMATED_ITEMS) return <View style={style}>{children}</View>;
  return (
    <FadeIn variant="pop" delay={staggerDelay(index, base)} style={style}>
      {children}
    </FadeIn>
  );
}
