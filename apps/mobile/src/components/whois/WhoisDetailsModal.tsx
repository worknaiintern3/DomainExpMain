import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import type { NormalizedWhoisData } from '../../services/whois';
import { colors, radius, spacing, typography } from '../../theme';
import { Icon } from '../../theme/icons';

interface WhoisDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  data: NormalizedWhoisData | null;
  loading?: boolean;
  onRefresh?: () => void;
}

type TabType = 'overview' | 'contacts' | 'nameservers' | 'raw';

export const WhoisDetailsModal: React.FC<WhoisDetailsModalProps> = ({
  visible,
  onClose,
  data,
  loading = false,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetContainer}>
              {/* Drag Handle */}
              <View style={styles.dragHandle} />

              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerTitleCol}>
                  <View style={styles.headerBadgeRow}>
                    <View style={styles.whoisTag}>
                      <Icon name="globe" size={12} color={colors.neonCyan} />
                      <Text style={styles.whoisTagText}>WHOIS FREAKS LIVE</Text>
                    </View>
                    {data?.savedToDatabase && (
                      <View style={styles.dbTag}>
                        <Icon name="database" size={12} color={colors.neonGreen} />
                        <Text style={styles.dbTagText}>Postgres Saved</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.domainTitle} numberOfLines={1}>
                    {data?.domainName || 'Domain WHOIS'}
                  </Text>
                  {data?.retrievedAt && (
                    <Text style={styles.headerSub}>
                      Fetched {new Date(data.retrievedAt).toLocaleTimeString()}
                    </Text>
                  )}
                </View>

                <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                  <Icon name="x" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Loading State */}
              {loading ? (
                <View style={styles.loadingBox}>
                  <ActivityIndicator size="large" color={colors.neonCyan} />
                  <Text style={styles.loadingTitle}>Querying WhoisFreaks Live API...</Text>
                  <Text style={styles.loadingDesc}>
                    Fetching real-time registrar, registry dates, contacts and nameservers.
                  </Text>
                </View>
              ) : !data ? (
                <View style={styles.emptyBox}>
                  <Icon name="alert-triangle" size={32} color={colors.warning} />
                  <Text style={styles.emptyTitle}>No WHOIS data available</Text>
                  <Text style={styles.emptyDesc}>
                    Unable to fetch WHOIS information for this domain.
                  </Text>
                </View>
              ) : (
                <>
                  {/* Tabs */}
                  <View style={styles.tabRow}>
                    {(
                      [
                        { id: 'overview', label: 'Overview' },
                        { id: 'contacts', label: 'Contacts' },
                        { id: 'nameservers', label: 'DNS' },
                        { id: 'raw', label: 'Raw Text' },
                      ] as const
                    ).map((t) => (
                      <TouchableOpacity
                        key={t.id}
                        style={[styles.tabBtn, activeTab === t.id && styles.tabBtnActive]}
                        onPress={() => setActiveTab(t.id)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.tabBtnText,
                            activeTab === t.id && styles.tabBtnTextActive,
                          ]}
                        >
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <ScrollView
                    style={styles.scrollArea}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {/* TAB: OVERVIEW */}
                    {activeTab === 'overview' && (
                      <View style={styles.sectionCol}>
                        {/* Status Hero */}
                        <View
                          style={[
                            styles.statusCard,
                            data.isRegistered ? styles.statusCardReg : styles.statusCardAvail,
                          ]}
                        >
                          <View style={styles.statusRow}>
                            <View
                              style={[
                                styles.statusDot,
                                {
                                  backgroundColor: data.isRegistered
                                    ? colors.neonCyan
                                    : colors.neonGreen,
                                },
                              ]}
                            />
                            <Text style={styles.statusCardTitle}>
                              {data.isRegistered ? 'Registered Domain' : 'Available for Registration'}
                            </Text>
                          </View>
                          {data.daysRemaining !== null && (
                            <Text style={styles.statusDaysLeft}>
                              {data.daysRemaining > 0
                                ? `${data.daysRemaining} days until expiration`
                                : 'Expired or in grace period'}
                            </Text>
                          )}
                        </View>

                        {/* Dates Grid */}
                        <View style={styles.gridCard}>
                          <Text style={styles.cardHeaderTitle}>Lifecycle Dates</Text>
                          <View style={styles.gridRow}>
                            <View style={styles.gridItem}>
                              <Text style={styles.gridLabel}>Registered On</Text>
                              <Text style={styles.gridValue}>
                                {data.registeredAt
                                  ? new Date(data.registeredAt).toLocaleDateString()
                                  : 'Not reported'}
                              </Text>
                            </View>
                            <View style={styles.gridItem}>
                              <Text style={styles.gridLabel}>Expires On</Text>
                              <Text
                                style={[
                                  styles.gridValue,
                                  data.daysRemaining !== null && data.daysRemaining < 30
                                    ? { color: colors.warning }
                                    : null,
                                ]}
                              >
                                {data.expiresAt
                                  ? new Date(data.expiresAt).toLocaleDateString()
                                  : 'Not reported'}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.gridRow}>
                            <View style={styles.gridItem}>
                              <Text style={styles.gridLabel}>Last Updated</Text>
                              <Text style={styles.gridValue}>
                                {data.updatedDate
                                  ? new Date(data.updatedDate).toLocaleDateString()
                                  : 'Not reported'}
                              </Text>
                            </View>
                            <View style={styles.gridItem}>
                              <Text style={styles.gridLabel}>Postgres Sync</Text>
                              <Text style={[styles.gridValue, { color: colors.neonGreen }]}>
                                {data.savedToDatabase ? 'Persisted in DB' : 'Live Cache'}
                              </Text>
                            </View>
                          </View>
                        </View>

                        {/* Registrar Information */}
                        <View style={styles.gridCard}>
                          <Text style={styles.cardHeaderTitle}>Registrar Information</Text>
                          <View style={styles.kvRow}>
                            <Text style={styles.kvLabel}>Registrar</Text>
                            <Text style={styles.kvValueBold}>
                              {data.registrar.name || 'Not reported'}
                            </Text>
                          </View>
                          {data.registrar.ianaId && (
                            <View style={styles.kvRow}>
                              <Text style={styles.kvLabel}>IANA ID</Text>
                              <Text style={styles.kvValueMono}>{data.registrar.ianaId}</Text>
                            </View>
                          )}
                          {data.registrar.websiteUrl && (
                            <View style={styles.kvRow}>
                              <Text style={styles.kvLabel}>Website</Text>
                              <Text style={[styles.kvValue, { color: colors.neonCyan }]}>
                                {data.registrar.websiteUrl}
                              </Text>
                            </View>
                          )}
                          {data.registrar.email && (
                            <View style={styles.kvRow}>
                              <Text style={styles.kvLabel}>Abuse Email</Text>
                              <Text style={styles.kvValue}>{data.registrar.email}</Text>
                            </View>
                          )}
                          {data.registrar.phone && (
                            <View style={styles.kvRow}>
                              <Text style={styles.kvLabel}>Abuse Phone</Text>
                              <Text style={styles.kvValue}>{data.registrar.phone}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {/* TAB: CONTACTS */}
                    {activeTab === 'contacts' && (
                      <View style={styles.sectionCol}>
                        {/* Registrant Contact */}
                        <View style={styles.gridCard}>
                          <View style={styles.contactTitleRow}>
                            <Icon name="user" size={16} color={colors.neonCyan} />
                            <Text style={styles.cardHeaderTitle}>Registrant Contact</Text>
                          </View>
                          {data.registrant ? (
                            <>
                              <View style={styles.kvRow}>
                                <Text style={styles.kvLabel}>Name</Text>
                                <Text style={styles.kvValue}>
                                  {data.registrant.name || 'Redacted for Privacy'}
                                </Text>
                              </View>
                              <View style={styles.kvRow}>
                                <Text style={styles.kvLabel}>Organization</Text>
                                <Text style={styles.kvValue}>
                                  {data.registrant.company || 'Redacted / Not disclosed'}
                                </Text>
                              </View>
                              <View style={styles.kvRow}>
                                <Text style={styles.kvLabel}>Location</Text>
                                <Text style={styles.kvValue}>
                                  {[data.registrant.city, data.registrant.country_name]
                                    .filter(Boolean)
                                    .join(', ') || 'Privacy Protected'}
                                </Text>
                              </View>
                              <View style={styles.kvRow}>
                                <Text style={styles.kvLabel}>Email</Text>
                                <Text style={styles.kvValue}>
                                  {data.registrant.email_address || 'Withheld for Privacy'}
                                </Text>
                              </View>
                            </>
                          ) : (
                            <Text style={styles.redactedNotice}>
                              Contact details redacted or protected by WHOIS privacy shield.
                            </Text>
                          )}
                        </View>

                        {/* Administrative Contact */}
                        {data.administrativeContact && (
                          <View style={styles.gridCard}>
                            <View style={styles.contactTitleRow}>
                              <Icon name="shield" size={16} color={colors.sky} />
                              <Text style={styles.cardHeaderTitle}>Administrative Contact</Text>
                            </View>
                            <View style={styles.kvRow}>
                              <Text style={styles.kvLabel}>Name</Text>
                              <Text style={styles.kvValue}>
                                {data.administrativeContact.name || 'Redacted'}
                              </Text>
                            </View>
                            <View style={styles.kvRow}>
                              <Text style={styles.kvLabel}>Organization</Text>
                              <Text style={styles.kvValue}>
                                {data.administrativeContact.company || 'Not disclosed'}
                              </Text>
                            </View>
                          </View>
                        )}
                      </View>
                    )}

                    {/* TAB: NAMESERVERS & STATUSES */}
                    {activeTab === 'nameservers' && (
                      <View style={styles.sectionCol}>
                        {/* Nameservers Card */}
                        <View style={styles.gridCard}>
                          <Text style={styles.cardHeaderTitle}>Authoritative Nameservers</Text>
                          {data.nameservers && data.nameservers.length > 0 ? (
                            data.nameservers.map((ns, idx) => (
                              <View key={idx} style={styles.nsItem}>
                                <Icon name="server" size={14} color={colors.neonCyan} />
                                <Text style={styles.nsText}>{ns}</Text>
                              </View>
                            ))
                          ) : (
                            <Text style={styles.emptySub}>No nameservers found in WHOIS reply.</Text>
                          )}
                        </View>

                        {/* Domain Statuses */}
                        <View style={styles.gridCard}>
                          <Text style={styles.cardHeaderTitle}>Domain Status Flags (EPP)</Text>
                          {data.statuses && data.statuses.length > 0 ? (
                            <View style={styles.statusBadgeWrap}>
                              {data.statuses.map((st, idx) => (
                                <View key={idx} style={styles.eppBadge}>
                                  <Text style={styles.eppBadgeText}>{st}</Text>
                                </View>
                              ))}
                            </View>
                          ) : (
                            <Text style={styles.emptySub}>No domain statuses recorded.</Text>
                          )}
                        </View>
                      </View>
                    )}

                    {/* TAB: RAW RECORD */}
                    {activeTab === 'raw' && (
                      <View style={styles.rawContainer}>
                        <Text style={styles.rawText} selectable>
                          {data.rawWhois ||
                            (data.rawResponse
                              ? JSON.stringify(data.rawResponse, null, 2)
                              : 'No raw WHOIS text available.')}
                        </Text>
                      </View>
                    )}
                  </ScrollView>

                  {/* Footer Actions */}
                  <View style={styles.footer}>
                    {onRefresh && (
                      <TouchableOpacity
                        style={styles.refreshBtn}
                        onPress={onRefresh}
                        activeOpacity={0.75}
                      >
                        <Icon name="refresh-cw" size={14} color={colors.neonCyan} />
                        <Text style={styles.refreshBtnText}>Refresh WhoisFreaks</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.doneBtn}
                      onPress={onClose}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.doneBtnText}>Close</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 24, 0.78)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    maxHeight: '88%',
    minHeight: 420,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderSubtle,
    alignSelf: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerTitleCol: {
    flex: 1,
    marginRight: spacing.sm,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  whoisTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  whoisTagText: {
    color: colors.neonCyan,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dbTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dbTagText: {
    color: colors.neonGreen,
    fontSize: 9,
    fontWeight: '700',
  },
  domainTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  headerSub: {
    color: colors.textDim,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  loadingBox: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginTop: spacing.sm,
  },
  loadingDesc: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyBox: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  emptyDesc: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    paddingHorizontal: spacing.md,
  },
  tabBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginRight: spacing.xs,
  },
  tabBtnActive: {
    borderBottomColor: colors.neonCyan,
  },
  tabBtnText: {
    color: colors.textDim,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  tabBtnTextActive: {
    color: colors.neonCyan,
    fontWeight: typography.weights.bold,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  sectionCol: {
    gap: spacing.md,
  },
  statusCard: {
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
  },
  statusCardReg: {
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
    borderColor: 'rgba(0, 229, 255, 0.25)',
  },
  statusCardAvail: {
    backgroundColor: 'rgba(16, 185, 129, 0.06)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusCardTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  statusDaysLeft: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: 4,
  },
  gridCard: {
    backgroundColor: colors.bgSurface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.xs,
  },
  cardHeaderTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: 4,
  },
  gridItem: {
    flex: 1,
  },
  gridLabel: {
    color: colors.textDim,
    fontSize: 11,
  },
  gridValue: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginTop: 2,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  kvLabel: {
    color: colors.textDim,
    fontSize: 12,
  },
  kvValue: {
    color: colors.textSecondary,
    fontSize: 12,
    maxWidth: '65%',
    textAlign: 'right',
  },
  kvValueBold: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: typography.weights.semibold,
    maxWidth: '65%',
    textAlign: 'right',
  },
  kvValueMono: {
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
  },
  contactTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  redactedNotice: {
    color: colors.textDim,
    fontSize: typography.sizes.xs,
    fontStyle: 'italic',
    marginTop: 4,
  },
  nsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  nsText: {
    color: colors.neonCyan,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },
  emptySub: {
    color: colors.textDim,
    fontSize: typography.sizes.xs,
    marginTop: 4,
  },
  statusBadgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  eppBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  eppBadgeText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  rawContainer: {
    backgroundColor: '#050a14',
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  rawText: {
    color: '#8be9fd',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
  },
  refreshBtnText: {
    color: colors.neonCyan,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  doneBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.bgSurface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  doneBtnText: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
});
