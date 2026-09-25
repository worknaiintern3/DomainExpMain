import React from 'react';
import {
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '../../theme';

interface NeonCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle> | undefined;
  onPress?: (() => void) | undefined;
  glow?: boolean | undefined;
  variant?: 'normal' | 'elevated' | 'active' | 'critical' | undefined;
}

export const NeonCard: React.FC<NeonCardProps> = ({
  children,
  style,
  onPress,
  glow = false,
  variant = 'normal',
}) => {
  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return styles.cardElevated;
      case 'active':
        return styles.cardActive;
      case 'critical':
        return styles.cardCritical;
      default:
        return styles.cardNormal;
    }
  };

  const cardStyle = [
    styles.baseCard,
    getVariantStyle(),
    glow && styles.cardGlow,
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={cardStyle}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  baseCard: {
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardNormal: {
    backgroundColor: colors.bgCard,
    borderColor: colors.borderSubtle,
  },
  cardElevated: {
    backgroundColor: colors.bgCardElevated,
    borderColor: colors.borderNormal,
  },
  cardActive: {
    backgroundColor: colors.bgCard,
    borderColor: colors.borderActive,
  },
  cardCritical: {
    backgroundColor: colors.bgCard,
    borderColor: colors.borderCritical,
  },
  cardGlow: {
    borderColor: colors.neonCyan,
    shadowColor: colors.neonCyan,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
});
