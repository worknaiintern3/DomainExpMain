import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../auth/auth.context';
import { NeonButton, NeonInput } from '../components/common';
import { colors, radius, spacing, typography } from '../theme';
import { Icon } from '../theme/icons';

interface LoginScreenProps {
  onSuccess?: (() => void) | undefined;
  onSkip?: (() => void) | undefined;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onSuccess,
  onSkip,
}) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await login(email.trim(), password);
      onSuccess?.();
    } catch (err: any) {
      setError(err?.message || 'Invalid credentials or server connection failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo and Brand Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.brandTitle}>DomainPulse</Text>
          <Text style={styles.brandTagline}>INFRASTRUCTURE INTELLIGENCE</Text>
        </View>

        {/* Welcome Text */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome Back</Text>
          <Text style={styles.welcomeSubtitle}>
            Sign in to manage your domains, servers, and uptime alerts
          </Text>
        </View>

        {/* Form Inputs */}
        <View style={styles.formCard}>
          <NeonInput
            label="Email Address"
            placeholder="admin@domainpulse.dev"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            icon="user"
          />

          <NeonInput
            label="Password"
            placeholder="••••••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            icon="lock"
          />

          <TouchableOpacity style={styles.forgotBtn} activeOpacity={0.7}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <NeonButton
            title="Sign In"
            onPress={handleSignIn}
            variant="primary"
            size="lg"
            icon="arrow-right"
            loading={loading}
            style={styles.signInBtn}
          />

          {/* Social or SSO Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google SSO Button */}
          <TouchableOpacity style={styles.ssoBtn} activeOpacity={0.8}>
            <Icon name="globe" size={18} color={colors.textPrimary} />
            <Text style={styles.ssoText}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Quick Preview / Skip CTA */}
          {onSkip ? (
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={onSkip}
              activeOpacity={0.75}
            >
              <Text style={styles.skipText}>
                Preview Dashboard as Guest →
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <TouchableOpacity activeOpacity={0.7}>
            <Text style={styles.signUpText}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.neonCyan,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    shadowColor: colors.neonCyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  logoImage: {
    width: 68,
    height: 68,
    borderRadius: radius.xl,
  },
  brandTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  brandTagline: {
    color: colors.neonCyan,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.semibold,
    letterSpacing: 2,
    marginTop: 2,
  },
  welcomeSection: {
    marginBottom: spacing.lg,
  },
  welcomeTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
  },
  welcomeSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  forgotText: {
    color: colors.neonCyan,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sizes.xs,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  signInBtn: {
    marginTop: spacing.xs,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderSubtle,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: typography.sizes.xs,
    paddingHorizontal: spacing.sm,
    fontWeight: typography.weights.semibold,
  },
  ssoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgSurface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.borderNormal,
    gap: spacing.sm,
  },
  ssoText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  skipBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  skipText: {
    color: colors.neonGreen,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    gap: spacing.xs,
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
  },
  signUpText: {
    color: colors.neonCyan,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
});
