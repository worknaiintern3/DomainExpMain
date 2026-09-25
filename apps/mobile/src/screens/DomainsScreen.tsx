import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AddDomainModal,
  EmptyState,
  ErrorState,
  FilterChips,
  LoadingSkeleton,
  NeonInput,
  StatusBadge,
} from '../components/common';
import { WhoisDetailsModal } from '../components/whois/WhoisDetailsModal';
import { mobileApiClient } from '../services/api-client';
import { lookupWhois, type NormalizedWhoisData } from '../services/whois';
import { colors, radius, spacing, typography } from '../theme';
import { Icon } from '../theme/icons';

export interface DomainRecord {
  id: string;
  name: string;
  status: string;
  registrar?: string | null | undefined;
  expiresInDays?: number | null | undefined;
  expiresAt?: string | null | undefined;
  autoRenew?: boolean | undefined;
}

interface DomainsScreenProps {
  onSelectDomain: (domainId: string) => void;
  onAddDomain?: (() => void) | undefined;
}

export const DomainsScreen: React.FC<DomainsScreenProps> = ({
  onSelectDomain,
  onAddDomain,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // WHOIS modal state
  const [whoisData, setWhoisData] = useState<NormalizedWhoisData | null>(null);
  const [whoisLoading, setWhoisLoading] = useState(false);
  const [whoisModalVisible, setWhoisModalVisible] = useState(false);

  const handleOpenWhois = async (domainName: string, domainId?: string) => {
    setWhoisLoading(true);
    setWhoisModalVisible(true);
    try {
      const data = await lookupWhois(domainName, domainId);
      setWhoisData(data);
    } catch (err: any) {
      console.warn('Failed to fetch WHOIS:', err);
    } finally {
      setWhoisLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    if (onAddDomain) {
      onAddDomain();
    } else {
      setIsAddModalOpen(true);
    }
  };

  const fetchDomains = async () => {
    try {
      setError(null);
      const data = await mobileApiClient.request<{ items?: any[]; data?: any[] }>('/domains');
      const items = data.items || data.data || [];
      setDomains(
        items.map((d: any) => ({
          id: d.id,
          name: d.name || d.domainName || 'domain.com',
          status: d.status || 'Active',
          registrar: d.registrar || null,
          expiresInDays: d.expiresInDays ?? null,
          expiresAt: d.expiresAt || d.expiryDate || null,
          autoRenew: d.autoRenew ?? false,
        })),
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to load domains from server.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDomains();
  };

  const filteredDomains = useMemo(() => {
    return domains.filter((d) => {
      // Search filter
      const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Status filter
      if (selectedFilter === 'All') return true;
      if (selectedFilter === 'Active')
        return d.status.toLowerCase().includes('active') || (d.expiresInDays ?? 99) > 30;
      if (selectedFilter === 'Expiring')
        return (d.expiresInDays ?? 99) <= 30 || d.status.toLowerCase().includes('expir');
      if (selectedFilter === 'Inactive')
        return d.status.toLowerCase().includes('inactive') || d.status.toLowerCase().includes('expired');
      return true;
    });
  }, [domains, searchQuery, selectedFilter]);

  const renderDomainItem = ({ item }: { item: DomainRecord }) => {
    const expiryText =
      item.expiresInDays !== null && item.expiresInDays !== undefined
        ? item.expiresInDays <= 7
          ? `${item.expiresInDays} days left`
          : `Expires in ${item.expiresInDays} days`
        : item.expiresAt
        ? `Expires on ${new Date(item.expiresAt).toLocaleDateString()}`
        : 'Monitored';

    return (
      <TouchableOpacity
        style={styles.domainCard}
        onPress={() => onSelectDomain(item.id)}
        activeOpacity={0.75}
      >
        <View style={styles.iconCircle}>
          <Icon name="globe" size={20} color={colors.neonCyan} />
        </View>

        <View style={styles.domainInfo}>
          <Text style={styles.domainName}>{item.name}</Text>
          <Text style={styles.domainMeta}>
            {item.status} · {expiryText}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.whoisPill}
          onPress={(e) => {
            e.stopPropagation();
            handleOpenWhois(item.name, item.id);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.whoisPillText}>WHOIS</Text>
        </TouchableOpacity>

        <StatusBadge status={item.status} size="sm" />
        <Icon name="chevron-right" size={18} color={colors.textDim} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Screen Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Domains</Text>
          <Text style={styles.headerSubtitle}>{domains.length} Managed Portfolios</Text>
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={handleOpenAddModal}
          activeOpacity={0.75}
        >
          <Icon name="plus" size={18} color={colors.bgPrimary} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <NeonInput
          placeholder="Search or enter domain (e.g. google.com)..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          icon="search"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="search"
          onSubmitEditing={() => {
            if (searchQuery.trim().includes('.')) {
              handleOpenWhois(searchQuery.trim());
            }
          }}
          containerStyle={styles.searchInputContainer}
        />
      </View>

      {/* Live WHOIS Lookup Banner when domain query entered */}
      {searchQuery.trim().includes('.') && (
        <View style={styles.bannerWrapper}>
          <TouchableOpacity
            style={styles.whoisBanner}
            onPress={() => handleOpenWhois(searchQuery.trim())}
            activeOpacity={0.8}
          >
            <View style={styles.whoisBannerIconCircle}>
              <Icon name="globe" size={16} color={colors.neonCyan} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.whoisBannerTitle}>
                Lookup WHOIS: {searchQuery.trim()}
              </Text>
              <Text style={styles.whoisBannerSub}>
                Fetch live WhoisFreaks data & sync to Postgres
              </Text>
            </View>
            <View style={styles.whoisBannerAction}>
              <Text style={styles.whoisBannerActionText}>Inspect →</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Chips */}
      <FilterChips
        options={['All', 'Active', 'Expiring', 'Inactive']}
        selected={selectedFilter}
        onSelect={setSelectedFilter}
      />

      {/* Content */}
      {loading ? (
        <View style={styles.loadingWrapper}>
          <LoadingSkeleton height={70} style={styles.skeletonItem} />
          <LoadingSkeleton height={70} style={styles.skeletonItem} />
          <LoadingSkeleton height={70} style={styles.skeletonItem} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchDomains} />
      ) : (
        <FlatList
          data={filteredDomains}
          keyExtractor={(item) => item.id}
          renderItem={renderDomainItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.neonCyan}
              colors={[colors.neonCyan]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="globe"
              title="No domains found"
              description={
                searchQuery
                  ? `No domains matching "${searchQuery}".`
                  : 'Start monitoring your infrastructure by adding your first domain.'
              }
              actionTitle="+ Add Domain"
              onAction={handleOpenAddModal}
            />
          }
        />
      )}

      {/* Add Domain Modal with All 7 Fields */}
      <AddDomainModal
        visible={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          fetchDomains();
        }}
      />

      {/* Live WhoisFreaks Details Modal */}
      <WhoisDetailsModal
        visible={whoisModalVisible}
        onClose={() => setWhoisModalVisible(false)}
        data={whoisData}
        loading={whoisLoading}
        onRefresh={() => {
          if (whoisData?.domainName) {
            handleOpenWhois(whoisData.domainName, whoisData.id ?? undefined);
          }
        }}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neonCyan,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.neonCyan,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  searchSection: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  searchInputContainer: {
    marginBottom: 0,
  },
  loadingWrapper: {
    padding: spacing.md,
    gap: spacing.md,
  },
  skeletonItem: {
    borderRadius: radius.lg,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  domainCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    gap: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  domainInfo: {
    flex: 1,
  },
  domainName: {
    color: colors.textPrimary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  domainMeta: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: 3,
  },
  whoisPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  whoisPillText: {
    color: colors.neonCyan,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  bannerWrapper: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  whoisBanner: {
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderRadius: radius.md,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  whoisBannerIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whoisBannerTitle: {
    color: colors.neonCyan,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  whoisBannerSub: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  whoisBannerAction: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.neonCyan,
  },
  whoisBannerActionText: {
    color: colors.bgPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
});

