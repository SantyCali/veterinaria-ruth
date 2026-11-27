import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeIn, staggerDelay } from './motion';
import { DatePickerModal } from './date-picker';
import { fmtDate, inputToDbDate, maskDateInput, maskTimeInput, parseDbDate } from '@/lib/dates';
import { colors, fonts, radius, space } from '@/lib/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({ name, size = 20, color = colors.textMuted }: { name: IconName; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

// ---------------------------------------------------------------- Texto

type TxtVariant = 'h1' | 'h2' | 'h3' | 'body' | 'bodyStrong' | 'small' | 'label' | 'muted';

export function Txt({
  variant = 'body',
  style,
  children,
  numberOfLines,
}: {
  variant?: TxtVariant;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
}) {
  return (
    <Text style={[txt[variant], style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

const txt = StyleSheet.create({
  h1: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 34, color: colors.text },
  h2: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 28, color: colors.text },
  h3: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22, color: colors.text },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, color: colors.text },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textSubtle,
  },
  muted: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: colors.textSubtle },
});

// ---------------------------------------------------------------- Pantalla

export function Screen({
  title,
  subtitle,
  back,
  actions,
  children,
  scroll = true,
  loading = false,
}: {
  title?: string;
  subtitle?: string;
  back?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
  scroll?: boolean;
  /**
   * Mientras sea true se muestra solo el encabezado y un indicador de carga.
   * El contenido se monta (y entra en cascada) recién cuando llegan los datos,
   * así no se anima vacío ni pega un salto al cargarse.
   * Pasar `loading && !data` para que las recargas en segundo plano no lo oculten.
   */
  loading?: boolean;
}) {
  const header = title ? (
    <View style={s.header}>
      <View style={s.headerLeft}>
        {back && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            style={s.backBtn}
          >
            <Icon name="arrow-left" size={22} color={colors.text} />
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Txt variant="h1">{title}</Txt>
          {subtitle ? <Txt variant="muted">{subtitle}</Txt> : null}
        </View>
      </View>
      {actions ? <View style={s.headerActions}>{actions}</View> : null}
    </View>
  ) : null;

  // Entrada en cascada: primero el encabezado y después cada bloque de la pantalla.
  const content = (
    <>
      {header ? <FadeIn distance={8}>{header}</FadeIn> : null}
      {loading ? (
        <Loading />
      ) : (
        Children.toArray(children).map((child, i) => (
          <FadeIn key={isValidElement(child) && child.key != null ? child.key : i} delay={staggerDelay(i + 1)}>
            {child}
          </FadeIn>
        ))
      )}
    </>
  );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {scroll ? (
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.inner}>{content}</View>
        </ScrollView>
      ) : (
        <View style={[s.scroll, { flex: 1 }]}>
          <View style={[s.inner, { flex: 1 }]}>{content}</View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------- Contenedores

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Row({
  children,
  gap = space.sm,
  style,
  wrap,
}: {
  children: ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
  wrap?: boolean;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, wrap && { flexWrap: 'wrap' }, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
      <Txt variant="h3">{title}</Txt>
      {action}
    </Row>
  );
}

// ---------------------------------------------------------------- Botones

type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  small,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = buttonVariants[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && { opacity: 0.85 },
        isDisabled && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : icon ? (
        <Icon name={icon} size={small ? 16 : 18} color={v.fg} />
      ) : null}
      <Text style={[s.btnText, small && { fontSize: 13 }, { color: v.fg }]}>{title}</Text>
    </Pressable>
  );
}

const buttonVariants: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.primaryText, border: colors.primary },
  accent: { bg: colors.accent, fg: '#ffffff', border: colors.accent },
  secondary: { bg: colors.surface, fg: colors.primary, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  danger: { bg: colors.surface, fg: colors.danger, border: colors.dangerSoft },
};

export function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={s.iconBtn}>
      <Icon name={icon} size={20} color={colors.textMuted} />
    </Pressable>
  );
}

// ---------------------------------------------------------------- Formularios

