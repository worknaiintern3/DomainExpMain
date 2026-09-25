import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface SplashScreenProps {
  appName?: string | undefined;
  statusText?: string | undefined;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  statusText,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const progressAnim = useRef(new Animated.Value(0.2)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    // 1. Fade in & scale entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Smooth progress bar animation
    Animated.timing(progressAnim, {
      toValue: 0.85,
      duration: 2200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // 3. Subtle breathing glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0.4,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [fadeAnim, scaleAnim, progressAnim, glowAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#010C0F" />

      {/* Top Ambient Glow Effect */}
      <View style={styles.topAurora} pointerEvents="none" />

      <SafeAreaView style={styles.safeArea}>
        {/* Top Right Monospace Header */}
        <View style={styles.topHeader}>
          <Text style={styles.poweringText}>POWERING</Text>
          <Text style={styles.poweringText}>A CONNECTED</Text>
          <Text style={styles.poweringText}>INTERNET</Text>
          <View style={styles.topAccentLine} />
        </View>

        {/* Center Brand Identity */}
        <Animated.View
          style={[
            styles.centerSection,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Logo with Dynamic Neon Glow */}
          <View style={styles.logoWrapper}>
            <Animated.View style={[styles.glowHalo, { opacity: glowAnim }]} />
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* Typography: Domain in Pure White, Pulse in Emerald-Cyan */}
          <Text style={styles.brandTitle}>
            Domain<Text style={styles.brandTitlePulse}>Pulse</Text>
          </Text>

          {/* Slogan */}
          <Text style={styles.tagline}>YOUR DOMAINS. ALWAYS AHEAD.</Text>

          {/* Loading Progress Bar */}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressBar,
                { width: progressWidth },
              ]}
            />
          </View>

          {/* Core Value Pillars: MONITOR • MANAGE • GROW */}
          <View style={styles.pillarsRow}>
            <Text style={styles.pillarText}>MONITOR</Text>
            <View style={styles.pillarDot} />
            <Text style={styles.pillarText}>MANAGE</Text>
            <View style={styles.pillarDot} />
            <Text style={styles.pillarText}>GROW</Text>
          </View>

          {statusText ? (
            <Text style={styles.statusNotice}>{statusText}</Text>
          ) : null}
        </Animated.View>

        {/* Bottom Slogan over Earth */}
        <View style={styles.bottomContainer}>
          <Text style={styles.bottomSlogan}>A SMARTER INTERNET FOR YOU</Text>
          <View style={styles.bottomAccentLine} />
        </View>
      </SafeAreaView>

      {/* Bottom Earth Interconnected Network Graphic */}
      <View style={styles.earthWrapper} pointerEvents="none">
        <Image
          source={require('../../assets/splash_earth_bg.png')}
          style={styles.earthImage}
          resizeMode="cover"
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010C0F',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'space-between',
    zIndex: 2,
  },
  topAurora: {
    position: 'absolute',
    top: -60,
    left: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
    transform: [{ scaleX: 1.5 }],
    zIndex: 1,
  },
  topHeader: {
    alignSelf: 'flex-end',
    paddingRight: 28,
    paddingTop: 16,
    alignItems: 'flex-start',
  },
  poweringText: {
    color: '#94A3B8',
    fontSize: 8.5,
    fontWeight: '600',
    letterSpacing: 1.8,
    lineHeight: 13,
  },
  topAccentLine: {
    width: 26,
    height: 2,
    backgroundColor: '#00E676',
    borderRadius: 1,
    marginTop: 5,
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    marginTop: -20,
  },
  logoWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  glowHalo: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 36,
    backgroundColor: 'rgba(0, 245, 200, 0.25)',
    shadowColor: '#00F5C8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 28,
  },
  logoImage: {
    width: 108,
    height: 108,
    borderRadius: 28,
  },
  brandTitle: {
    color: '#F8FAFC',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  brandTitlePulse: {
    color: '#00F5C8',
  },
  tagline: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2.6,
    marginTop: 8,
    textAlign: 'center',
  },
  progressTrack: {
    width: 140,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: '#072620',
    marginTop: 34,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2.5,
    backgroundColor: '#00F5C8',
    shadowColor: '#00F5C8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 4,
  },
  pillarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
  },
  pillarText: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 2.4,
  },
  pillarDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#00E676',
  },
  statusNotice: {
    color: '#475569',
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 12,
  },
  bottomContainer: {
    alignItems: 'center',
    paddingBottom: 22,
    zIndex: 5,
  },
  bottomSlogan: {
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 2.4,
  },
  bottomAccentLine: {
    width: 28,
    height: 2,
    backgroundColor: '#00E676',
    borderRadius: 1,
    marginTop: 6,
  },
  earthWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_WIDTH * 0.78,
    zIndex: 1,
    overflow: 'hidden',
  },
  earthImage: {
    width: '100%',
    height: '100%',
  },
});
