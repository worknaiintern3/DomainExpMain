import React from 'react';
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { Icon, IconName } from '../../theme/icons';

interface NeonButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | undefined;
  size?: 'sm' | 'md' | 'lg' | undefined;
  icon?: IconName | undefined;
  loading?: boolean | undefined;
  disabled?: boolean | undefined;
  style?: StyleProp<ViewStyle> | undefined;
  textStyle?: StyleProp<TextStyle> | undefined;
}

export const NeonButton: React.FC<NeonButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  style,
  textStyle,
}) => {
  const getContainerVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryContainer;
      case 'outline':
        return styles.outlineContainer;
      case 'danger':
        return styles.dangerContainer;
      case 'ghost':
        return styles.ghostContainer;
      default:
        return styles.primaryContainer;
    }
  };

  const getTextVariantStyle = (): TextStyle => {
    switch (variant) {
      case 'secondary':
        return styles.secondaryText;
      case 'outline':
        return styles.outlineText;
      case 'danger':
        return styles.dangerText;
      case 'ghost':
        return styles.ghostText;
      default:
        return styles.primaryText;
    }
  };

  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return styles.sizeSm;
      case 'lg':
        return styles.sizeLg;
      default:
        return styles.sizeMd;
    }
  };

  const iconColor =
    variant === 'primary'
      ? colors.bgPrimary
      : variant === 'danger'
      ? colors.danger
      : colors.neonCyan;

  return (
    <TouchableOpacity
      style={[
        styles.baseButton,
        getContainerVariantStyle(),
        getSizeStyle(),
        disabled && styles.disabledContainer,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.bgPrimary : colors.neonCyan}
        />
      ) : (
        <>
          {icon ? (
            <Icon
              name={icon}
              size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16}
              color={iconColor}
            />
          ) : null}
          <Text style={[styles.baseText, getTextVariantStyle(), textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  baseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  sizeSm: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  sizeMd: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  sizeLg: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
  },
  primaryContainer: {
    backgroundColor: colors.neonCyan,
    shadowColor: colors.neonCyan,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  secondaryContainer: {
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  outlineContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.neonCyan,
  },
  dangerContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: colors.borderCritical,
  },
  ghostContainer: {
    backgroundColor: 'transparent',
  },
  disabledContainer: {
    opacity: 0.45,
  },
  baseText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  primaryText: {
    color: '#020B10',
    fontWeight: typography.weights.bold,
  },
  secondaryText: {
    color: colors.textPrimary,
  },
  outlineText: {
    color: colors.neonCyan,
  },
  dangerText: {
    color: colors.danger,
  },
  ghostText: {
    color: colors.textSecondary,
  },
});
