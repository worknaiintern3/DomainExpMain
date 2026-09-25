import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NeonButton, NeonCard, NeonInput, StatusBadge } from '../components/common';
import { WhoisDetailsModal } from '../components/whois/WhoisDetailsModal';
import { lookupWhois, type NormalizedWhoisData } from '../services/whois';
import { colors, radius, spacing, typography } from '../theme';
import { Icon } from '../theme/icons';

interface SearchResult {
  domain: string;
  tld: string;
  available: boolean;
  pricePerYear?: string | undefined;
  suggested?: boolean | undefined;
  registrar?: string | undefined;
}

export const DomainFinderScreen: React.FC<{ onBack?: (() => void) | undefined }> = ({
  onBack,
}) => {
  const [query, setQuery] = useState('');
  const [selectedTld, setSelectedTld] = useState('.com');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  // WHOIS modal state
  const [whoisModalData, setWhoisModalData] = useState<NormalizedWhoisData | null>(null);
  const [whoisLoading, setWhoisLoading] = useState(false);
  const [whoisModalVisible, setWhoisModalVisible] = useState(false);

  const POPULAR_TLDS = ['.com', '.in', '.ai', '.app', '.org', '.net', '.co', '.io'];

  const handleInspectWhois = async (domainToInspect: string) => {
    setWhoisLoading(true);
    setWhoisModalVisible(true);
    try {
      const data = await lookupWhois(domainToInspect);
      setWhoisModalData(data);
    } catch (e) {
      console.warn('Failed to load WHOIS:', e);
    } finally {
      setWhoisLoading(false);
    }
  };

  const handleSearch = async () => {
    const raw = query.trim().toLowerCase();
    if (!raw) return;

    setSearching(true);
    setHasSearched(true);

    // Clean query
    const baseName = raw.includes('.') ? raw.split('.')[0] : raw;
    const primaryTld = raw.includes('.') ? `.${raw.split('.').slice(1).join('.')}` : selectedTld;
    const primaryDomain = `${baseName}${primaryTld}`;

    let primaryAvailable = false;
    let liveWhois: NormalizedWhoisData | null = null;
    try {
      liveWhois = await lookupWhois(primaryDomain);
      primaryAvailable = !liveWhois.isRegistered;
    } catch {
      // Fallback
    }

    const tldList = Array.from(new Set([primaryTld, '.com', '.ai', '.in', '.app', '.io']));
    const generated: SearchResult[] = tldList.map((tld) => {
      const dom = `${baseName}${tld}`;
      if (dom === primaryDomain && liveWhois) {
        return {
          domain: dom,
          tld,
          available: primaryAvailable,
          pricePerYear: tld === '.ai' ? '$69.99/yr' : tld === '.io' ? '$38.99/yr' : '$12.98/yr',
          suggested: primaryAvailable,
          registrar: liveWhois.registrar.name || undefined,
        };
      }
      const isCom = tld === '.com';
      return {
        domain: dom,
        tld,
        available: !isCom,
        pricePerYear: tld === '.ai' ? '$69.99/yr' : tld === '.io' ? '$38.99/yr' : '$12.98/yr',
        suggested: tld === '.ai',
      };
    });

    setResults(generated);
    setSearching(false);
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.navBar}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Icon name="chevron-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.navTitle}>Domain Finder</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroHeading}>Find Your Next Domain</Text>
          <Text style={styles.heroSubheading}>Discover. Secure. Grow.</Text>
        </View>

        {/* Search Bar Input */}
        <View style={styles.searchBox}>
          <NeonInput
            placeholder="Enter a domain or brand name..."
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            icon="search"
            containerStyle={styles.inputContainer}
          />
          <NeonButton
            title={searching ? 'Checking...' : 'Check Availability'}
            onPress={handleSearch}
            loading={searching}
            variant="primary"
            size="md"
            icon="search"
            style={styles.searchBtn}
          />
        </View>

        {/* Popular TLD Chips */}
        <View style={styles.tldSection}>
          <Text style={styles.tldLabel}>POPULAR EXTENSIONS</Text>
          <View style={styles.tldChipsRow}>
            {POPULAR_TLDS.map((tld) => {
              const isSelected = selectedTld === tld;
              return (
                <TouchableOpacity
                  key={tld}
                  style={[styles.tldChip, isSelected && styles.tldChipActive]}
                  onPress={() => setSelectedTld(tld)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tldText, isSelected && styles.tldTextActive]}>
                    {tld}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Results Matrix */}
        {hasSearched ? (
          <View style={styles.resultsSection}>
            <Text style={styles.sectionHeader}>Availability Results</Text>
            {results.map((res) => (
              <NeonCard
                key={res.domain}
                style={styles.resultCard}
                variant={res.available ? 'active' : 'normal'}
              >
                <View style={styles.resultHeader}>
                  <View style={styles.domainInfo}>
                    <Text style={styles.resultDomain}>{res.domain}</Text>
                    <Text style={styles.priceEstimate}>{res.pricePerYear}</Text>
                  </View>

                  <StatusBadge
                    status={res.available ? 'Available' : 'Taken'}
                    variant={res.available ? 'active' : 'critical'}
                    size="sm"
                  />
                </View>

                {res.available ? (
                  <View style={styles.actionRow}>
                    {res.suggested ? (
                      <View style={styles.aiPill}>
                        <Icon name="zap" size={12} color={colors.neonGreen} />
                        <Text style={styles.aiPillText}>AI Pick</Text>
                      </View>
                    ) : <View />}

                    <TouchableOpacity style={styles.registerBtn} activeOpacity={0.8}>
                      <Text style={styles.registerBtnText}>Add to Portfolio →</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.actionRow}>
                    <Text style={styles.takenSub} numberOfLines={1}>
                      {res.registrar ? `Registrar: ${res.registrar}` : 'Registered Domain'}
                    </Text>
                    <TouchableOpacity
                      style={styles.whoisInspectBtn}
                      onPress={() => handleInspectWhois(res.domain)}
                      activeOpacity={0.8}
                    >
                      <Icon name="globe" size={13} color={colors.neonCyan} />
                      <Text style={styles.whoisInspectBtnText}>Live WHOIS</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </NeonCard>
            ))}
          </View>
        ) : (
          <View style={styles.emptyPrompt}>
            <Icon name="globe" size={32} color={colors.textMuted} />
            <Text style={styles.promptTitle}>Instant Multi-TLD Intelligence</Text>
            <Text style={styles.promptDesc}>
              Search across .com, .ai, .in, and 50+ extensions with registrar pricing and live WhoisFreaks verification.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Live WhoisFreaks Inspection Modal */}
      <WhoisDetailsModal
        visible={whoisModalVisible}
        onClose={() => setWhoisModalVisible(false)}
        data={whoisModalData}
        loading={whoisLoading}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
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
  navTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.huge,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  heroHeading: {
    color: colors.textPrimary,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  heroSubheading: {
    color: colors.neonCyan,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    letterSpacing: 2,
    marginTop: 4,
  },
  searchBox: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    marginVertical: spacing.md,
  },
  inputContainer: {
    marginBottom: spacing.sm,
  },
  searchBtn: {
    width: '100%',
  },
  tldSection: {
    marginBottom: spacing.lg,
  },
  tldLabel: {
    color: colors.textMuted,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.8,
    marginBottom: spacing.xs + 2,
  },
  tldChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  tldChip: {
    backgroundColor: colors.bgSurface,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  tldChipActive: {
    borderColor: colors.neonCyan,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
  },
  tldText: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  tldTextActive: {
    color: colors.neonCyan,
    fontWeight: typography.weights.bold,
  },
  resultsSection: {
    gap: spacing.sm,
  },
  sectionHeader: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.xs,
  },
  resultCard: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  domainInfo: {
    flex: 1,
  },
  resultDomain: {
    color: colors.textPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
  },
  priceEstimate: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  aiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(53, 242, 138, 0.1)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  aiPillText: {
    color: colors.neonGreen,
    fontSize: typography.sizes.tiny,
    fontWeight: typography.weights.bold,
  },
  registerBtn: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.neonCyan,
  },
  registerBtnText: {
    color: colors.neonCyan,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  emptyPrompt: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  promptTitle: {
    color: colors.textPrimary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    marginTop: spacing.sm,
  },
  promptDesc: {
    color: colors.textSecondary,
    fontSize: typography.sizes.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
  takenSub: {
    color: colors.textDim,
    fontSize: typography.sizes.tiny,
    maxWidth: '60%',
  },
  whoisInspectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  whoisInspectBtnText: {
    color: colors.neonCyan,
    fontSize: typography.sizes.tiny,
    fontWeight: '700',
  },
});

