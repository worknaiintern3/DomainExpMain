import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/auth-context';
import { Spacing } from '../constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const INFRA_PILLARS = [
  {
    id: 'domains',
    label: 'Domains',
    metric: 'DNS & Expiry Live',
    icon: 'globe-outline' as const,
    color: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.25)',
  },
  {
    id: 'servers',
    label: 'Cloud Servers',
    metric: 'VPS & Nodes Active',
    icon: 'server-outline' as const,
    color: '#c084fc',
    glowColor: 'rgba(192, 132, 252, 0.25)',
  },
  {
    id: 'websites',
    label: 'Websites & SSL',
    metric: 'HTTPS Health 100%',
    icon: 'shield-checkmark-outline' as const,
    color: '#34d399',
    glowColor: 'rgba(52, 211, 153, 0.25)',
  },
  {
    id: 'apps',
    label: 'Mobile Apps',
    metric: 'Play Store Synced',
    icon: 'logo-google-playstore' as const,
    color: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.25)',
  },
];

const SCAN_MESSAGES = [
  'Auditing Domains & DNS Health...',
  'Checking Cloud Server VPS Telemetry...',
  'Validating SSL Certificates...',
  'Synchronizing App Console Deployments...',
  'All 4 Infrastructure Stacks Online.',
];