/**
 * Un Field reparte el ancho con los demás solo cuando está dentro de un FormRow.
 * Afuera (en columna) ocupa lo que mide su contenido: si usara flex: 1 ahí, en web
 * su alto queda fijo y lo que se despliega adentro (como la lista de ClientPicker)
 * se dibuja encima de los campos de abajo.
 */
const InFormRow = createContext(false);

export function Field({
  label,
  required,
  hint,
  error,
  minWidth = 220,
  width,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  /** Ancho mínimo dentro de un FormRow antes de pasar a la línea de abajo. */
  minWidth?: number;
  /** Ancho fijo dentro de un FormRow (por ejemplo, para la hora). */
  width?: number;
  children: ReactNode;
}) {
  const inRow = useContext(InFormRow);
  const layout: ViewStyle = !inRow ? {} : width ? { width } : { flex: 1, minWidth };
  return (
    <View style={[{ gap: 6 }, layout]}>
      <Text style={s.fieldLabel}>
        {label}
        {required ? <Text style={{ color: colors.accent }}> *</Text> : null}
      </Text>
      <InFormRow.Provider value={false}>{children}</InFormRow.Provider>
      {error ? <Text style={s.fieldError}>{error}</Text> : hint ? <Txt variant="small">{hint}</Txt> : null}
    </View>
  );
}

export function Input(props: TextInputProps & { invalid?: boolean }) {
  const { style, multiline, invalid, onFocus, onBlur, ...rest } = props;
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.textSubtle}
      multiline={multiline}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      // En web se saca el recuadro del navegador: el foco se marca con el borde verde.
      style={[
        s.input,
        NO_FOCUS_RING,
        multiline && s.inputMulti,
        focused && s.inputFocused,
        invalid && { borderColor: colors.danger },
        style,
      ]}
      {...rest}
    />
  );
}

type MaskedInputProps = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (text: string) => void;
};

/** Fecha DD/MM/AAAA: se escriben solo los números y las barras se ponen solas. */
export function DateInput({ value, onChangeText, style, ...rest }: MaskedInputProps) {
  const [open, setOpen] = useState(false);
  const typed = inputToDbDate(value);
  return (
    <View style={s.dateWrap}>
      <Input
        placeholder="DD/MM/AAAA"
        {...rest}
        style={[{ flex: 1, paddingRight: 44 }, style]}
        value={value}
        onChangeText={(t) => onChangeText(maskDateInput(t, value))}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={10}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Abrir calendario"
        onPress={() => setOpen(true)}
        style={s.dateBtn}
      >
        <Icon name="calendar-month-outline" size={20} color={colors.primary} />
      </Pressable>
      <DatePickerModal
        visible={open}
        value={typed ? parseDbDate(typed) : null}
        onClose={() => setOpen(false)}
        onSelect={(d) => onChangeText(fmtDate(d))}
      />
    </View>
  );
}

/** Hora HH:MM: se escriben solo los números y los dos puntos se ponen solos. */
export function TimeInput({ value, onChangeText, ...rest }: MaskedInputProps) {
  return (
    <Input
      placeholder="HH:MM"
      {...rest}
      value={value}
      onChangeText={(t) => onChangeText(maskTimeInput(t, value))}
      keyboardType="number-pad"
      inputMode="numeric"
      maxLength={5}
    />
  );
}

export function FormRow({ children }: { children: ReactNode }) {
  return (
    <InFormRow.Provider value={true}>
      <View style={s.formRow}>{children}</View>
    </InFormRow.Provider>
  );
}

