import React, { useRef, useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
type BottomTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];
import { useTheme } from '../../store/theme-context';

type IoniconName = keyof typeof Ionicons.glyphMap;

function getTabIconName(route: string, focused: boolean): IoniconName {
  switch (route) {
    case 'dashboard':
      return focused ? 'home' : 'home-outline';
    case 'domains':
      return focused ? 'planet' : 'planet-outline';
    case 'servers':
      return focused ? 'server' : 'server-outline';
    case 'applications':
      return focused ? 'grid' : 'grid-outline';
    case 'more':
      return focused ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline';
    default:
      return 'ellipse-outline';
  }
}

function getTabTitle(route: string): string {
  switch (route) {
    case 'dashboard':
      return 'Home';
    case 'domains':
      return 'Domains';
    case 'servers':
      return 'Servers';
    case 'applications':
      return 'Apps';
    case 'more':
      return 'More';
    default:
      return route;
  }
}

const HIDDEN_ROUTES = new Set(['alerts', '_sitemap', '+not-found']);

interface TabColorConfig {
  active: string;
  bgLight: string;
  borderLight: string;
  glowLight: string;
  bgDark: string;
  borderDark: string;
  glowDark: string;
}

const TAB_COLORS: Record<string, TabColorConfig> = {
  dashboard: {
    active: '#0284c7', // Sky blue
    bgLight: 'rgba(224, 242, 254, 0.95)',
    borderLight: 'rgba(56, 189, 248, 0.65)',
    glowLight: '#0284c7',
    bgDark: 'rgba(14, 165, 233, 0.25)',
    borderDark: 'rgba(56, 189, 248, 0.7)',
    glowDark: '#38bdf8',
  },
  domains: {
    active: '#8b5cf6', // Vivid violet
    bgLight: 'rgba(243, 232, 255, 0.95)',
    borderLight: 'rgba(168, 85, 247, 0.65)',
    glowLight: '#8b5cf6',
    bgDark: 'rgba(139, 92, 246, 0.25)',
    borderDark: 'rgba(168, 85, 247, 0.7)',
    glowDark: '#a855f7',
  },
  servers: {
    active: '#10b981', // Emerald green
    bgLight: 'rgba(209, 250, 229, 0.95)',
    borderLight: 'rgba(52, 211, 153, 0.65)',
    glowLight: '#10b981',
    bgDark: 'rgba(16, 185, 129, 0.25)',
    borderDark: 'rgba(52, 211, 153, 0.7)',
    glowDark: '#34d399',
  },
  applications: {
    active: '#f59e0b', // Amber / gold
    bgLight: 'rgba(254, 243, 199, 0.95)',
    borderLight: 'rgba(251, 191, 36, 0.65)',
    glowLight: '#f59e0b',
    bgDark: 'rgba(245, 158, 11, 0.25)',
    borderDark: 'rgba(251, 191, 36, 0.7)',
    glowDark: '#fbbf24',
  },
  more: {
    active: '#f43f5e', // Rose / coral
    bgLight: 'rgba(255, 228, 230, 0.95)',
    borderLight: 'rgba(251, 113, 133, 0.65)',
    glowLight: '#f43f5e',
    bgDark: 'rgba(244, 63, 94, 0.25)',
    borderDark: 'rgba(251, 113, 133, 0.7)',
    glowDark: '#fb7185',
  },
};

const DEFAULT_COLOR_CONFIG: TabColorConfig = {
  active: '#0284c7',
  bgLight: 'rgba(224, 242, 254, 0.95)',
  borderLight: 'rgba(56, 189, 248, 0.65)',
  glowLight: '#0284c7',
  bgDark: 'rgba(14, 165, 233, 0.25)',
  borderDark: 'rgba(56, 189, 248, 0.7)',
  glowDark: '#38bdf8',
};

function AnimatedTabButton({
  route,
  isFocused,
  onPress,
  onLongPress,
  isDark,
}: {
  route: { key: string; name: string };
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  isDark: boolean;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isFocused) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.15,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1.0,
          tension: 80,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isFocused, scaleAnim]);

  const colorConfig = TAB_COLORS[route.name] || DEFAULT_COLOR_CONFIG;
  const activeColor = colorConfig.active;
  const inactiveColor = isDark ? '#94a3b8' : '#475569';
  const iconColor = isFocused ? activeColor : inactiveColor;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      onPress={() => {
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 0.92,
            duration: 80,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1.0,
            tension: 80,
            friction: 6,
            useNativeDriver: true,
          }),
        ]).start();
        onPress();
      }}
      onLongPress={onLongPress}
      style={styles.tabButton}
      activeOpacity={0.7}
    >
      <Animated.View
        style={[
          styles.iconContainer,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Ionicons
          name={getTabIconName(route.name, isFocused)}
          size={22}
          color={iconColor}
        />
      </Animated.View>

      <Text
        style={[
          styles.tabLabel,
          {
            color: isFocused ? activeColor : inactiveColor,
            fontWeight: isFocused ? '800' : '600',
          },
        ]}
        numberOfLines={1}
      >
        {getTabTitle(route.name)}
      </Text>
    </TouchableOpacity>
  );
}

function CustomAnimatedTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState(0);

  // Exactly 5 main tabs
  const visibleRoutes = state.routes.filter((route) => {
    if (HIDDEN_ROUTES.has(route.name)) return false;
    const options = descriptors[route.key]?.options as { href?: string | null } | undefined;
    return options?.href !== null;
  });

  const activeRouteName = state.routes[state.index]?.name;
  const activeVisibleIndex = Math.max(
    0,
    visibleRoutes.findIndex((r) => r.name === activeRouteName)
  );

  const paddingH = 6;
  const availableWidth = containerWidth > 0 ? containerWidth - paddingH * 2 : 0;
  const tabWidth = visibleRoutes.length > 0 && availableWidth > 0
    ? availableWidth / visibleRoutes.length
    : 0;

  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (tabWidth > 0) {
      Animated.spring(translateX, {
        toValue: activeVisibleIndex * tabWidth,
        tension: 70,
        friction: 9,
        useNativeDriver: true,
      }).start();
    }
  }, [activeVisibleIndex, tabWidth, translateX]);

  const isAndroid = Platform.OS === 'android';
  const bottomMargin = Math.max(insets.bottom, 0) + (isAndroid ? 6 : 4);

  const activeColorConfig = TAB_COLORS[activeRouteName || 'dashboard'] || DEFAULT_COLOR_CONFIG;
  const activeBg = isDark ? activeColorConfig.bgDark : activeColorConfig.bgLight;
  const activeBorder = isDark ? activeColorConfig.borderDark : activeColorConfig.borderLight;
  const activeGlow = isDark ? activeColorConfig.glowDark : activeColorConfig.glowLight;

  return (
    <>
      {/* Bottom Guard to hide scrolling text below the dock */}
      <View
        pointerEvents="none"
        style={[
          styles.bottomGuard,
          {
            height: insets.bottom + (isAndroid ? 10 : 8),
            backgroundColor: isDark ? '#0b132b' : '#f8fafc',
          },
        ]}
      />

      {/* Floating Navigation Dock */}
      <View
        style={[
          styles.floatingDock,
          {
            bottom: bottomMargin,
            backgroundColor: isDark ? '#0f172a' : '#ffffff',
            borderColor: isDark ? '#1e293b' : '#e2e8f0',
          },
        ]}
        onLayout={(e: LayoutChangeEvent) => {
          setContainerWidth(e.nativeEvent.layout.width);
        }}
      >
        {/* Floating Active Squircle Glow Pill with Dynamic Tab Color */}
        {tabWidth > 0 && (
          <Animated.View
            style={[
              styles.activeIndicatorPill,
              {
                width: tabWidth - 8,
                transform: [{ translateX }],
                backgroundColor: activeBg,
                borderColor: activeBorder,
                shadowColor: activeGlow,
              },
            ]}
          />
        )}

        {/* Tabs Row */}
        <View style={styles.tabsRow}>
          {visibleRoutes.map((route) => {
            const isFocused = route.name === activeRouteName;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <AnimatedTabButton
                key={route.key}
                route={route}
                isFocused={isFocused}
                onPress={onPress}
                onLongPress={onLongPress}
                isDark={isDark}
              />
            );
          })}
        </View>
      </View>
    </>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomAnimatedTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="domains"
        options={{
          title: 'Domains',
        }}
      />
      <Tabs.Screen
        name="servers"
        options={{
          title: 'Servers',
        }}
      />
      <Tabs.Screen
        name="applications"
        options={{
          title: 'Apps',
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bottomGuard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99,
  },
  floatingDock: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 64,
    borderRadius: 24,
    borderWidth: 1.2,
    paddingHorizontal: 6,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 20,
    zIndex: 100,
  },
  activeIndicatorPill: {
    position: 'absolute',
    top: 6,
    left: 10,
    height: 50,
    borderRadius: 16,
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 4,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    zIndex: 2,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 24,
  },
  tabLabel: {
    fontSize: 10.5,
    marginTop: 2,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
});
