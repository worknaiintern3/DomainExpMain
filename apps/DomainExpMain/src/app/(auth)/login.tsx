import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ImageBackground,
  Dimensions,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../store/auth-context';
import { useTheme } from '../../store/theme-context';
import { Spacing } from '../../constants/theme';
import { BrandLogo } from '../../components/ui/BrandLogo';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, isLoading } = useAuth();

  const scrollViewRef = useRef<ScrollView>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!EMAIL_REGEX.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email address with @ and domain (e.g. name@domain.com).');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }
    setErrorMessage(null);
    try {
      await login({ email: cleanEmail, password });
      router.replace('/(tabs)/dashboard');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Login failed. Please verify credentials.');
    }
  };

  return (
    <ImageBackground
      source={require('../../../assets/images/auth-bg.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top + 4, 16),
              paddingBottom: keyboardHeight > 0 ? keyboardHeight + 20 : Math.max(insets.bottom + 16, 28),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Brand Logo - positioned above the globe */}
          <View style={styles.topLogoSection}>
            <View style={styles.logoHalo}>
              <BrandLogo size={44} />
            </View>
          </View>

          {/* Heading - spaced below the globe */}
          <View style={styles.header}>
            <Text style={styles.title}>Sign in to DomainPulse</Text>
            <Text style={styles.subtitle}>
              Unified domain & infrastructure management
            </Text>
          </View>

          {/* Form Content */}
          <View style={styles.formContainer}>
            {errorMessage && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
              </View>
            )}

            {/* Email Address */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <View style={styles.inputRow}>
                <Text style={styles.inputPrefixIcon}>✉️</Text>
                <TextInput
                  style={styles.input}
                  placeholder="name@domain.com"
                  placeholderTextColor="#94a3b8"
                  selectionColor="#0284c7"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollViewRef.current?.scrollTo({ y: 140, animated: true });
                    }, 120);
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>PASSWORD</Text>
              <View style={styles.inputRow}>
                <Text style={styles.inputPrefixIcon}>🔒</Text>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="••••••••••••"
                  placeholderTextColor="#94a3b8"
                  selectionColor="#0284c7"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  onFocus={() => {
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 120);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeToggleBtn}
                  onPress={() => setShowPassword((prev) => !prev)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={styles.eyeToggleText}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Primary Action Button */}
            <TouchableOpacity
              style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In  →</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.linkText}>Create Account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
    minHeight: SCREEN_HEIGHT,
    backgroundColor: '#bde4fe',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  topLogoSection: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 0,
  },
  logoHalo: {
    padding: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    shadowColor: '#1877F2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  header: {
    alignItems: 'center',
    marginTop: 110,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
  },
  formContainer: {
    width: '100%',
    gap: 14,
  },
  errorBanner: {
    padding: Spacing.md,
    borderRadius: 14,
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e11d48',
  },
  inputGroup: {
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingLeft: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderRadius: 15,
    borderWidth: 1.2,
    borderColor: 'rgba(219, 234, 254, 0.95)',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  inputPrefixIcon: {
    fontSize: 16,
    marginRight: 10,
    opacity: 0.85,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    padding: 0,
    margin: 0,
  },
  passwordInput: {
    flex: 1,
    height: 50,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
    padding: 0,
    margin: 0,
  },
  eyeToggleBtn: {
    paddingLeft: 8,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeToggleText: {
    fontSize: 18,
    opacity: 0.8,
  },
  primaryButton: {
    height: 50,
    borderRadius: 15,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  footerText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  linkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0284c7',
  },
});