export default function SplashScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading, user } = useAuth();

  // Animation controllers
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pulseRing = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const statusOpacity = useRef(new Animated.Value(1)).current;
  const exitFade = useRef(new Animated.Value(1)).current;

  // Staggered card animations
  const cardAnim1 = useRef(new Animated.Value(0)).current;
  const cardAnim2 = useRef(new Animated.Value(0)).current;
  const cardAnim3 = useRef(new Animated.Value(0)).current;
  const cardAnim4 = useRef(new Animated.Value(0)).current;

  const [scanMessageIndex, setScanMessageIndex] = useState(0);
  const [percentDisplay, setPercentDisplay] = useState(0);
  const hasNavigated = useRef(false);
  const [minTimePassed, setMinTimePassed] = useState(false);

  const navigateToDestination = (isAuth: boolean) => {
    if (hasNavigated.current) return;
    hasNavigated.current = true;

    Animated.timing(exitFade, {
      toValue: 0,
      duration: 350,
      useNativeDriver: true,
    }).start(() => {
      if (isAuth) {
        router.replace('/(tabs)/dashboard');
      } else {
        router.replace('/(auth)/login');
      }
    });
  };

  const handleContinue = () => {
    if (hasNavigated.current) return;
    if (!isLoading) {
      navigateToDestination(isAuthenticated && Boolean(user));
    } else {
      setMinTimePassed(true);
    }
  };

  useEffect(() => {
    // 1. Hero Entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();

    // 2. Pulse Ring Loop
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseRing, {
          toValue: 1.3,
          duration: 1700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseRing, {
          toValue: 1,
          duration: 1700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    // 3. Staggered Infrastructure Pillars Slide-Up
    Animated.stagger(120, [
      Animated.spring(cardAnim1, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      Animated.spring(cardAnim2, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      Animated.spring(cardAnim3, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
      Animated.spring(cardAnim4, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
    ]).start();

    // 4. Progress Bar Animation
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    const progressListener = progressAnim.addListener(({ value }) => {
      setPercentDisplay(Math.round(value * 100));
    });

    // 5. Message Tickers
    const t1 = setTimeout(() => {
      Animated.sequence([
        Animated.timing(statusOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(statusOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      setScanMessageIndex(1);
    }, 450);

    const t2 = setTimeout(() => {
      Animated.sequence([
        Animated.timing(statusOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(statusOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      setScanMessageIndex(2);
    }, 950);

    const t3 = setTimeout(() => {
      Animated.sequence([
        Animated.timing(statusOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(statusOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      setScanMessageIndex(3);
    }, 1450);

    const t4 = setTimeout(() => {
      setScanMessageIndex(4);
    }, 1850);

    // 6. Navigation minimum timer (2.1s for rich visual immersion)
    const completionTimer = setTimeout(() => {
      setMinTimePassed(true);
    }, 2100);

    return () => {
      pulseLoop.stop();
      progressAnim.removeListener(progressListener);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(completionTimer);
    };
  }, []);

  useEffect(() => {
    if (minTimePassed && !isLoading) {
      navigateToDestination(isAuthenticated && Boolean(user));
    }
  }, [minTimePassed, isLoading, isAuthenticated, user]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const cardAnims = [cardAnim1, cardAnim2, cardAnim3, cardAnim4];

  return (
    <ImageBackground
      source={require('../../assets/images/splash-bg.png')}
      style={styles.backgroundImage}
      imageStyle={styles.bgImageStyle}
      resizeMode="cover"
    >
      {/* Dark Vignette to let UI elements pop with high contrast */}
      <View style={styles.vignetteOverlay} />

      <TouchableOpacity
        style={[
          styles.container,
          {
            paddingTop: Math.max(insets.top + 16, 36),
            paddingBottom: Math.max(insets.bottom + 16, 32),
          },
        ]}
        onPress={handleContinue}
        activeOpacity={0.98}
      >
        <Animated.View style={[styles.mainWrapper, { opacity: exitFade }]}>
          {/* Top Live Infrastructure Telemetry Capsule */}
          <Animated.View
            style={[
              styles.topCapsule,
              {
                opacity: fadeAnim,
                transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
              },
            ]}
          >
            <View style={styles.livePulseDot} />
            <Text style={styles.topCapsuleText}>INFRASTRUCTURE TELEMETRY • LIVE</Text>
          </Animated.View>

          {/* Central Hero: DomainPulse Hub */}
          <View style={styles.centerHero}>
            {/* Animated Glow Radar Ring */}
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  transform: [{ scale: pulseRing }],
                  opacity: pulseRing.interpolate({ inputRange: [1, 1.3], outputRange: [0.55, 0.1] }),
                },
              ]}
            />

            {/* Glassmorphic Logo Card */}
            <Animated.View
              style={[
                styles.logoCard,
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
            </Animated.View>

            {/* Typography */}
            <Animated.View style={[styles.brandInfo, { opacity: fadeAnim }]}>
              <View style={styles.titleRow}>
                <Text style={styles.brandTitleMain}>Domain</Text>
                <Text style={styles.brandTitleAccent}>Pulse</Text>
                <View style={styles.onlineBadgeDot} />
              </View>

              <View style={styles.subPill}>
                <Text style={styles.subPillText}>DOMAINS • SERVERS • WEBSITES • APPS</Text>
              </View>
            </Animated.View>
          </View>

          {/* Four Infrastructure Pillars Grid (Domains, Servers, Websites, Apps) */}
          <View style={styles.pillarsContainer}>
            <View style={styles.pillarsGrid}>
              {INFRA_PILLARS.map((p, idx) => {
                const anim = cardAnims[idx];
                const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });
                const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

                return (
                  <Animated.View
                    key={p.id}
                    style={[
                      styles.pillarCard,
                      {
                        borderColor: p.glowColor,
                        transform: [{ translateY }],
                        opacity,
                      },
                    ]}
                  >
                    <View style={styles.pillarCardHeader}>
                      <View style={[styles.pillarIconCircle, { backgroundColor: p.glowColor }]}>
                        <Ionicons name={p.icon} size={15} color={p.color} />
                      </View>
                      <View style={styles.pillarStatusPip} />
                    </View>

                    <Text style={[styles.pillarTitle, { color: p.color }]}>{p.label}</Text>
                    <Text style={styles.pillarMetric} numberOfLines={1}>
                      {p.metric}
                    </Text>
                  </Animated.View>
                );
              })}
            </View>
          </View>

          {/* Bottom Telemetry Loading & Security */}
          <Animated.View style={[styles.bottomSection, { opacity: fadeAnim }]}>
            {/* Live Status Scanner Ticker */}
            <View style={styles.tickerHeader}>
              <View style={styles.tickerLeft}>
                <Ionicons name="radio-outline" size={13} color="#38bdf8" style={{ marginRight: 6 }} />
                <Animated.Text style={[styles.statusTickerText, { opacity: statusOpacity }]} numberOfLines={1}>
                  {SCAN_MESSAGES[scanMessageIndex]}
                </Animated.Text>
              </View>
              <Text style={styles.percentText}>{percentDisplay}%</Text>
            </View>

            {/* Glowing Tech Progress Bar */}
            <View style={styles.progressBarTrack}>
              <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
            </View>

            {/* Bottom Security Footer */}
            <View style={styles.securityBadge}>
              <Ionicons name="shield-checkmark" size={13} color="#10b981" />
              <Text style={styles.securityText}>Multi-Cloud Monitoring • 256-Bit SSL</Text>
              <Text style={styles.versionText}>v1.0.0</Text>
            </View>
          </Animated.View>
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
    backgroundColor: '#020617',
  },
  bgImageStyle: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  vignetteOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2, 6, 23, 0.52)',
  },
  container: {
    flex: 1,
  },
  mainWrapper: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  // Top Live Capsule
  topCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.28)',
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    marginRight: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 4,
  },
  topCapsuleText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 1.2,
  },
  // Center Hero
  centerHero: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: -8,
  },
  pulseRing: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.45)',
    backgroundColor: 'rgba(56, 189, 248, 0.06)',
  },
  logoCard: {
    width: 110,
    height: 110,
    borderRadius: 28,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 16,
  },
  logoImage: {
    width: 98,
    height: 98,
    borderRadius: 22,
  },
  brandInfo: {
    alignItems: 'center',
    marginTop: 18,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  brandTitleMain: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.6,
  },
  brandTitleAccent: {
    fontSize: 32,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: -0.6,
    textShadowColor: 'rgba(56, 189, 248, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  onlineBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38bdf8',
    marginLeft: 4,
    marginBottom: 14,
  },
  subPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.22)',
  },
  subPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7dd3fc',
    letterSpacing: 0.8,
  },
  // Four Infrastructure Pillars Grid
  pillarsContainer: {
    width: '100%',
    maxWidth: 380,
    paddingHorizontal: 4,
    marginTop: 4,
  },
  pillarsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  pillarCard: {
    width: '48%',
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    borderWidth: 1.2,
    backdropFilter: 'blur(12px)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  pillarCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pillarIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillarStatusPip: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  pillarTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  pillarMetric: {
    fontSize: 10,
    fontWeight: '500',
    color: '#94a3b8',
    letterSpacing: 0.1,
  },
  // Bottom Progress & Security
  bottomSection: {
    width: '100%',
    maxWidth: 380,
    paddingHorizontal: 4,
  },
  tickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  statusTickerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.2,
    flex: 1,
  },
  percentText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#38bdf8',
    fontVariant: ['tabular-nums'],
  },
  progressBarTrack: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#38bdf8',
    borderRadius: 4,
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 3,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  securityText: {
    fontSize: 10.5,
    fontWeight: '500',
    color: '#64748b',
    letterSpacing: 0.2,
  },
  versionText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    marginLeft: 4,
  },
});