/** Botones tipo "pastilla" para elegir una opción. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <Row wrap gap={6}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[s.seg, selected && s.segSelected]}
          >
            <Text style={[s.segText, selected && { color: colors.primaryText }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

export function SearchBar({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[s.search, focused && s.inputFocused]}>
      <Icon name="magnify" size={20} color={focused ? colors.primary : colors.textSubtle} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        style={[s.searchInput, NO_FOCUS_RING]}
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {value ? (
        <Pressable accessibilityLabel="Borrar búsqueda" onPress={() => onChangeText('')}>
          <Icon name="close-circle" size={18} color={colors.textSubtle} />
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------- Estados

export function Chip({ label, fg, bg, icon }: { label: string; fg: string; bg: string; icon?: IconName }) {
  return (
    <View style={[s.chip, { backgroundColor: bg }]}>
      {icon ? <Icon name={icon} size={12} color={fg} /> : <View style={[s.chipDot, { backgroundColor: fg }]} />}
      <Text style={[s.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ padding: space.xxl, alignItems: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <View style={s.errorBox}>
      <Icon name="alert-circle-outline" color={colors.danger} />
      <Txt style={{ color: colors.danger, flex: 1 }}>{message}</Txt>
    </View>
  );
}

export function EmptyState({ icon = 'paw', text }: { icon?: IconName; text: string }) {
  return (
    <View style={s.empty}>
      <Icon name={icon} size={32} color={colors.borderStrong} />
      <Txt variant="muted" style={{ textAlign: 'center' }}>
        {text}
      </Txt>
    </View>
  );
}

export function Avatar({ text, size = 40, icon }: { text?: string; size?: number; icon?: IconName }) {
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {icon ? (
        <Icon name={icon} size={size * 0.55} color={colors.primary} />
      ) : (
        <Text style={[s.avatarText, { fontSize: size * 0.38 }]}>{text}</Text>
      )}
    </View>
  );
}

export const initials = (a?: string | null, b?: string | null) =>
  `${(a ?? '').trim().charAt(0)}${(b ?? '').trim().charAt(0)}`.toUpperCase() || '?';

/** Fila tocable para listas (clientes, mascotas, turnos...). */
export function ListItem({
  left,
  title,
  subtitle,
  right,
  onPress,
}: {
  left?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [s.listItem, pressed && { backgroundColor: colors.surfaceAlt }]}
    >
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt variant="bodyStrong" numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="small" numberOfLines={2}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

export function StatCard({
  icon,
  label,
  value,
  detail,
  tone = colors.primary,
  index = 0,
}: {
  icon: IconName;
  label: string;
  value: string | number;
  detail?: string;
  tone?: string;
  /** Posición en la fila, para que las tarjetas entren una detrás de otra. */
  index?: number;
}) {
  return (
    <FadeIn delay={staggerDelay(index, 140)} variant="pop" style={{ flex: 1, minWidth: 160 }}>
      <Card style={{ flex: 1, gap: space.sm }}>
        <View style={[s.statIcon, { backgroundColor: colors.surfaceAlt }]}>
          <Icon name={icon} size={20} color={tone} />
        </View>
        <Txt variant="label">{label}</Txt>
        <Text style={[s.statValue, { color: colors.text }]}>{value}</Text>
        {detail ? <Txt variant="small">{detail}</Txt> : null}
      </Card>
    </FadeIn>
  );
}

/**
 * Saca el recuadro de foco que dibuja el navegador (Chrome lo muestra aunque el ancho sea 0
 * si el estilo es "auto"). Solo en web; el foco se sigue viendo con el borde verde.
 * Los tipos de React Native no incluyen 'none', por eso el cast.
 */
export const NO_FOCUS_RING = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: space.lg, paddingBottom: 96 },
  inner: { width: '100%', maxWidth: 1200, alignSelf: 'center', gap: space.lg },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: space.md, flex: 1, minWidth: 240 },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  btnSmall: { paddingHorizontal: 12, paddingVertical: 7 },
  btnText: { fontFamily: fonts.semibold, fontSize: 14 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted },
  fieldError: { fontFamily: fonts.medium, fontSize: 12, color: colors.danger },
  input: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputMulti: { minHeight: 84, textAlignVertical: 'top' },
  // Foco visible y prolijo: borde verde de la app en lugar del recuadro negro del navegador.
  inputFocused: { borderColor: colors.primary },
  formRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  dateWrap: { flexDirection: 'row', alignItems: 'center' },
  dateBtn: {
    position: 'absolute',
    right: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seg: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  segSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontFamily: fonts.semibold, fontSize: 12 },
  errorBox: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  empty: { alignItems: 'center', gap: space.sm, padding: space.xl },
  avatar: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.bold, color: colors.primary },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36 },
});
