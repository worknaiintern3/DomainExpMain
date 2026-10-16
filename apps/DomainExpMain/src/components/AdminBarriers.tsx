import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRemoteConfig } from '../store/remote-config-context';
import { useTheme } from '../store/theme-context';
import { Radius, Spacing, Typography } from '../constants/theme';

export function MaintenanceBarrier() {
  const { maintenanceMessage, refreshConfig, appBranding } = useRemoteConfig();
  const { colors, isDark } = useTheme();
  const [checking, setChecking] = useState(false);

  const handleRetry = async () => {
    setChecking(true);
    await refreshConfig();
    setTimeout(() => setChecking(false), 800);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.iconCircleWarning}>
          <Ionicons name="construct" size={38} color="#f59e0b" />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>System Maintenance</Text>
        <Text style={[styles.appName, { color: colors.primary }]}>{appBranding.appName || 'DomainPulse'}</Text>

        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {maintenanceMessage ||
            'We are currently undergoing scheduled system upgrades and maintenance. All services will resume shortly.'}
        </Text>

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          onPress={handleRetry}
          disabled={checking}
          activeOpacity={0.8}
        >
          {checking ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <View style={styles.btnRow}>
              <Ionicons name="refresh" size={16} color="#ffffff" />
              <Text style={styles.actionBtnText}>Check Live Status</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          Emergency Kill-Switch active via Admin Console
        </Text>
      </View>
    </View>
  );
}

export function UpdateRequiredBarrier() {
  const { versionPolicy, appBranding } = useRemoteConfig();
  const { colors } = useTheme();

  const handleOpenStore = () => {
    const defaultPlayStoreUrl = 'https://play.google.com/store/apps/details?id=com.domainpulse.mobile';
    const storeUrl = versionPolicy.updateUrl || defaultPlayStoreUrl;
    Linking.openURL(storeUrl).catch(() => {});
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.iconCircleUpdate}>
          <Ionicons name="arrow-up-circle" size={42} color="#0284c7" />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Update Required</Text>
        <Text style={[styles.appName, { color: colors.primary }]}>{appBranding.appName || 'DomainPulse'}</Text>

        <Text style={[styles.message, { color: colors.textSecondary }]}>
          A required security and feature update (v{versionPolicy.minimumVersion}) is now available. Please update to continue using {appBranding.appName}.
        </Text>

        {versionPolicy.releaseNotes ? (
          <View style={[styles.notesBox, { backgroundColor: colors.surfaceHighlight, borderColor: colors.border }]}>
            <Text style={[styles.notesHeader, { color: colors.text }]}>What's New:</Text>
            <Text style={[styles.notesText, { color: colors.textSecondary }]}>{versionPolicy.releaseNotes}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: '#0284c7' }]}
          onPress={handleOpenStore}
          activeOpacity={0.85}
        >
          <View style={styles.btnRow}>
            <Ionicons name={Platform.OS === 'ios' ? 'logo-apple-appstore' : 'logo-google-playstore'} size={18} color="#ffffff" />
            <Text style={styles.actionBtnText}>Update from Store</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  iconCircleWarning: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  iconCircleUpdate: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(2, 132, 199, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.titleLarge,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  appName: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  message: {
    ...Typography.bodyMedium,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  notesBox: {
    width: '100%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  notesHeader: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 12,
    lineHeight: 16,
  },
  actionBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  footerText: {
    fontSize: 11,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
});
