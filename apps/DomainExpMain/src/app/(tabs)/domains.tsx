import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Spacing, Typography } from '../../constants/theme';
import { useTheme } from '../../store/theme-context';
import { fetchDomainsList, createDomain } from '../../services/domains';
import { getDomainLogoUrl } from '../../services/liveDomainLookup';
import { DomainLogoImage } from '../../components/ui/DomainLogoImage';
import type { DomainItem } from '../../types';

function formatExpiryDate(dateStr?: string): string {
  if (!dateStr) return 'Active';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `Expires ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  } catch {
    return dateStr;
  }
}

export default function DomainsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'All' | 'Expiring' | 'Healthy' | 'Issues'>('All');
  const [refreshing, setRefreshing] = useState(false);

  // Add Domain Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newDomainName, setNewDomainName] = useState('');
  const [newRegistrar, setNewRegistrar] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const loadDomains = useCallback(async () => {
    const list = await fetchDomainsList();
    setDomains(list);
  }, []);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  useFocusEffect(
    useCallback(() => {
      loadDomains();
    }, [loadDomains])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDomains();
    setRefreshing(false);
  };

  const filteredDomains = useMemo(() => {
    return domains.filter((d) => {
      const matchesSearch =
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.registrar.toLowerCase().includes(searchQuery.toLowerCase());

      if (selectedFilter === 'Expiring') return matchesSearch && (d.daysRemaining || 99) <= 10;
      if (selectedFilter === 'Healthy') return matchesSearch && (d.daysRemaining || 99) > 10;
      if (selectedFilter === 'Issues') return matchesSearch && (d.status === 'critical' || (d.daysRemaining || 99) <= 10);
      return matchesSearch;
    });
  }, [domains, searchQuery, selectedFilter]);

  const handleAddDomain = async () => {
    if (!newDomainName.trim()) return;
    setIsAdding(true);
    try {
      const created = await createDomain({
        name: newDomainName.trim(),
        registrar: newRegistrar.trim() ? newRegistrar.trim() : undefined,
        autoRenew: true,
      });
      setDomains((prev) => [created, ...prev]);
      setNewDomainName('');
      setNewRegistrar('');
      setIsAddModalOpen(false);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#0b0f19' : '#f8fafc', paddingTop: insets.top }]}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Domains</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.finderButton,
              {
                backgroundColor: isDark ? '#111827' : '#f8fafc',
                borderColor: isDark ? '#1f2937' : '#e2e8f0',
              },
            ]}
            onPress={() => router.push('/finder')}
            activeOpacity={0.75}
          >
            <Ionicons name="search-outline" size={19} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.addButtonSquare, { backgroundColor: colors.primary }]}
            onPress={() => setIsAddModalOpen(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: isDark ? '#111827' : '#ffffff',
              borderColor: isDark ? '#1f2937' : '#f1f5f9',
            },
          ]}
        >
          <Ionicons name="search-outline" size={20} color={colors.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search domains..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => {
              if (searchQuery.trim() && filteredDomains.length === 0) {
                router.push({ pathname: '/finder', params: { q: searchQuery.trim() } } as any);
              }
            }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Pills Row */}
      <View style={styles.filtersSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {(['All', 'Expiring', 'Healthy', 'Issues'] as const).map((filter) => {
            const isSelected = selectedFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: isSelected
                      ? (isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe')
                      : (isDark ? '#111827' : '#ffffff'),
                    borderColor: isSelected ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#1f2937' : '#e2e8f0'),
                  },
                ]}
                onPress={() => setSelectedFilter(filter)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    {
                      color: isSelected ? (isDark ? '#38bdf8' : '#0284c7') : colors.textSecondary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Domain Cards List */}
      <ScrollView
        contentContainerStyle={[styles.scrollList, { paddingBottom: Spacing.xxxl + 120 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredDomains.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: isDark ? '#111827' : '#ffffff',
                borderColor: isDark ? '#1f2937' : '#f1f5f9',
              },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No domains found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {searchQuery
                ? `No matches for "${searchQuery}" in your portfolio.`
                : 'Track or register your first domain.'}
            </Text>
          </View>
        ) : (
          filteredDomains.map((domain) => {
            const logoUri = domain.logoUrl || getDomainLogoUrl(domain.name);
            const expTime = domain.expiresAt ? new Date(domain.expiresAt).getTime() : NaN;
            const daysCount = !isNaN(expTime)
              ? Math.max(0, Math.ceil((expTime - Date.now()) / (1000 * 60 * 60 * 24)))
              : domain.daysRemaining ?? 365;

            return (
              <TouchableOpacity
                key={domain.id}
                style={[
                  styles.domainCard,
                  {
                    backgroundColor: isDark ? '#111827' : '#ffffff',
                    borderColor: isDark ? '#1f2937' : '#f1f5f9',
                  },
                ]}
                onPress={() => router.push(`/domain/${domain.id}` as any)}
                activeOpacity={0.8}
              >
                <DomainLogoImage
                  domainName={domain.name}
                  logoUrl={logoUri}
                  size={48}
                  borderRadius={14}
                />

                <View style={styles.domainInfoCol}>
                  <Text style={[styles.domainName, { color: colors.text }]} numberOfLines={1}>
                    {domain.name}
                  </Text>
                  <Text style={[styles.registrarLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                    ● {domain.registrar}
                  </Text>
                  <View style={styles.expiryRow}>
                    <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} style={{ marginRight: 4 }} />
                    <Text style={[styles.expiryDateText, { color: colors.textSecondary }]}>
                      {formatExpiryDate(domain.expiresAt)}
                    </Text>
                  </View>
                </View>

                <View style={styles.daysBadgePill}>
                  <View style={styles.daysBadgeDot} />
                  <Text style={styles.daysBadgePillText}>{daysCount}d</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Add Domain Modal */}
      <Modal
        visible={isAddModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => {
                Keyboard.dismiss();
                setIsAddModalOpen(false);
              }}
            />
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: isDark ? '#111827' : '#ffffff',
                  borderColor: isDark ? '#1f2937' : '#e2e8f0',
                  paddingBottom: Math.max(insets.bottom, 24),
                },
              ]}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Add New Domain</Text>
                <TouchableOpacity onPress={() => setIsAddModalOpen(false)}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalForm}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Domain Name</Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                      color: colors.text,
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                    },
                  ]}
                  placeholder="e.g. mycompany.com"
                  placeholderTextColor={colors.textMuted}
                  value={newDomainName}
                  onChangeText={setNewDomainName}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                  Registrar (Optional)
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                      color: colors.text,
                      borderColor: isDark ? '#334155' : '#e2e8f0',
                    },
                  ]}
                  placeholder="e.g. GoDaddy, Cloudflare, Namecheap"
                  placeholderTextColor={colors.textMuted}
                  value={newRegistrar}
                  onChangeText={setNewRegistrar}
                  autoCapitalize="words"
                />

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    {
                      backgroundColor: '#0f172a',
                      opacity: !newDomainName.trim() || isAdding ? 0.6 : 1,
                    },
                  ]}
                  onPress={handleAddDomain}
                  disabled={!newDomainName.trim() || isAdding}
                  activeOpacity={0.8}
                >
                  <Text style={styles.submitButtonText}>
                    {isAdding ? 'Adding...' : 'Add Domain'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  finderButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonSquare: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  searchSection: {
    paddingHorizontal: Spacing.lg,
    marginTop: 6,
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  filtersSection: {
    marginBottom: 14,
  },
  filterScroll: {
    paddingHorizontal: Spacing.lg,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  filterPillText: {
    fontSize: 13,
  },
  scrollList: {
    paddingHorizontal: Spacing.lg,
    gap: 12,
  },
  domainCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  domainInfoCol: {
    flex: 1,
    marginLeft: 14,
    marginRight: 8,
    justifyContent: 'center',
  },
  domainName: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  registrarLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 4,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expiryDateText: {
    fontSize: 12,
    fontWeight: '500',
  },
  daysBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
    gap: 5,
    flexShrink: 0,
  },
  daysBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  daysBadgePillText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyCard: {
    padding: Spacing.xxl,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.titleSmall,
    fontWeight: '700',
  },
  emptySubtitle: {
    ...Typography.bodyMedium,
    marginTop: 4,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.titleMedium,
    fontWeight: '700',
  },
  modalForm: {
    gap: Spacing.sm,
  },
  inputLabel: {
    ...Typography.bodySmall,
    fontWeight: '600',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    fontSize: 15,
  },
  submitButton: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
