import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../theme';
import { Icon } from '../theme/icons';

interface MoreScreenProps {
  user?: { email: string; name?: string } | null;
  onNavigate: (screen: string) => void;
  onSignOut: () => void;
  configVersion?: string | number | undefined;
}

export const MoreScreen: React.FC<MoreScreenProps> = ({
  user,
  onNavigate,
  onSignOut,
  configVersion = '1.0.0',
}) => {
  const renderMenuItem = (
    icon: any,
    title: string,
    subtitle: string,
    onPress: () => void,
    options?: { badge?: string; danger?: boolean },
  ) => {
    return (
      <TouchableOpacity
        style={[styles.menuItem, options?.danger && styles.menuItemDanger]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.menuIconCircle,
            options?.danger && styles.menuIconCircleDanger,
          ]}
        >
          <Icon
            name={icon}
            size={18}
            color={options?.danger ? colors.neonCoral : colors.neonCyan}
          />
        </View>

        <View style={styles.menuTextCol}>
          <Text
            style={[
              styles.menuTitle,
              options?.danger && styles.menuTitleDanger,
            ]}
          >
            {title}
          </Text>
          <Text style={styles.menuSubtitle}>{subtitle}</Text>
        </View>

        {options?.badge ? (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{options.badge}</Text>
          </View>
        ) : (
          <Icon name="chevron-right" size={16} color={colors.textMuted} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>More</Text>
        <Text style={styles.headerSubtitle}>
          Infrastructure & workspace management
        </Text>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.name || user?.email || 'DP').slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.userName}>{user?.name || 'Administrator'}</Text>
          <Text style={styles.userEmail}>
            {user?.email || 'admin@domainpulse.local'}
          </Text>
          <View style={styles.wsBadge}>
            <Icon name="check-circle" size={10} color={colors.neonGreen} />
            <Text style={styles.wsText}>Primary Workspace</Text>
          </View>
        </View>
      </View>

      {/* Section: Infrastructure */}
      <Text style={styles.sectionHeader}>INFRASTRUCTURE</Text>
      <View style={styles.sectionGroup}>
        {renderMenuItem(
          'server',
          'Servers & VPS',
          'Manage cloud instances & baremetal machines',
          () => onNavigate('servers'),
        )}
        <View style={styles.divider} />
        {renderMenuItem(
          'globe',
          'Websites & Applications',
          'Monitored web apps and services',
          () => onNavigate('websites'),
        )}
        <View style={styles.divider} />
        {renderMenuItem(
          'cloud',
          'Provider Accounts',
          'Cloudflare, AWS, GoDaddy & Linode sync',
          () => onNavigate('providers'),
        )}
      </View>

      {/* Section: Tools */}
      <Text style={styles.sectionHeader}>TOOLS</Text>
      <View style={styles.sectionGroup}>
        {renderMenuItem(
          'search',
          'Domain Finder',
          'Check availability across 50+ TLDs',
          () => onNavigate('finder'),
        )}
      </View>

      {/* Section: System */}
      <Text style={styles.sectionHeader}>SYSTEM & CONFIG</Text>
      <View style={styles.sectionGroup}>
        {renderMenuItem(
          'settings',
          'App Settings',
          'API endpoint, push alerts & diagnostics',
          () => onNavigate('settings'),
        )}
        <View style={styles.divider} />
        {renderMenuItem(
          'refresh',
          'Remote Configuration',
          `Controlled via DomainPulse Admin Console (v${configVersion})`,
          () => {},
          { badge: `v${configVersion}` },
        )}
      </View>

      {/* Section: Session */}
      <Text style={styles.sectionHeader}>ACCOUNT</Text>
      <View style={styles.sectionGroup}>
        {renderMenuItem(
          'power',
          'Sign Out',
          'Disconnect this device from current workspace',
          onSignOut,
          { danger: true },
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.md,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 1,
    borderColor: colors.neonCyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.neonCyan,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  userEmail: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  wsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  wsText: {
    color: colors.neonGreen,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.semibold,
  },
  sectionHeader: {
    color: colors.textMuted,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
    marginBottom: spacing.xs,
    marginLeft: spacing.xs,
  },
  sectionGroup: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginLeft: 56,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  menuItemDanger: {
    backgroundColor: 'rgba(255, 77, 77, 0.03)',
  },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconCircleDanger: {
    backgroundColor: 'rgba(255, 77, 77, 0.08)',
  },
  menuTextCol: {
    flex: 1,
  },
  menuTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  menuTitleDanger: {
    color: colors.neonCoral,
  },
  menuSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  badgeContainer: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.xs,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  badgeText: {
    color: colors.neonCyan,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
  },
});
