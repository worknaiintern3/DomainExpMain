import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Spacing, Typography } from '../constants/theme';
import { useTheme } from '../store/theme-context';
import { useSettings } from '../store/settings-context';
import { searchMultipleTlds } from '../services/finder';
import { fetchLiveDomainDetails, getDomainLogoUrl, LiveDomainInfo } from '../services/liveDomainLookup';
import { openWebsiteInBrowser } from '../services/websites';
import { createDomain } from '../services/domains';
import { DomainLogoImage } from '../components/ui/DomainLogoImage';
import type { DomainSearchResult } from '../types';

const FINDER_TLDS = ['.com', '.in', '.ai', '.io', '.dev', '.app', '.tech', '.org'];

export default function DomainFinderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { currencySymbol } = useSettings();

  const [keyword, setKeyword] = useState(params.q || '');
  const [selectedTlds, setSelectedTlds] = useState<string[]>(['.com', '.in', '.ai', '.dev']);
  const [results, setResults] = useState<DomainSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<DomainSearchResult | null>(null);
  const [liveDetails, setLiveDetails] = useState<LiveDomainInfo | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const toggleTld = (tld: string) => {
    setSelectedTlds((prev) =>
      prev.includes(tld) ? prev.filter((t) => t !== tld) : [...prev, tld],
    );
  };

  const handleSearch = async (overrideKeyword?: string) => {
    const term = (overrideKeyword ?? keyword).trim();
    if (!term) return;
    setIsSearching(true);
    setHasSearched(true);
    try {
      const searchResults = await searchMultipleTlds(term, selectedTlds);
      setResults(searchResults);
    } finally {
      setIsSearching(false);
    }
  };

  React.useEffect(() => {
    if (params.q) {
      setKeyword(params.q);
      handleSearch(params.q);
    }
  }, [params.q]);

  const handleInspectDomain = async (item: DomainSearchResult) => {
    setSelectedDomain(item);
    setLiveDetails(null);
    if (!item.available) {
      setIsLoadingDetails(true);
      try {
        const data = await fetchLiveDomainDetails(item.domain);
        setLiveDetails(data);
      } catch {
        // Fallback
      } finally {
        setIsLoadingDetails(false);
      }
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={[styles.headerBar, { borderBottomColor: colors.borderSubtle }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
          <Text style={[styles.backArrow, { color: colors.text }]}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Find a Domain</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Search Input */}
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search domain name (e.g. domainpulse)"
            placeholderTextColor={colors.textMuted}
            value={keyword}
            onChangeText={setKeyword}
            autoCapitalize="none"
            onSubmitEditing={() => handleSearch()}
            returnKeyType="search"
          />
          {keyword.length > 0 && (
            <TouchableOpacity onPress={() => setKeyword('')}>
              <Text style={[styles.clearIcon, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* TLD Selector Pills */}
        <View style={styles.tldsGrid}>
          {FINDER_TLDS.map((tld) => {
            const isSelected = selectedTlds.includes(tld);
            return (
              <TouchableOpacity
                key={tld}
                style={[
                  styles.tldPill,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                  isSelected && {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
                ]}
                onPress={() => toggleTld(tld)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.tldPillText,
                    { color: colors.text },
                    isSelected && { color: colors.textInverse, fontWeight: '700' },
                  ]}
                >
                  {tld}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Big Blue Search Button */}
        <TouchableOpacity
          style={[styles.searchBtn, { backgroundColor: colors.primary }]}
          onPress={() => handleSearch()}
          disabled={isSearching}
          activeOpacity={0.85}
        >
          {isSearching ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <Text style={[styles.searchBtnText, { color: colors.textInverse }]}>Search</Text>
          )}
        </TouchableOpacity>

        {/* Results Section */}
        {hasSearched && (
          <View style={styles.resultsSection}>
            <Text style={[styles.resultsTitle, { color: colors.text }]}>Results ({results.length})</Text>

            {results.map((item) => (
              <TouchableOpacity
                key={item.domain}
                style={[styles.resultItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => handleInspectDomain(item)}
                activeOpacity={0.8}
              >
                <View style={styles.resultLeft}>
                  <DomainLogoImage
                    domainName={item.domain}
                    size={36}
                    borderRadius={10}
                  />
                  <View>
                    <Text style={[styles.domainNameText, { color: colors.text }]}>{item.domain}</Text>
                    <Text
                      style={[
                        styles.availText,
                        { color: item.available ? colors.emerald : colors.rose },
                      ]}
                    >
                      {item.available ? '● Available' : '● Registered'}
                    </Text>
                  </View>
                </View>

                <View style={styles.resultRight}>
                  {item.available && item.price && (
                    <Text style={[styles.priceTag, { color: colors.text }]}>
                      {item.currency || currencySymbol}{Math.round(item.price)}/yr
                    </Text>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.cartBtn,
                      {
                        backgroundColor: item.available ? colors.primary : colors.surfaceElevated,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => handleInspectDomain(item)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cartIcon}>{item.available ? '🛒' : 'ℹ️'}</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Domain Inspector / Registration Modal */}
      <Modal
        visible={!!selectedDomain}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedDomain(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 24) },
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                {selectedDomain && (
                  <DomainLogoImage
                    domainName={selectedDomain.domain}
                    size={40}
                    borderRadius={10}
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedDomain?.domain}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: selectedDomain?.available ? colors.emerald : colors.rose },
                      ]}
                    />
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: selectedDomain?.available ? colors.emerald : colors.rose,
                      }}
                    >
                      {selectedDomain?.available ? 'Available for Registration' : 'Registered Domain'}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity onPress={() => setSelectedDomain(null)} style={styles.modalCloseBtn}>
                <Text style={[styles.modalCloseText, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {selectedDomain?.available ? (
                /* Available Domain Registrar Prices */
                <View style={{ gap: 12 }}>
                  <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                    Official Registrar Registration Links
                  </Text>

                  {[
                    {
                      registrar: 'Namecheap',
                      price: `${currencySymbol}749/yr`,
                      note: 'Official Namecheap Checkout',
                      getUrl: (d: string) => `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(d)}`,
                    },
                    {
                      registrar: 'Hostinger',
                      price: `${currencySymbol}699/yr`,
                      note: 'Official Hostinger Domain Checkout',
                      getUrl: (d: string) => `https://www.hostinger.in/domain-checker?domain=${encodeURIComponent(d)}`,
                    },
                    {
                      registrar: 'GoDaddy',
                      price: `${currencySymbol}849/yr`,
                      note: 'Official GoDaddy Registrar',
                      getUrl: (d: string) => `https://in.godaddy.com/domainsearch/find?checkAvail=1&domainToCheck=${encodeURIComponent(d)}`,
                    },
                    {
                      registrar: 'Cloudflare Registrar',
                      price: `${currencySymbol}799/yr`,
                      note: 'At-cost pricing, zero markup',
                      getUrl: (_d: string) => 'https://www.cloudflare.com/products/registrar/',
                    },
                  ].map((r) => (
                    <TouchableOpacity
                      key={r.registrar}
                      style={[
                        styles.registrarCard,
                        {
                          backgroundColor: isDark ? colors.surfaceElevated : '#f8fafc',
                          borderColor: isDark ? colors.border : '#e2e8f0',
                        },
                      ]}
                      onPress={() => {
                        if (selectedDomain) {
                          openWebsiteInBrowser(r.getUrl(selectedDomain.domain));
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.registrarName, { color: colors.text }]}>{r.registrar}</Text>
                        <Text style={[styles.registrarNote, { color: colors.textMuted }]}>{r.note}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Text style={[styles.registrarPrice, { color: colors.primary }]}>{r.price}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563eb' }}>Register</Text>
                          <Ionicons name="open-outline" size={12} color="#2563eb" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                /* Registered Domain Real WHOIS / RDAP Details */
                <View style={{ gap: 10 }}>
                  <Text style={[styles.sectionHeading, { color: colors.textSecondary }]}>
                    Live ICANN RDAP &amp; DNS Inspection
                  </Text>

                  {isLoadingDetails ? (
                    <View style={[styles.whoisCard, { backgroundColor: isDark ? colors.surfaceElevated : '#f8fafc', borderColor: isDark ? colors.border : '#e2e8f0', padding: 24, alignItems: 'center' }]}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={{ marginTop: 8, fontSize: 13, color: colors.textSecondary }}>Fetching live RDAP and DNS records...</Text>
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.whoisCard,
                        {
                          backgroundColor: isDark ? colors.surfaceElevated : '#f8fafc',
                          borderColor: isDark ? colors.border : '#e2e8f0',
                        },
                      ]}
                    >
                      <View style={styles.whoisRow}>
                        <Text style={[styles.whoisLabel, { color: colors.textSecondary }]}>Registrar</Text>
                        <Text style={[styles.whoisValue, { color: colors.text, fontWeight: '700' }]}>
                          {liveDetails?.registrar || 'Authoritative Registry'}
                        </Text>
                      </View>
                      <View style={[styles.whoisDivider, { backgroundColor: isDark ? colors.border : '#e2e8f0' }]} />

                      {liveDetails?.registrationDate && (
                        <>
                          <View style={styles.whoisRow}>
                            <Text style={[styles.whoisLabel, { color: colors.textSecondary }]}>Created Date</Text>
                            <Text style={[styles.whoisValue, { color: colors.text }]}>{liveDetails.registrationDate}</Text>
                          </View>
                          <View style={[styles.whoisDivider, { backgroundColor: isDark ? colors.border : '#e2e8f0' }]} />
                        </>
                      )}

                      {liveDetails?.expirationDate && (
                        <>
                          <View style={styles.whoisRow}>
                            <Text style={[styles.whoisLabel, { color: colors.textSecondary }]}>Expires Date</Text>
                            <Text style={[styles.whoisValue, { color: colors.text }]}>{liveDetails.expirationDate}</Text>
                          </View>
                          <View style={[styles.whoisDivider, { backgroundColor: isDark ? colors.border : '#e2e8f0' }]} />
                        </>
                      )}

                      <View style={styles.whoisRow}>
                        <Text style={[styles.whoisLabel, { color: colors.textSecondary }]}>Nameservers</Text>
                        <Text style={[styles.whoisValue, { color: colors.text }]} numberOfLines={2}>
                          {liveDetails?.nameservers && liveDetails.nameservers.length > 0
                            ? liveDetails.nameservers.slice(0, 3).join('\n')
                            : 'Active DNS Zone'}
                        </Text>
                      </View>
                      <View style={[styles.whoisDivider, { backgroundColor: isDark ? colors.border : '#e2e8f0' }]} />

                      {liveDetails?.ip && (
                        <>
                          <View style={styles.whoisRow}>
                            <Text style={[styles.whoisLabel, { color: colors.textSecondary }]}>Resolved IP</Text>
                            <Text style={[styles.whoisValue, { color: colors.text }]}>{liveDetails.ip}</Text>
                          </View>
                          <View style={[styles.whoisDivider, { backgroundColor: isDark ? colors.border : '#e2e8f0' }]} />
                        </>
                      )}

                      <View style={styles.whoisRow}>
                        <Text style={[styles.whoisLabel, { color: colors.textSecondary }]}>Domain Status</Text>
                        <Text style={[styles.whoisValue, { color: '#16a34a' }]} numberOfLines={2}>
                          {liveDetails?.statuses && liveDetails.statuses.length > 0
                            ? liveDetails.statuses.slice(0, 2).join(', ')
                            : 'active / registered'}
                        </Text>
                      </View>
                      <View style={[styles.whoisDivider, { backgroundColor: isDark ? colors.border : '#e2e8f0' }]} />

                      <View style={styles.whoisRow}>
                        <Text style={[styles.whoisLabel, { color: colors.textSecondary }]}>DNSSEC</Text>
                        <Text style={[styles.whoisValue, { color: colors.text }]}>{liveDetails?.dnssec || 'Unsigned'}</Text>
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Action Buttons for Registered vs Available */}
              {!selectedDomain?.available ? (
                <View style={{ gap: 8, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: '#2563eb', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
                    onPress={() => {
                      if (selectedDomain) openWebsiteInBrowser(`https://${selectedDomain.domain}`);
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="globe-outline" size={17} color="#ffffff" />
                    <Text style={styles.modalActionBtnText}>Open Live Website</Text>
                    <Ionicons name="open-outline" size={15} color="#ffffff" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalActionBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderColor: isDark ? '#334155' : '#e2e8f0', borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }]}
                    onPress={async () => {
                      if (selectedDomain) {
                        await createDomain({ name: selectedDomain.domain });
                        setSelectedDomain(null);
                        router.push({ pathname: '/domain/[id]', params: { id: selectedDomain.domain } });
                      }
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="add-circle-outline" size={17} color={colors.text} />
                    <Text style={[styles.modalActionBtnText, { color: colors.text }]}>Add &amp; Monitor in Portfolio</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.modalActionBtn, { backgroundColor: '#2563eb', marginTop: 12 }]}
                  onPress={() => {
                    if (selectedDomain) {
                      openWebsiteInBrowser(`https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(selectedDomain.domain)}`);
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalActionBtnText}>Register on Namecheap</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </View>
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
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 28,
    fontWeight: '300',
  },
  headerTitle: {
    ...Typography.titleMedium,
    fontWeight: '800',
    fontSize: 20,
  },
  placeholder: {
    width: 32,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.bodyLarge,
  },
  clearIcon: {
    fontSize: 14,
    padding: 4,
  },
  tldsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  tldPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  tldPillText: {
    ...Typography.bodyMedium,
    fontWeight: '600',
  },
  searchBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.sm,
  },
  searchBtnText: {
    ...Typography.bodyLarge,
    fontWeight: '700',
  },
  resultsSection: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  resultsTitle: {
    ...Typography.titleSmall,
    fontWeight: '800',
    marginBottom: Spacing.xs,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  resultLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  resultIconBox: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIcon: {
    fontSize: 20,
  },
  domainNameText: {
    ...Typography.bodyLarge,
    fontWeight: '700',
  },
  availText: {
    ...Typography.caption,
    fontWeight: '600',
    marginTop: 2,
  },
  resultRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  priceTag: {
    ...Typography.bodyMedium,
    fontWeight: '700',
  },
  cartBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartIcon: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(226, 232, 240, 0.4)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalBody: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  registrarCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  registrarName: {
    fontSize: 14,
    fontWeight: '700',
  },
  registrarNote: {
    fontSize: 11,
    marginTop: 2,
  },
  registrarPrice: {
    fontSize: 15,
    fontWeight: '800',
  },
  whoisCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 8,
  },
  whoisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  whoisLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  whoisValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  whoisDivider: {
    height: 1,
  },
  modalActionBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
