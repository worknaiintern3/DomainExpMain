import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../store/theme-context';
import { markAppTourCompleted } from '../services/appTour';

const { width } = Dimensions.get('window');

interface TourStep {
  id: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  route: string;
  routeLabel: string;
  routeIcon: keyof typeof Ionicons.glyphMap;
  highlights: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    description: string;
  }>;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    badge: 'Quick Overview',
    badgeColor: '#0284c7',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    icon: 'rocket-outline',
    iconBg: 'rgba(56, 189, 248, 0.15)',
    iconColor: '#38bdf8',
    title: 'Welcome to DomainExpert',
    subtitle: 'Your unified command center for domain portfolios, cloud servers, and infrastructure telemetry.',
    route: '/(tabs)/dashboard',
    routeLabel: 'Open Home Dashboard',
    routeIcon: 'home',
    highlights: [
      {
        icon: 'speedometer-outline',
        title: 'Live System Health',
        description: 'Instant status pill showing synchronized infrastructure nodes and critical warnings.',
      },
      {
        icon: 'globe-outline',
        title: 'Unified Domain Watch',
        description: 'Live expiration countdowns, nameservers, and SSL certificate validity.',
      },
      {
        icon: 'server-outline',
        title: 'Cloud Node Monitoring',
        description: 'Real-time telemetry and uptime indicators across VPS and cloud hosts.',
      },
    ],
  },
  {
    id: 'domains',
    badge: 'Domains Tab',
    badgeColor: '#10b981',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    icon: 'globe',
    iconBg: 'rgba(16, 185, 129, 0.15)',
    iconColor: '#10b981',
    title: 'Domain Portfolio Management',
    subtitle: 'Never lose a valuable domain name or let an SSL certificate lapse unexpectedly.',
    route: '/(tabs)/domains',
    routeLabel: 'Open Domains Screen',
    routeIcon: 'globe',
    highlights: [
      {
        icon: 'time-outline',
        title: 'Countdown Badges',
        description: 'Color-coded badges alert you at 30, 14, 7, and 1 day before expiration.',
      },
      {
        icon: 'shield-checkmark-outline',
        title: 'SSL Expiry Protection',
        description: 'Automated HTTPS security checks with direct renewal reminders.',
      },
      {
        icon: 'search-outline',
        title: 'Live WHOIS & DNS',
        description: 'Instant lookup of registrars, nameserver records, and registry status.',
      },
    ],
  },
  {
    id: 'servers',
    badge: 'Servers Tab',
    badgeColor: '#8b5cf6',
    badgeBg: 'rgba(139, 92, 246, 0.15)',
    icon: 'server',
    iconBg: 'rgba(139, 92, 246, 0.15)',
    iconColor: '#8b5cf6',
    title: 'Server & Node Telemetry',
    subtitle: 'Monitor all your Linux VPS, cloud nodes, and web applications in real time.',
    route: '/(tabs)/servers',
    routeLabel: 'Open Servers Screen',
    routeIcon: 'server',
    highlights: [
      {
        icon: 'pulse-outline',
        title: 'ONLINE / DEGRADED Badges',
        description: 'Visual health indicators detect server downtime and offline states.',
      },
      {
        icon: 'hardware-chip-outline',
        title: 'Resource Telemetry',
        description: 'View IP addresses, cloud providers, and operational node status.',
      },
      {
        icon: 'terminal-outline',
        title: 'Quick Connect Commands',
        description: 'Copy SSH connection strings and ping endpoints in one tap.',
      },
    ],
  },
  {
    id: 'providers',
    badge: 'Quick Connect',
    badgeColor: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    icon: 'link-outline',
    iconBg: 'rgba(245, 158, 11, 0.15)',
    iconColor: '#f59e0b',
    title: 'Connect Registrars & Cloud',
    subtitle: 'Sync your entire portfolio automatically with direct read-only API integrations.',
    route: '/(tabs)/more?modal=providers',
    routeLabel: 'Open Provider Connections',
    routeIcon: 'link',
    highlights: [
      {
        icon: 'cloud-done-outline',
        title: 'Supported Registrars',
        description: 'Connect Cloudflare, GoDaddy, AWS Route 53, Namecheap, and Hetzner.',
      },
      {
        icon: 'sync-outline',
        title: 'Auto Background Sync',
        description: 'Your assets stay up to date without manual spreadsheet tracking.',
      },
      {
        icon: 'lock-closed-outline',
        title: 'Secure Credential Storage',
        description: 'All API keys are encrypted with hardware-backed encryption.',
      },
    ],
  },
  {
    id: 'alerts',
    badge: 'Alerts & Tools',
    badgeColor: '#ef4444',
    badgeBg: 'rgba(239, 68, 68, 0.15)',
    icon: 'notifications',
    iconBg: 'rgba(239, 68, 68, 0.15)',
    iconColor: '#ef4444',
    title: 'Instant Alerts & AI Finder',
    subtitle: 'Stay ahead of critical renewals and discover high-value domain opportunities.',
    route: '/alerts',
    routeLabel: 'Open Alerts Center',
    routeIcon: 'notifications',
    highlights: [
      {
        icon: 'notifications-outline',
        title: 'Push Expiry Notifications',
        description: 'High-priority device alerts notify you before domains expire.',
      },
      {
        icon: 'sparkles-outline',
        title: 'AI Domain Discovery',
        description: 'Generate brandable names and check real-time TLD availability.',
      },
      {
        icon: 'compass-outline',
        title: 'Replay Tour Anytime',
        description: 'Access this feature guide anytime from the "More" settings tab.',
      },
    ],
  },
];

