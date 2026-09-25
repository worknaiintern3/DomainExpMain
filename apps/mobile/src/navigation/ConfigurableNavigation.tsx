import React from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { MobileNavigationItem } from '@domainpulse/contracts';
import { colors, radius, spacing, typography } from '../theme';
import { Icon } from '../theme/icons';

interface Props {
  items: MobileNavigationItem[];
  currentTab: string;
  onSelectTab: (key: string) => void;
  onOpenQuickActions?: (() => void) | undefined;
  primaryColor?: string | undefined;
}

export const ConfigurableNavigation: React.FC<Props> = ({
  items,
  currentTab,
  onSelectTab,
  onOpenQuickActions,
  primaryColor = colors.neonCyan,
}) => {
  const activeTabs = [...items]
    .filter((t) => t.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Split tabs for left and right of the elevated center '+' button
  const midpoint = Math.ceil(activeTabs.length / 2);
  const leftTabs = activeTabs.slice(0, midpoint);
  const rightTabs = activeTabs.slice(midpoint);

  const renderTabButton = (tab: MobileNavigationItem) => {
    const isSelected = currentTab === tab.key;
    return (
      <TouchableOpacity
        key={tab.key}
        style={styles.tabButton}
        onPress={() => onSelectTab(tab.key)}
        activeOpacity={0.7}
        accessibilityRole="tab"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={tab.label}
      >
        <View style={styles.iconContainer}>
          <Icon
            name={tab.icon || tab.key}
            size={22}
            color={isSelected ? primaryColor : colors.textMuted}
            strokeWidth={isSelected ? 2.5 : 1.8}
          />
          {tab.badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{tab.badge}</Text>
            </View>
          ) : null}
        </View>
        <Text
          style={[
            styles.tabLabel,
            isSelected ? { color: primaryColor, fontWeight: '700' } : styles.unselectedLabel,
          ]}
          numberOfLines={1}
        >
          {tab.label}
        </Text>
        {isSelected ? <View style={[styles.activeIndicator, { backgroundColor: primaryColor }]} /> : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.tabBar}>
        {/* Left tabs */}
        <View style={styles.tabGroup}>{leftTabs.map(renderTabButton)}</View>

        {/* Central Elevated Floating Action Button */}
        {onOpenQuickActions ? (
          <View style={styles.centerFabAnchor}>
            <TouchableOpacity
              style={[styles.centerFab, { backgroundColor: primaryColor }]}
              onPress={onOpenQuickActions}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Quick Actions"
            >
              <Icon name="plus" size={26} color="#020B10" strokeWidth={2.8} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Right tabs */}
        <View style={styles.tabGroup}>{rightTabs.map(renderTabButton)}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'transparent',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bgSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 8,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    position: 'relative',
  },
  tabGroup: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    height: 26,
  },
  tabLabel: {
    fontSize: typography.sizes.tiny,
    marginTop: 3,
    letterSpacing: 0.2,
  },
  unselectedLabel: {
    color: colors.textSecondary,
    fontWeight: '400',
  },
  activeIndicator: {
    width: 14,
    height: 2,
    borderRadius: 1,
    marginTop: 3,
    shadowColor: colors.neonCyan,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: colors.danger,
    borderRadius: radius.full,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: colors.bgSecondary,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  centerFabAnchor: {
    top: -18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    zIndex: 10,
  },
  centerFab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.bgSecondary,
    shadowColor: colors.neonCyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
});
