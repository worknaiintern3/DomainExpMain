import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, Typography, Radius } from '../../constants/theme';
import { useAuth } from '../../store/auth-context';
import { useTheme } from '../../store/theme-context';

import { BrandLogo } from './BrandLogo';

interface HeaderBarProps {
  title?: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
}

export function HeaderBar({ title = 'DomainPulse', subtitle, rightAction }: HeaderBarProps) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.borderSubtle,
          paddingTop: Math.max(insets.top, 16),
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.titleGroup}>
          <View style={styles.brandRow}>
            <BrandLogo size={24} />
            <Text style={[styles.brandTitle, { color: colors.text, marginLeft: 8 }]}>{title}</Text>
          </View>
          {subtitle && <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
        </View>

        <View style={styles.rightGroup}>

          {rightAction || (
            <TouchableOpacity
              style={[
                styles.avatarButton,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => logout()}
              activeOpacity={0.7}
            >
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {(user?.displayName || user?.email || 'DP').substring(0, 2).toUpperCase()}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGroup: {
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 24,
    height: 24,
    borderRadius: 6,
    marginRight: 8,
  },
  brandTitle: {
    ...Typography.titleMedium,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    ...Typography.bodySmall,
    marginTop: 2,
  },
  rightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatarButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Typography.caption,
    fontWeight: '700',
  },
});
