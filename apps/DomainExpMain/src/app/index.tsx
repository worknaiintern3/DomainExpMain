import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../store/theme-context';
import { useAuth } from '../store/auth-context';
import { Spacing, Typography } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  const hasNavigated = useRef(false);

  const handleContinue = () => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;
    router.replace('/(tabs)/dashboard');
  };

  useEffect(() => {
    // Smooth entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      handleContinue();
    }, 1400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ImageBackground
      source={require('../../assets/images/splash-bg.png')}
      style={styles.backgroundImage}
      imageStyle={styles.bgImageStyle}
      resizeMode="cover"
    >
      <TouchableOpacity
        style={[
          styles.container,
          {
            paddingTop: Math.max(insets.top + 12, 28),
            paddingBottom: insets.bottom + 20,
          },
        ]}
        onPress={handleContinue}
        activeOpacity={0.95}
      >
        {/* Center Brand & Tagline Section */}
        <Animated.View
          style={[
            styles.brandSection,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />

          <Text style={styles.brandTitle}>DomainPulse</Text>
        </Animated.View>
      </TouchableOpacity>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  bgImageStyle: {
    height: '110%',
    top: 0,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  brandSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  brandTitle: {
    ...Typography.titleLarge,
    fontSize: 34,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.8,
    marginBottom: 10,
  },
});