interface AppTourModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AppTourModal({ visible, onClose }: AppTourModalProps) {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  const step = TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0];
  const totalSteps = TOUR_STEPS.length;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
    }
  };

  const handlePrev = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleComplete = async () => {
    await markAppTourCompleted();
    onClose();
    setTimeout(() => setCurrentStepIndex(0), 300);
  };

  const handleNavigateToScreen = async (targetRoute: string) => {
    await markAppTourCompleted();
    onClose();
    setTimeout(() => {
      try {
        if (targetRoute.includes('?modal=')) {
          const [pathname, queryString] = targetRoute.split('?');
          const modalParam = queryString?.replace('modal=', '');
          router.push({
            pathname: pathname as any,
            params: { modal: modalParam },
          });
        } else {
          router.push(targetRoute as any);
        }
      } catch (err) {
        console.warn('Tour redirect navigation error:', err);
      }
    }, 280);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleComplete}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.container,
            {
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : '#e2e8f0',
            },
          ]}
        >
          {/* HEADER BAR */}
          <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
            <View
              style={[
                styles.stepCounterPill,
                { backgroundColor: step.badgeBg, borderColor: step.badgeColor + '40' },
              ]}
            >
              <Text style={[styles.stepCounterText, { color: step.badgeColor }]}>
                {step.badge} • {currentStepIndex + 1} of {totalSteps}
              </Text>
            </View>

            <TouchableOpacity
              onPress={handleComplete}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
              style={styles.skipButton}
            >
              <Text style={[styles.skipText, { color: colors.textMuted }]}>
                {isLastStep ? 'Close' : 'Skip'}
              </Text>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* SLIDE CONTENT */}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* ICON & BADGE */}
            <View style={styles.heroSection}>
              <View style={[styles.iconCircle, { backgroundColor: step.iconBg }]}>
                <Ionicons name={step.icon} size={36} color={step.iconColor} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>{step.title}</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {step.subtitle}
              </Text>
            </View>

            {/* HIGHLIGHT ITEMS */}
            <View style={styles.highlightsContainer}>
              {step.highlights.map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.highlightCard,
                    {
                      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.65)' : '#f8fafc',
                      borderColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e2e8f0',
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.highlightIconBox,
                      { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#e0f2fe' },
                    ]}
                  >
                    <Ionicons name={item.icon} size={19} color={colors.primary} />
                  </View>
                  <View style={styles.highlightTextBox}>
                    <Text style={[styles.highlightTitle, { color: colors.text }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.highlightDesc, { color: colors.textSecondary }]}>
                      {item.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* DIRECT SCREEN JUMP / REDIRECT ACTION CARD */}
            {step.route && (
              <TouchableOpacity
                style={[
                  styles.redirectBanner,
                  {
                    backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#f0f9ff',
                    borderColor: isDark ? 'rgba(56, 189, 248, 0.35)' : '#bae6fd',
                  },
                ]}
                onPress={() => handleNavigateToScreen(step.route)}
                activeOpacity={0.8}
              >
                <View style={styles.redirectBannerLeft}>
                  <View
                    style={[
                      styles.redirectIconCircle,
                      { backgroundColor: isDark ? '#38bdf8' : '#0284c7' },
                    ]}
                  >
                    <Ionicons name={step.routeIcon || 'open-outline'} size={15} color="#ffffff" />
                  </View>
                  <View style={styles.redirectTextContainer}>
                    <Text
                      style={[styles.redirectTitle, { color: isDark ? '#38bdf8' : '#0284c7' }]}
                      numberOfLines={1}
                    >
                      {step.routeLabel}
                    </Text>
                    <Text
                      style={[styles.redirectHint, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      Tap to open and see where it works
                    </Text>
                  </View>
                </View>

                <View style={styles.redirectArrowBadge}>
                  <Text style={[styles.redirectArrowText, { color: isDark ? '#38bdf8' : '#0284c7' }]}>
                    Open
                  </Text>
                  <Ionicons
                    name="arrow-forward"
                    size={14}
                    color={isDark ? '#38bdf8' : '#0284c7'}
                  />
                </View>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* FOOTER CONTROLS */}
          <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
            {/* STEP DOTS */}
            <View style={styles.dotsRow}>
              {TOUR_STEPS.map((_, idx) => {
                const isActive = idx === currentStepIndex;
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setCurrentStepIndex(idx)}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    style={[
                      styles.dot,
                      isActive
                        ? [styles.activeDot, { backgroundColor: colors.primary }]
                        : { backgroundColor: isDark ? '#334155' : '#cbd5e1' },
                    ]}
                  />
                );
              })}
            </View>

            {/* ACTION BUTTONS */}
            <View style={styles.buttonsRow}>
              {!isFirstStep && (
                <TouchableOpacity
                  style={[
                    styles.secondaryButton,
                    {
                      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : '#f1f5f9',
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={handlePrev}
                  activeOpacity={0.7}
                >
                  <Ionicons name="arrow-back" size={16} color={colors.text} />
                  <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Back</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.primary, flex: isFirstStep ? 1 : undefined },
                ]}
                onPress={handleNext}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>
                  {isLastStep ? 'Get Started 🚀' : 'Next'}
                </Text>
                {!isLastStep && <Ionicons name="arrow-forward" size={16} color="#ffffff" />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    width: Math.min(width - 32, 440),
    maxHeight: '90%',
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 20,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stepCounterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  stepCounterText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  skipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  highlightsContainer: {
    gap: 8,
    marginBottom: 14,
  },
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 11,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  highlightIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  highlightTextBox: {
    flex: 1,
  },
  highlightTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  highlightDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  redirectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: 4,
  },
  redirectBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  redirectIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redirectTextContainer: {
    flex: 1,
  },
  redirectTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  redirectHint: {
    fontSize: 11,
    marginTop: 1,
  },
  redirectArrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  redirectArrowText: {
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 18,
    height: 6,
    borderRadius: 3,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    gap: 6,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
