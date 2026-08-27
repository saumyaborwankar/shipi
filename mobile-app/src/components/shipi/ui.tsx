import React, { useState } from 'react';
import {
  ActivityIndicator,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputFocusEventData,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {
  colors,
  fonts,
  shadows,
  radius,
  spacing,
  typography,
  type ColorToken,
} from '@/theme/tokens';

const PRESS_IN = { damping: 20, stiffness: 340, mass: 0.5 };
const PRESS_OUT = { damping: 14, stiffness: 220, mass: 0.6 };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function usePressScale(scaleTo: number, pressOpacity: number) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const pressIn = (): void => {
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withSpring(scaleTo, PRESS_IN);
    // eslint-disable-next-line react-hooks/immutability
    opacity.value = withSpring(pressOpacity, PRESS_IN);
  };

  const pressOut = (): void => {
    // eslint-disable-next-line react-hooks/immutability
    scale.value = withSpring(1, PRESS_OUT);
    // eslint-disable-next-line react-hooks/immutability
    opacity.value = withSpring(1, PRESS_OUT);
  };

  return { animStyle, pressIn, pressOut };
}

interface ShipiTextProps {
  children: React.ReactNode;
  color?: ColorToken;
  style?: StyleProp<TextStyle>;
  type?: keyof typeof typography;
  numberOfLines?: number;
}

export function ShipiText({ children, color = 'ink', style, type = 'bodySm', numberOfLines }: ShipiTextProps): React.ReactElement {
  return (
    <Text
      style={[typography[type], { color: colors[color], fontFamily: fonts.sans }, style]}
      numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';

interface ButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  leading?: React.ReactElement;
}

const BTN_BASE: Record<ButtonVariant, ViewStyle> = {
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  secondary: { backgroundColor: colors.surface, borderColor: colors.hairlineStrong },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  danger: { backgroundColor: colors.surface, borderColor: colors.hairlineStrong },
  soft: { backgroundColor: colors.primarySoft, borderColor: colors.primarySoft },
};

const BTN_TEXT: Record<ButtonVariant, ColorToken> = {
  primary: 'onPrimary',
  secondary: 'ink',
  ghost: 'inkSecondary',
  danger: 'danger',
  soft: 'primary',
};

export function Button({ children, onPress, variant = 'secondary', disabled, loading, style, accessibilityLabel, leading }: ButtonProps): React.ReactElement {
  const { animStyle, pressIn, pressOut } = usePressScale(0.96, 0.85);
  const isDisabled = disabled || loading;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={[
        styles.btn,
        BTN_BASE[variant],
        variant === 'primary' && styles.btnPrimary,
        isDisabled && styles.btnDisabled,
        animStyle,
        style,
      ]}>
      {leading}
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.onPrimary : colors.inkMuted}
          style={styles.btnSpinner}
        />
      ) : (
        <ShipiText
          type="button"
          color={variant === 'ghost' && isDisabled ? 'inkFaint' : BTN_TEXT[variant]}
          style={[styles.btnText, leading ? styles.btnTextWithIcon : null]}>
          {children}
        </ShipiText>
      )}
    </AnimatedPressable>
  );
}

interface IconButtonProps {
  onPress?: () => void;
  danger?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  size?: number;
  children: React.ReactElement;
}

export function IconButton({ onPress, danger, style, accessibilityLabel, children }: IconButtonProps): React.ReactElement {
  const { animStyle, pressIn, pressOut } = usePressScale(0.9, 0.7);

  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[styles.iconBtn, danger && styles.iconBtnDanger, animStyle, style]}>
      {children}
    </AnimatedPressable>
  );
}

interface PressableScaleProps {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  scaleTo?: number;
}

export function PressableScale({ children, onPress, disabled, style, accessibilityLabel, scaleTo = 0.97 }: PressableScaleProps): React.ReactElement {
  const { animStyle, pressIn, pressOut } = usePressScale(scaleTo, 1);

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[animStyle, style]}>
      {children}
    </AnimatedPressable>
  );
}

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
}

export function Card({ children, style, padded = true, elevated = false }: CardProps): React.ReactElement {
  return (
    <View style={[styles.card, padded && styles.cardPadded, elevated && styles.cardElevated, style]}>
      {children}
    </View>
  );
}

