import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../store/theme-context';
import {
  triggerOfficialStoreReview,
  openStoreReviewUrl,
  markAppReviewed,
  markNeverAskAgain,
  snoozeReviewPrompt,
} from '../services/appReview';

interface AppReviewModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AppReviewModal({ visible, onClose }: AppReviewModalProps) {
  const { colors, isDark } = useTheme();
  const [selectedRating, setSelectedRating] = useState<number>(5);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleRate = async () => {
    setIsSubmitting(true);
    await markAppReviewed();
    onClose();
    // Trigger Google Play's official In-App Review bottom sheet
    await triggerOfficialStoreReview();
    setIsSubmitting(false);
  };

  const handleFeedback = async () => {
    setIsSubmitting(true);
    await markAppReviewed();
    const mailto = `mailto:support@domainexprt.com?subject=DomainExpert%20Mobile%20App%20Feedback&body=Rating:%20${selectedRating}/5%20stars%0A%0AFeedback:`;
    await Linking.openURL(mailto).catch(() => {});
    setIsSubmitting(false);
    onClose();
  };

  const handleRemindLater = async () => {
    await snoozeReviewPrompt(24);
    onClose();
  };

  const handleNeverAsk = async () => {
    await markNeverAskAgain();
    onClose();
  };

  const ratingTexts: Record<number, string> = {
    5: 'Loved it! 5/5 ⭐',
    4: 'Great experience! 4/5 ⭐',
    3: "It's good 3/5 ⭐",
    2: 'Could be better 2/5 ⭐',
    1: 'Needs work 1/5 ⭐',
  };

  const isPositive = selectedRating >= 4;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleRemindLater}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#111827' : '#ffffff',
              borderColor: isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(2, 132, 199, 0.2)',
            },
          ]}
        >
          {/* Top Close Button */}
          <TouchableOpacity
            style={[
              styles.closeBtn,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' },
            ]}
            onPress={handleRemindLater}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={styles.contentContainer}>
            {/* Star Badge Icon */}
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.18)' : '#fef3c7',
                  borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : '#fde68a',
                },
              ]}
            >
              <Ionicons name="star" size={36} color="#f59e0b" />
            </View>

            {/* Title & Subtitle */}
            <Text style={[styles.title, { color: colors.text }]}>
              Enjoying DomainExpert?
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              You've been exploring DomainExpert for 2 minutes! Your review on Google Play helps us
              grow and keep improving domain & server monitoring.
            </Text>

            {/* Interactive 5 Stars */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  style={styles.starBtn}
                  onPress={() => setSelectedRating(star)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={star <= selectedRating ? 'star' : 'star-outline'}
                    size={34}
                    color="#f59e0b"
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Dynamic Sentiment Text */}
            <Text style={styles.ratingLabel}>{ratingTexts[selectedRating]}</Text>

            {/* Primary Action Button */}
            {isPositive ? (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#0284c7' }]}
                onPress={handleRate}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                <Ionicons
                  name={Platform.OS === 'ios' ? 'logo-apple-appstore' : 'logo-google-playstore'}
                  size={18}
                  color="#ffffff"
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.primaryBtnText}>
                  {Platform.OS === 'ios' ? 'Rate on App Store' : 'Rate on Google Play'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#f59e0b' }]}
                onPress={handleFeedback}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                <Ionicons name="mail-outline" size={18} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.primaryBtnText}>Send Us Feedback</Text>
              </TouchableOpacity>
            )}

            {/* Secondary Buttons: Remind Me Later & No Thanks */}
            <View style={styles.secondaryActions}>
              <TouchableOpacity
                style={styles.textActionBtn}
                onPress={handleRemindLater}
                activeOpacity={0.7}
              >
                <Text style={[styles.textActionLabel, { color: colors.primary }]}>
                  Remind Me Later
                </Text>
              </TouchableOpacity>

              <View style={[styles.dotSeparator, { backgroundColor: colors.border }]} />

              <TouchableOpacity
                style={styles.textActionBtn}
                onPress={handleNeverAsk}
                activeOpacity={0.7}
              >
                <Text style={[styles.textActionLabel, { color: colors.textMuted }]}>
                  No, Thanks
                </Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  contentContainer: {
    width: '100%',
    alignItems: 'center',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  starBtn: {
    padding: 4,
  },
  ratingLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#f59e0b',
    marginBottom: 20,
  },
  primaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  secondaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 12,
  },
  textActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  textActionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  dotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
});
