import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '../../theme';

interface LoadingSkeletonProps {
  width?: number | string | undefined;
  height?: number | undefined;
  borderRadius?: number | undefined;
  style?: StyleProp<ViewStyle> | undefined;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = radius.md,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    return () => {
      pulse.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width: width as any,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

export const CardSkeletonList: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: count }).map((_, idx) => (
        <View key={idx} style={styles.cardSkeleton}>
          <View style={styles.headerRow}>
            <LoadingSkeleton width={36} height={36} borderRadius={radius.sm} />
            <View style={styles.headerTextCol}>
              <LoadingSkeleton width="60%" height={16} />
              <LoadingSkeleton width="40%" height={12} style={{ marginTop: 6 }} />
            </View>
          </View>
          <View style={styles.footerRow}>
            <LoadingSkeleton width="30%" height={22} borderRadius={radius.full} />
            <LoadingSkeleton width="25%" height={14} />
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.bgCardElevated,
  },
  listContainer: {
    gap: spacing.md,
    padding: spacing.md,
  },
  cardSkeleton: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerTextCol: {
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
});
