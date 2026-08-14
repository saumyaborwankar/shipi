import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
import { colors, fonts, radius, spacing, typography, type ColorToken } from '@/theme/tokens';

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

export function Button({ children, onPress, variant = 'secondary', disabled, style, accessibilityLabel, leading }: ButtonProps): React.ReactElement {
  const { animStyle, pressIn, pressOut } = usePressScale(0.96, 0.85);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      style={[
        styles.btn,
        BTN_BASE[variant],
        disabled && styles.btnDisabled,
        animStyle,
        style,
      ]}>
      {leading}
      <ShipiText
        type="button"
        color={BTN_TEXT[variant]}
        style={[styles.btnText, leading ? styles.btnTextWithIcon : null]}>
        {children}
      </ShipiText>
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
}

export function Card({ children, style, padded = true }: CardProps): React.ReactElement {
  return (
    <View style={[styles.card, padded && styles.cardPadded, style]}>
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
    <View style={[styles.seg, style]}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="button"
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
}

export function Field({ label, style, ...props }: FieldProps): React.ReactElement {
  return (
    <View style={styles.fieldWrap}>
      {label ? (
        <ShipiText type="eyebrow" color="inkFaint" style={styles.fieldLabel}>
          {label}
        </ShipiText>
      ) : null}
      <TextInput
        {...props}
        style={[styles.field, style]}
        placeholderTextColor={colors.inkFaint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.xxs + 2,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs - 2,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  btnTextWithIcon: {
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
  seg: {
    flexDirection: 'row',
    backgroundColor: colors.canvasSoft,
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
    shadowColor: '#3D3A33',
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
    borderColor: colors.hairlineStrong,
    borderRadius: radius.md,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.surface,
    fontFamily: fonts.sans,
  },
});