interface SegmentedControlProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  labels?: Partial<Record<T, string>>;
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl<T extends string>({ options, value, onChange, labels, style }: SegmentedControlProps<T>): React.ReactElement {
  return (
    <View style={[styles.seg, style]} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segSegment, active && styles.segSegmentActive]}>
            <ShipiText type="caption" color={active ? 'primary' : 'inkMuted'} style={{ fontWeight: active ? '600' : '500' }}>
              {labels?.[option] ?? option}
            </ShipiText>
          </Pressable>
        );
      })}
    </View>
  );
}

interface PillProps {
  children: React.ReactNode;
  color?: ColorToken;
  soft?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Pill({ children, color = 'inkMuted', soft = true, style }: PillProps): React.ReactElement {
  return (
    <View style={[styles.pill, soft && { backgroundColor: `${colors[color]}1A` }, style]}>
      <ShipiText type="caption" color={color} style={{ fontSize: 12, fontWeight: '600' }}>
        {children}
      </ShipiText>
    </View>
  );
}

interface FieldProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
}

export function Field({ label, error, hint, style, onFocus, onBlur, ...props }: FieldProps): React.ReactElement {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.fieldWrap}>
      {label ? (
        <ShipiText type="eyebrow" color="inkFaint" style={styles.fieldLabel}>
          {label}
        </ShipiText>
      ) : null}
      <TextInput
        {...props}
        onFocus={(e: NativeSyntheticEvent<TextInputFocusEventData>) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e: NativeSyntheticEvent<TextInputFocusEventData>) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.field,
          focused && styles.fieldFocused,
          error && styles.fieldError,
          style,
        ]}
        placeholderTextColor={colors.inkFaint}
      />
      {error ? (
        <ShipiText type="caption" color="danger" style={styles.fieldMsg}>
          {error}
        </ShipiText>
      ) : hint ? (
        <ShipiText type="caption" color="inkMuted" style={styles.fieldMsg}>
          {hint}
        </ShipiText>
      ) : null}
    </View>
  );
}

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  round?: number;
  style?: StyleProp<ViewStyle>;
}

/** Static skeleton block — use a few of these to frame loading content. */
export function Skeleton({ width = '100%', height = 14, round = radius.sm, style }: SkeletonProps): React.ReactElement {
  return <View style={[styles.skeleton, { width, height, borderRadius: round }, style]} />;
}

interface EmptyStateProps {
  icon?: React.ReactElement;
  title: string;
  body?: string;
  actions?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Teaches the interface instead of saying "nothing here". */
export function EmptyState({ icon, title, body, actions, style }: EmptyStateProps): React.ReactElement {
  return (
    <View style={[styles.empty, style]}>
      {icon ? <View style={styles.emptyIcon}>{icon}</View> : null}
      <ShipiText type="heading3" color="ink" style={styles.emptyTitle}>
        {title}
      </ShipiText>
      {body ? (
        <ShipiText type="bodySm" color="inkMuted" style={styles.emptyBody}>
          {body}
        </ShipiText>
      ) : null}
      {actions ? <View style={styles.emptyActions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs - 2,
    minHeight: 40,
  },
  btnPrimary: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnText: {
    fontSize: typography.button.fontSize,
    fontWeight: typography.button.fontWeight,
    lineHeight: typography.button.lineHeight,
  },
  btnTextWithIcon: {
    marginLeft: spacing.xxs,
  },
  btnSpinner: {
    marginLeft: spacing.xxs,
  },
  iconBtn: {
    padding: spacing.xxs + 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconBtnDanger: {
    backgroundColor: 'transparent',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  cardPadded: {
    padding: spacing.md,
  },
  cardElevated: {
    ...shadows.soft,
    ...Platform.select({
      android: { elevation: 3 },
      default: {},
    }),
  },
  seg: {
    flexDirection: 'row',
    backgroundColor: colors.hairline,
    borderRadius: radius.md,
    padding: 3,
    gap: 2,
  },
  segSegment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxs + 1,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  segSegmentActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  fieldWrap: {
    gap: spacing.xxs,
  },
  fieldLabel: {
    textTransform: 'uppercase',
  },
  field: {
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: radius.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.surface,
    fontFamily: fonts.sans,
  },
  fieldFocused: {
    borderColor: colors.focus,
    shadowColor: colors.focus,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 1,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  fieldMsg: {
    marginTop: 1,
  },
  skeleton: {
    backgroundColor: colors.skeleton,
  },
  empty: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.xs,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxs,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
    maxWidth: 300,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});
