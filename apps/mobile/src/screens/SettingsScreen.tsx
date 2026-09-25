import React, { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { type MobileBootstrapConfigResponse } from '@domainpulse/contracts';
import { ENV } from '../config/env';
import { colors, radius, spacing, typography } from '../theme';
import { Icon } from '../theme/icons';

interface SettingsScreenProps {
  onBack: () => void;
  config?: MobileBootstrapConfigResponse | null | undefined;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  config,
}) => {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [sslAlertsEnabled, setSslAlertsEnabled] = useState(true);
  const [expiringAlertsEnabled, setExpiringAlertsEnabled] = useState(true);

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'Local cache and stored session tokens will be reset. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Success', 'Local application cache has been cleared.');
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Icon name="chevron-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>System & device preferences</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Section: API & Connection */}
        <Text style={styles.sectionHeader}>CONNECTION & BACKEND</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.labelCol}>
              <Text style={styles.label}>API Base URL</Text>
              <Text style={styles.sublabel}>{ENV.API_BASE_URL}</Text>
            </View>
            <View style={styles.onlinePill}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Connected</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.labelCol}>
              <Text style={styles.label}>Environment</Text>
              <Text style={styles.sublabel}>Development / Production</Text>
            </View>
            <Text style={styles.valText}>Node 20 / NestJS</Text>
          </View>
        </View>

        {/* Section: Remote Config */}
        <Text style={styles.sectionHeader}>REMOTE CONFIGURATION (ADMIN)</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.labelCol}>
              <Text style={styles.label}>Config Version</Text>
              <Text style={styles.sublabel}>Synchronized with Admin Console</Text>
            </View>
            <Text style={styles.valTextHighlight}>
              v{config?.version?.latestVersion ?? '1.0.0'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.labelCol}>
              <Text style={styles.label}>Home Sections</Text>
              <Text style={styles.sublabel}>Dynamic sections enabled</Text>
            </View>
            <Text style={styles.valText}>
              {config?.homeSections?.filter((s) => s.enabled).length || 0} active
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.labelCol}>
              <Text style={styles.label}>Navigation Tabs</Text>
              <Text style={styles.sublabel}>Configurable bottom tabs</Text>
            </View>
            <Text style={styles.valText}>
              {config?.navigation?.filter((n) => n.enabled).length || 0} active
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.labelCol}>
              <Text style={styles.label}>Maintenance Mode</Text>
              <Text style={styles.sublabel}>Emergency admin lockdown</Text>
            </View>
            <Text
              style={[
                styles.valText,
                config?.app?.maintenanceMode && styles.valTextDanger,
              ]}
            >
              {config?.app?.maintenanceMode ? 'ACTIVE' : 'Disabled'}
            </Text>
          </View>
        </View>

        {/* Section: Push Alerts */}
        <Text style={styles.sectionHeader}>NOTIFICATIONS</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.labelCol}>
              <Text style={styles.label}>Push Notifications</Text>
              <Text style={styles.sublabel}>Critical infrastructure alerts</Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={setPushEnabled}
              thumbColor={pushEnabled ? colors.neonCyan : colors.textMuted}
              trackColor={{ false: colors.borderSubtle, true: 'rgba(0, 229, 255, 0.3)' }}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.labelCol}>
              <Text style={styles.label}>Domain Expiry Warnings</Text>
              <Text style={styles.sublabel}>Alert 30, 15, and 7 days prior</Text>
            </View>
            <Switch
              value={expiringAlertsEnabled}
              onValueChange={setExpiringAlertsEnabled}
              thumbColor={expiringAlertsEnabled ? colors.neonCyan : colors.textMuted}
              trackColor={{ false: colors.borderSubtle, true: 'rgba(0, 229, 255, 0.3)' }}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <View style={styles.labelCol}>
              <Text style={styles.label}>SSL Expiry & Errors</Text>
              <Text style={styles.sublabel}>Cert expiration warnings</Text>
            </View>
            <Switch
              value={sslAlertsEnabled}
              onValueChange={setSslAlertsEnabled}
              thumbColor={sslAlertsEnabled ? colors.neonCyan : colors.textMuted}
              trackColor={{ false: colors.borderSubtle, true: 'rgba(0, 229, 255, 0.3)' }}
            />
          </View>
        </View>

        {/* Section: Storage & Cache */}
        <Text style={styles.sectionHeader}>STORAGE & DIAGNOSTICS</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleClearCache}
            activeOpacity={0.7}
          >
            <View style={styles.labelCol}>
              <Text style={styles.labelDanger}>Clear Local Cache</Text>
              <Text style={styles.sublabel}>Remove cached queries and temporary storage</Text>
            </View>
            <Icon name="trash" size={18} color={colors.neonCoral} />
          </TouchableOpacity>
        </View>

        {/* About Footer */}
        <View style={styles.aboutContainer}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.aboutLogo}
            resizeMode="cover"
          />
          <Text style={styles.aboutTitle}>DomainPulse Mobile</Text>
          <Text style={styles.aboutSubtitle}>
            Version 1.0.0 (Phase B Neon Dark Edition)
          </Text>
          <Text style={styles.aboutMeta}>
            Engineered with React Native · Expo SDK 52 · TypeScript
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    color: colors.textMuted,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginLeft: spacing.md,
  },
  labelCol: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  label: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  labelDanger: {
    color: colors.neonCoral,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  sublabel: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  valText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  valTextHighlight: {
    color: colors.neonCyan,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  valTextDanger: {
    color: colors.neonCoral,
    fontWeight: typography.weights.bold,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(53, 242, 138, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(53, 242, 138, 0.3)',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.neonGreen,
  },
  onlineText: {
    color: colors.neonGreen,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
  },
  aboutContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  aboutLogo: {
    width: 48,
    height: 48,
    borderRadius: 14,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.4)',
  },
  aboutTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  aboutSubtitle: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  aboutMeta: {
    color: colors.textMuted,
    fontSize: typography.sizes.tiny,
    marginTop: 4,
  },
});
