import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { Icon, IconName } from '../../theme/icons';

interface ActionConfig {
  key: string;
  label: string;
  icon: IconName;
  color: string;
}

interface Props {
  title?: string | undefined;
  onAction?: ((action: string) => void) | undefined;
}

export const QuickActionsSection: React.FC<Props> = ({
  title = 'Quick Actions',
  onAction,
}) => {
  const actions: ActionConfig[] = [
    { key: 'add-domain', label: 'Add Domain', icon: 'plus', color: colors.neonCyan },
    { key: 'domain-finder', label: 'Find Domain', icon: 'search', color: colors.neonGreen },
    { key: 'add-server', label: 'Add Server', icon: 'server', color: colors.sky },
    { key: 'scan-ssl', label: 'Scan SSL', icon: 'shield', color: colors.warning },
  ];

  return (
    <View style={styles.container}>
      {title ? <Text style={styles.sectionHeader}>{title}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        {actions.map((act) => (
          <TouchableOpacity
            key={act.key}
            style={styles.actionCard}
            onPress={() => onAction?.(act.key)}
            activeOpacity={0.75}
          >
            <View style={[styles.iconCircle, { borderColor: `${act.color}50` }]}>
              <Icon name={act.icon} size={20} color={act.color} />
            </View>
            <Text style={styles.actionLabel}>{act.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.sm,
  },
  sectionHeader: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  scrollContainer: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  actionCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    minWidth: 95,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 229, 255, 0.05)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  actionLabel: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    textAlign: 'center',
  },
});
