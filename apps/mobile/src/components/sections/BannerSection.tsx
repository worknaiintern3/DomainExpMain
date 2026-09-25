import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { MobileAnnouncement } from '@domainpulse/contracts';
import { colors, radius, spacing, typography } from '../../theme';
import { Icon, IconName } from '../../theme/icons';

interface Props {
  announcements: MobileAnnouncement[];
  title?: string | undefined;
}

export const BannerSection: React.FC<Props> = ({ announcements, title }) => {
  if (!announcements || announcements.length === 0) {
    return null;
  }

  const getBannerMeta = (type: string) => {
    switch (type) {
      case 'critical':
        return {
          icon: 'alert-triangle' as IconName,
          borderColor: colors.borderCritical,
          iconColor: colors.danger,
          bg: 'rgba(239, 68, 68, 0.08)',
        };
      case 'warning':
        return {
          icon: 'alert-triangle' as IconName,
          borderColor: colors.warningGlow,
          iconColor: colors.warning,
          bg: 'rgba(245, 158, 11, 0.08)',
        };
      case 'promo':
        return {
          icon: 'zap' as IconName,
          borderColor: colors.neonGlow,
          iconColor: colors.neonCyan,
          bg: 'rgba(0, 229, 255, 0.08)',
        };
      default:
        return {
          icon: 'info' as IconName,
          borderColor: colors.borderSubtle,
          iconColor: colors.sky,
          bg: colors.bgCard,
        };
    }
  };

  return (
    <View style={styles.container}>
      {title ? <Text style={styles.sectionHeader}>{title}</Text> : null}
      {announcements.map((item) => {
        const meta = getBannerMeta(item.type);
        return (
          <View
            key={item.id}
            style={[
              styles.bannerCard,
              { backgroundColor: meta.bg, borderColor: meta.borderColor },
            ]}
          >
            <View style={styles.iconCol}>
              <Icon name={meta.icon} size={20} color={meta.iconColor} />
            </View>
            <View style={styles.textCol}>
              <Text style={styles.bannerTitle}>{item.title}</Text>
              <Text style={styles.bannerMessage}>{item.message}</Text>
              {item.actionLabel ? (
                <TouchableOpacity style={styles.actionBtn} activeOpacity={0.7}>
                  <Text style={styles.actionLabel}>{item.actionLabel} →</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sectionHeader: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  bannerCard: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    gap: spacing.md,
  },
  iconCol: {
    paddingTop: 2,
  },
  textCol: {
    flex: 1,
  },
  bannerTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    marginBottom: 2,
  },
  bannerMessage: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    lineHeight: 18,
  },
  actionBtn: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  actionLabel: {
    color: colors.neonCyan,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
});
