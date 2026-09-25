import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing, typography } from '../../theme';
import { Icon, IconName } from '../../theme/icons';

export interface NeonInputProps extends TextInputProps {
  label?: string | undefined;
  icon?: IconName | undefined;
  error?: string | null | undefined;
  containerStyle?: StyleProp<ViewStyle> | undefined;
}

export const NeonInput = forwardRef<TextInput, NeonInputProps>(({
  label,
  icon,
  error,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...inputProps
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useImperativeHandle(ref, () => inputRef.current as TextInput);

  const handlePress = () => {
    inputRef.current?.focus();
  };

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        activeOpacity={1}
        onPress={handlePress}
        style={[
          styles.container,
          isFocused && styles.containerFocused,
          error ? styles.containerError : null,
        ]}
      >
        {icon ? (
          <View style={styles.iconWrapper} pointerEvents="none">
            <Icon
              name={icon}
              size={18}
              color={isFocused ? colors.neonCyan : colors.textMuted}
            />
          </View>
        ) : null}
        <TextInput
          ref={inputRef}
          style={[styles.input, style]}
          placeholderTextColor={colors.textDim}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          autoCorrect={false}
          {...inputProps}
        />
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
});

NeonInput.displayName = 'NeonInput';

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgInput,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  containerFocused: {
    borderColor: colors.neonCyan,
    shadowColor: colors.neonCyan,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 2,
  },
  containerError: {
    borderColor: colors.borderCritical,
  },
  iconWrapper: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    paddingVertical: spacing.sm + 2,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sizes.xs,
    marginTop: spacing.xs,
  },
});
