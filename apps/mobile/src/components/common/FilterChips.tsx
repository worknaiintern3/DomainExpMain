import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';

interface FilterChipsProps {
  options: string[];
  selected: string;
  onSelect: (option: string) => void;
}

export const FilterChips: React.FC<FilterChipsProps> = ({
  options,
  selected,
  onSelect,
}) => {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {options.map((opt) => {
          const isSelected = selected.toLowerCase() === opt.toLowerCase();
          return (
            <TouchableOpacity
              key={opt}
              style={[
                styles.chip,
                isSelected ? styles.chipSelected : styles.chipUnselected,
              ]}
              onPress={() => onSelect(opt)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected ? styles.chipTextSelected : styles.chipTextUnselected,
                ]}
              >
                {opt}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: spacing.sm,
  },
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  chipSelected: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderColor: colors.neonCyan,
  },
  chipUnselected: {
    backgroundColor: colors.bgSurface,
    borderColor: colors.borderSubtle,
  },
  chipText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  chipTextSelected: {
    color: colors.neonCyan,
    fontWeight: typography.weights.bold,
  },
  chipTextUnselected: {
    color: colors.textSecondary,
  },
});
