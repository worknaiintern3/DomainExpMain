import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius, Spacing, Typography } from '../../constants/theme';
import { useTheme } from '../../store/theme-context';
import { useAuth } from '../../store/auth-context';
import {
  fetchApplicationsList,
  createApplication,
  updateApplication,
  deleteApplication,
  pingApplication,
  getConsoleAccount,
  type ConsoleAccountConfig,
} from '../../services/applications';
import { syncConsoleAccount } from '../../services/providerSync';
import {
  fetchWebsitesList,
  createWebsite,
  updateWebsite,
  deleteWebsite,
  openWebsiteInBrowser,
  normalizeWebsiteUrl,
  extractDomainFromUrl,
} from '../../services/websites';
import { getDomainLogoUrl } from '../../services/liveDomainLookup';
import type { ApplicationItem, WebsiteItem } from '../../types';

function formatAppUpdatedDate(dateStr?: string): string {
  if (!dateStr) return 'Google Play Console';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Google Play Console';
    return `Updated ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  } catch {
    return 'Google Play Console';
  }
}

const PLAY_STORE_LOCAL_ICON = require('../../../assets/images/google-play.png');

const REAL_APP_ICONS: Record<string, any> = {
  'com.aitourism': require('../../../assets/images/app-icons/com_aitourism.png'),
  'com.anyworkservices.app': require('../../../assets/images/app-icons/com_anyworkservices_app.png'),
  'com.blooddonation.online': require('../../../assets/images/app-icons/com_blooddonation_online.png'),
  'com.goairclass.onlinego': require('../../../assets/images/app-icons/com_goairclass_onlinego.png'),
  'com.goairclass.app': require('../../../assets/images/app-icons/goairclass.png'),
  'com.livesale.fitness': require('../../../assets/images/app-icons/com_livesale_fitness.png'),
  'com.healthyfood.cafe': require('../../../assets/images/app-icons/com_healthyfood_cafe.png'),
  'com.app.itjobx.com': require('../../../assets/images/app-icons/com_app_itjobx_com.png'),
  'com.inquiryexperts.app': require('../../../assets/images/app-icons/inquiryexperts.png'),
  'com.lovenzea.online': require('../../../assets/images/app-icons/com_lovenzea_online.png'),
  'com.worknai.mobilepaycafe': require('../../../assets/images/app-icons/com_worknai_mobilepaycafe.png'),
  'com.mobilepay.service': require('../../../assets/images/app-icons/com_worknai_mobilepaycafe.png'),
  'com.worknai.namasteyyy': require('../../../assets/images/app-icons/com_worknai_namasteyyy.png'),
  'com.namastemeditation.app': require('../../../assets/images/app-icons/com_worknai_namasteyyy.png'),
  'com.chessApp.WorknAi': require('../../../assets/images/app-icons/com_chessApp_WorknAi.png'),
  'com.onlinechess.game': require('../../../assets/images/app-icons/com_chessApp_WorknAi.png'),
  'com.mantis.onlinego': require('../../../assets/images/app-icons/com_mantis_onlinego.png'),
  'com.worknai.onlinego': require('../../../assets/images/app-icons/com_mantis_onlinego.png'),
  'com.onlinegologistics': require('../../../assets/images/app-icons/com_onlinegologistics.png'),
  'com.onlinego.logistics': require('../../../assets/images/app-icons/com_onlinegologistics.png'),
  'com.pginfo.onlinee': require('../../../assets/images/app-icons/com_pginfo_onlinee.png'),
  'com.pginfo.hostel': require('../../../assets/images/app-icons/com_pginfo_onlinee.png'),
  'com.worknai.hrms': require('../../../assets/images/app-icons/com_worknai_hrms.png'),
  'com.worknai': require('../../../assets/images/app-icons/worknaiclient.png'),
};

const DOMAIN_TO_APP_ICON: Record<string, any> = {
  'worknai.com': REAL_APP_ICONS['com.worknai'],
  'hrms.worknai.com': REAL_APP_ICONS['com.worknai.hrms'],
  'aitourism.in': REAL_APP_ICONS['com.aitourism'],
  'aitourism.com': REAL_APP_ICONS['com.aitourism'],
  'anyworkservices.com': REAL_APP_ICONS['com.anyworkservices.app'],
  'blooddonation.online': REAL_APP_ICONS['com.blooddonation.online'],
  'goairclass.online': REAL_APP_ICONS['com.goairclass.onlinego'],
  'goairclass.app': REAL_APP_ICONS['com.goairclass.app'],
  'gymproplus.com': REAL_APP_ICONS['com.livesale.fitness'],
  'healthyfood.cafe': REAL_APP_ICONS['com.healthyfood.cafe'],
  'itjobx.com': REAL_APP_ICONS['com.app.itjobx.com'],
  'inquiryexperts.app': REAL_APP_ICONS['com.inquiryexperts.app'],
  'inquiryexperts.com': REAL_APP_ICONS['com.inquiryexperts.app'],
  'lovenzea.online': REAL_APP_ICONS['com.lovenzea.online'],
  'mobilepay.cafe': REAL_APP_ICONS['com.worknai.mobilepaycafe'],
  'namasteyyy.com': REAL_APP_ICONS['com.worknai.namasteyyy'],
  'omenxis.com': REAL_APP_ICONS['com.chessApp.WorknAi'],
  'onlinego.in': REAL_APP_ICONS['com.mantis.onlinego'],
  'onlinegologistics.com': REAL_APP_ICONS['com.onlinegologistics'],
  'pginfo.online': REAL_APP_ICONS['com.pginfo.onlinee'],
};

function getWebsiteOfficialIcon(site: WebsiteItem) {
  const domain = extractDomainFromUrl(site.url || '');
  if (DOMAIN_TO_APP_ICON[domain]) return DOMAIN_TO_APP_ICON[domain];

  const key = (domain + ' ' + (site.name || '')).toLowerCase();
  if (key.includes('worknai') && key.includes('hrms')) return REAL_APP_ICONS['com.worknai.hrms'];
  if (key.includes('worknai')) return REAL_APP_ICONS['com.worknai'];
  if (key.includes('aitourism') || key.includes('tourism')) return REAL_APP_ICONS['com.aitourism'];
  if (key.includes('anywork')) return REAL_APP_ICONS['com.anyworkservices.app'];
  if (key.includes('blood')) return REAL_APP_ICONS['com.blooddonation.online'];
  if (key.includes('goair') || key.includes('airclass')) return REAL_APP_ICONS['com.goairclass.onlinego'];
  if (key.includes('gym') || key.includes('fitness')) return REAL_APP_ICONS['com.livesale.fitness'];
  if (key.includes('healthyfood') || key.includes('healthy food')) return REAL_APP_ICONS['com.healthyfood.cafe'];
  if (key.includes('itjob') || key.includes('it job')) return REAL_APP_ICONS['com.app.itjobx.com'];
  if (key.includes('inquiry')) return REAL_APP_ICONS['com.inquiryexperts.app'];
  if (key.includes('lovenzea')) return REAL_APP_ICONS['com.lovenzea.online'];
  if (key.includes('mobilepay') || key.includes('mobile pay')) return REAL_APP_ICONS['com.worknai.mobilepaycafe'];
  if (key.includes('namaste')) return REAL_APP_ICONS['com.worknai.namasteyyy'];
  if (key.includes('chess') || key.includes('omenxis')) return REAL_APP_ICONS['com.chessApp.WorknAi'];
  if (key.includes('onlinegologistics') || key.includes('logistics')) return REAL_APP_ICONS['com.onlinegologistics'];
  if (key.includes('onlinego') || key.includes('online go')) return REAL_APP_ICONS['com.mantis.onlinego'];
  if (key.includes('pginfo')) return REAL_APP_ICONS['com.pginfo.onlinee'];

  return null;
}

const BRAND_CATALOG: Record<string, { name: string; packageId: string; playStoreUrl: string; url?: string; domain?: string; iconUrl?: string }> = {
  redbus: {
    name: 'redBus: Bus & Train Booking',
    packageId: 'in.redbus.android',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=in.redbus.android',
    url: 'https://redbus.in',
    domain: 'redbus.in',
    iconUrl: 'https://play-lh.googleusercontent.com/43E5nFgmkuKssO6qMp8RVnhQFDKVUWiRj4onvTASAFV38f7UI1ywQ0xYRhq4CLVc2sWf8Glm8GRS5n4lj-aFyIg=s512',
  },
  zomato: {
    name: 'Zomato: Food Delivery & Dining',
    packageId: 'com.application.zomato',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.application.zomato',
    url: 'https://zomato.com',
    domain: 'zomato.com',
    iconUrl: 'https://play-lh.googleusercontent.com/F3A40FhcqC9fAoPeYpC_olDg2Upkq1UsylJCvmZmB7a26R0S6L-2Zo35-exR8n-__0M-uFTHq3T_nbS9oxDQ15w=s512',
  },
  swiggy: {
    name: 'Swiggy: Food & Instamart',
    packageId: 'in.swiggy.android',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=in.swiggy.android',
    url: 'https://swiggy.com',
    domain: 'swiggy.com',
    iconUrl: 'https://play-lh.googleusercontent.com/FJ5W5ygiN-DYfpd2-3LqyN5F-OxDtQ7z_9v5nAeD4vOrN8kQitoOwULactKgKvktXowVEM491wE-unmGmnt8OWM=s512',
  },
  flipkart: {
    name: 'Flipkart Online Shopping',
    packageId: 'com.flipkart.android',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.flipkart.android',
    url: 'https://flipkart.com',
    domain: 'flipkart.com',
    iconUrl: 'https://play-lh.googleusercontent.com/mlWjVjxflQoYJHBBgDQ08FqT8i3KnDG__2RH8P-GWOKlEPAIo8TllTZo3HDQ3J5zlO6oAhc1FAv0Bf2on0wL8w=s512',
  },
  amazon: {
    name: 'Amazon India Shopping',
    packageId: 'in.amazon.mShop.android.shopping',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=in.amazon.mShop.android.shopping',
    url: 'https://amazon.in',
    domain: 'amazon.in',
    iconUrl: 'https://play-lh.googleusercontent.com/E2Nyw1kSrYFvi5DFOznWOR2iXY9mwxwfYHXV37aLHmuKtEW3gs7StIvVptoV2x8_ykiHQQmliwpfDsFm0Quuwbk=s512',
  },
  paytm: {
    name: 'Paytm: Payments & UPI',
    packageId: 'net.one97.paytm',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=net.one97.paytm',
    url: 'https://paytm.com',
    domain: 'paytm.com',
    iconUrl: 'https://play-lh.googleusercontent.com/WDGsMRuVENnZPEpV4DEaXw12qtMY3em85xpmZqcXzeh0iT_eXFtAU9VUj-Z7xNQQd5DMqrkKSs9D0qbI1rlt=s512',
  },
  phonepe: {
    name: 'PhonePe: UPI & Payments',
    packageId: 'com.phonepe.app',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.phonepe.app',
    url: 'https://phonepe.com',
    domain: 'phonepe.com',
    iconUrl: 'https://play-lh.googleusercontent.com/ARGoCZk-5QCKPpyTsGhn1WahhPbVMa95T1U7clwnI8gjtW-YNY96rAANqFkuENbU35IbYF2Gjg2UjZXA495x0A=s512',
  },
  uber: {
    name: 'Uber: Request a ride',
    packageId: 'com.ubercab',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.ubercab',
    url: 'https://uber.com',
    domain: 'uber.com',
    iconUrl: 'https://play-lh.googleusercontent.com/OXQnDlRtPa5ha6KCnKPqVmxHYBP7tjrAa7PXGNRqcwDC_J03HVeuEKcKrkcIqnfOqsF5uy3uwWxIXR067QHsNQ=s512',
  },
  ola: {
    name: 'Ola Cabs: Book Ride & Auto',
    packageId: 'com.olacabs.customer',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.olacabs.customer',
    url: 'https://olacabs.com',
    domain: 'olacabs.com',
    iconUrl: 'https://play-lh.googleusercontent.com/X2EES6J1Q6cf18gTsBX-yWvsLrDm31TjwjwbSGE8t8w-v1uEIpHDNExfTF3tw_bbOqeRuYZhPg5mOu-kLWKhJ64=s512',
  },
  spotify: {
    name: 'Spotify: Music and Podcasts',
    packageId: 'com.spotify.music',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.spotify.music',
    url: 'https://spotify.com',
    domain: 'spotify.com',
    iconUrl: 'https://play-lh.googleusercontent.com/IzQgYCcnCFCD08GR-3bdtcT8xzOvrNkC84avGT5CwTX2VIqmTmKKJcP_Cd4JoBOdmCMlTndlOzV6hrthg2fOWA=s512',
  },
  netflix: {
    name: 'Netflix',
    packageId: 'com.netflix.mediaclient',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.netflix.mediaclient',
    url: 'https://netflix.com',
    domain: 'netflix.com',
    iconUrl: 'https://play-lh.googleusercontent.com/fXVS45nukV1x9PYVSKHkCQK0QGCOishIvAOxIZS3sgRem8HS7l9l94_Ggj-WZPrTLePRdNYN4pp4SPAQL7oS0PU=s512',
  },
  google: {
    name: 'Google',
    packageId: 'com.google.android.googlequicksearchbox',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.google.android.googlequicksearchbox',
    url: 'https://google.com',
    domain: 'google.com',
    iconUrl: 'https://www.google.com/favicon.ico',
  },
  whatsapp: {
    name: 'WhatsApp Messenger',
    packageId: 'com.whatsapp',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.whatsapp',
    url: 'https://whatsapp.com',
    domain: 'whatsapp.com',
    iconUrl: 'https://play-lh.googleusercontent.com/Gqxk4T0uZsDwFp07DE-508hkyvcNmgFuRwPiwTEfF7D7OzGv1FdHDzEyMxNsSBZLOJlGpe3ULvVM2RgrRAlBqA=s512',
  },
  instagram: {
    name: 'Instagram',
    packageId: 'com.instagram.android',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.instagram.android',
    url: 'https://instagram.com',
    domain: 'instagram.com',
    iconUrl: 'https://play-lh.googleusercontent.com/yHi59jmO_lVamcyJ1i3rM1_E8bAiAspShnGjjURq05ipQQSUksO3QVEsXTegRSqul038-4YNA7O644XAcx251Q=s512',
  },
  zepto: {
    name: 'Zepto: 10-Min Delivery',
    packageId: 'com.zeptonow',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.zeptonow',
    url: 'https://zeptonow.com',
    domain: 'zeptonow.com',
    iconUrl: 'https://www.google.com/s2/favicons?domain=zeptonow.com&sz=256',
  },
  blinkit: {
    name: 'Blinkit: Grocery in minutes',
    packageId: 'com.grofers.customerapp',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.grofers.customerapp',
    url: 'https://blinkit.com',
    domain: 'blinkit.com',
    iconUrl: 'https://play-lh.googleusercontent.com/dY1ryTjOaVsnslxvNamNvSBulmDUkvW5f5FJ_HDApMfecSOIxjCafpNAv4LTG8TJVyp0XR9tAAaRI4K77Eiqfg=s512',
  },
  makemytrip: {
    name: 'MakeMyTrip: Flight & Hotel',
    packageId: 'com.makemytrip',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.makemytrip',
    url: 'https://makemytrip.com',
    domain: 'makemytrip.com',
    iconUrl: 'https://play-lh.googleusercontent.com/_dXIQDuR0zm2GVbcPla3IQMTmCIh-6bDKNZ1jELwTn82BWrkmte-EZDKiAJ7qigppAyYqUEf8Zf74cvVKzjKZA=s512',
  },
  bookmyshow: {
    name: 'BookMyShow: Movies & Events',
    packageId: 'com.bt.bms',
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.bt.bms',
    url: 'https://bookmyshow.com',
    domain: 'bookmyshow.com',
    iconUrl: 'https://play-lh.googleusercontent.com/TB_8RMvDjxGmx06LBK-8opRFJ0msb6hSZalEtOMBmxgJ4jYE_i0BmdRuMWChCE76tLnxoytZ75Cew_r0_JDd=s512',
  },
};

function GooglePlayStoreIcon({ size = 24 }: { size?: number }) {
  const [loadError, setLoadError] = useState(false);

  if (loadError) {
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: size * 0.75, fontWeight: '900', color: '#0086F8' }}>▶</Text>
      </View>
    );
  }

  return (
    <Image
      source={PLAY_STORE_LOCAL_ICON}
      style={{ width: size, height: size }}
      resizeMode="contain"
      onError={() => setLoadError(true)}
    />
  );
}

function ProfessionalAppIcon({ app, size = 48 }: { app: ApplicationItem; size?: number }) {
  const [urlIndex, setUrlIndex] = useState(0);

  useEffect(() => {
    setUrlIndex(0);
  }, [app.url, app.packageId, app.iconUrl, app.name]);

  const isRejected = app.status === 'error' || app.releaseTrack?.toLowerCase().includes('rejected');
  const isDraft =
    app.releaseTrack?.toLowerCase().includes('draft') ||
    app.releaseTrack?.toLowerCase().includes('unpublished') ||
    app.releaseTrack?.toLowerCase().includes('review');

  const pkg = (app.packageId || '').toLowerCase();
  const localIcon = REAL_APP_ICONS[app.packageId || ''] || REAL_APP_ICONS[pkg];

  // Derive domain and brand icon safely
  let domain = app.url ? extractDomainFromUrl(app.url) : '';
  let brandIconUrl = '';
  const domainLower = domain.toLowerCase();
  const nameLower = (app.name || '').toLowerCase();

  for (const [key, b] of Object.entries(BRAND_CATALOG)) {
    if (
      (pkg && b.packageId.toLowerCase() === pkg) ||
      (domainLower && b.domain && domainLower === b.domain.toLowerCase()) ||
      (nameLower.length >= 3 && nameLower.includes(key))
    ) {
      if (b.domain) domain = b.domain;
      if (b.iconUrl) brandIconUrl = b.iconUrl;
      break;
    }
  }

  const sources: any[] = [];
  if (localIcon) sources.push(localIcon);
  if (brandIconUrl) sources.push({ uri: brandIconUrl });
  if (app.iconUrl && !app.iconUrl.includes('google.com/s2/favicons') && !app.iconUrl.includes('clearbit')) {
    sources.push({ uri: app.iconUrl });
  }
  if (domain) {
    sources.push({ uri: `https://www.google.com/s2/favicons?domain=${domain}&sz=256` });
    sources.push({ uri: `https://icons.duckduckgo.com/ip3/${domain}.ico` });
  }
  if (app.iconUrl) {
    sources.push({ uri: app.iconUrl });
  }

  const currentSource = sources[urlIndex] || null;

  return (
    <View style={{ position: 'relative' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.22),
          overflow: 'hidden',
          backgroundColor: '#0f172a',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        {currentSource ? (
          <Image
            source={currentSource}
            style={{ width: size, height: size }}
            resizeMode="cover"
            onError={() => {
              if (urlIndex < sources.length - 1) {
                setUrlIndex(urlIndex + 1);
              } else {
                setUrlIndex(sources.length);
              }
            }}
          />
        ) : (
          <View
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#0f172a',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="apps" size={Math.round(size * 0.48)} color="#38bdf8" />
          </View>
        )}
      </View>

      {/* Live Status Pip */}
      <View
        style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          width: 12,
          height: 12,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: '#ffffff',
          backgroundColor: isRejected ? '#ef4444' : isDraft ? '#f59e0b' : '#10b981',
        }}
      />
    </View>
  );
}

function ProfessionalWebsiteIcon({ site, size = 48 }: { site: WebsiteItem; size?: number }) {
  const [urlIndex, setUrlIndex] = useState(0);

  useEffect(() => {
    setUrlIndex(0);
  }, [site.url, site.logoUrl, site.name]);

  const domain = extractDomainFromUrl(site.url || '');
  const localIcon = getWebsiteOfficialIcon(site);

  let brandIconUrl = '';
  const domainLower = domain.toLowerCase();
  const nameLower = (site.name || '').toLowerCase();

  for (const [key, b] of Object.entries(BRAND_CATALOG)) {
    if (
      (domainLower && b.domain && domainLower === b.domain.toLowerCase()) ||
      (nameLower.length >= 3 && nameLower.includes(key))
    ) {
      if (b.iconUrl) brandIconUrl = b.iconUrl;
      break;
    }
  }

  const sources: any[] = [];
  if (localIcon) sources.push(localIcon);
  if (brandIconUrl) sources.push({ uri: brandIconUrl });
  if (site.logoUrl && !site.logoUrl.includes('clearbit')) sources.push({ uri: site.logoUrl });
  if (domain) {
    sources.push({ uri: `https://www.google.com/s2/favicons?domain=${domain}&sz=256` });
    sources.push({ uri: `https://icons.duckduckgo.com/ip3/${domain}.ico` });
  }

  const currentSource = sources[urlIndex] || null;

  return (
    <View style={{ position: 'relative' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: Math.round(size * 0.22),
          overflow: 'hidden',
          backgroundColor: '#0f172a',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        {currentSource ? (
          <Image
            source={currentSource}
            style={{ width: size, height: size }}
            resizeMode="cover"
            onError={() => {
              if (urlIndex < sources.length - 1) {
                setUrlIndex(urlIndex + 1);
              } else {
                setUrlIndex(sources.length);
              }
            }}
          />
        ) : (
          <View
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#0f172a',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="globe-outline" size={Math.round(size * 0.48)} color="#38bdf8" />
          </View>
        )}
      </View>

      {/* Live SSL Status Pip */}
      <View
        style={{
          position: 'absolute',
          bottom: -2,
          right: -2,
          width: 12,
          height: 12,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: '#ffffff',
          backgroundColor: '#10b981',
        }}
      />
    </View>
  );
}

const WEBSITE_CATEGORIES = ['All', 'Production', 'Client', 'Personal', 'Staging', 'Tools'] as const;

export default function ApplicationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const params = useLocalSearchParams<{ section?: string }>();
  // Top Section Switcher: 'apps' | 'websites'
  const [activeSection, setActiveSection] = useState<'apps' | 'websites'>(
    params.section === 'websites' ? 'websites' : 'apps'
  );

  useEffect(() => {
    if (params.section === 'websites') {
      setActiveSection('websites');
    } else if (params.section === 'apps') {
      setActiveSection('apps');
    }
  }, [params.section]);

  // Apps State
  const [apps, setApps] = useState<ApplicationItem[]>([]);
  const [appFilter, setAppFilter] = useState<'All' | 'Production' | 'Review' | 'Issues'>('All');
  const [showAddAppModal, setShowAddAppModal] = useState(false);
  const [editingApp, setEditingApp] = useState<ApplicationItem | null>(null);
  const [selectedAppMenu, setSelectedAppMenu] = useState<ApplicationItem | null>(null);

  // Websites State
  const [websites, setWebsites] = useState<WebsiteItem[]>([]);
  const [webCategoryFilter, setWebCategoryFilter] = useState<string>('All');
  const [showAddWebModal, setShowAddWebModal] = useState(false);
  const [editingWebsite, setEditingWebsite] = useState<WebsiteItem | null>(null);
  const [selectedWebMenu, setSelectedWebMenu] = useState<WebsiteItem | null>(null);

  // Search & Global state
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Google Play Console State
  const [consoleAccount, setConsoleAccount] = useState<ConsoleAccountConfig | null>(null);
  const [isConsoleModalOpen, setIsConsoleModalOpen] = useState(false);
  const [consoleDevName, setConsoleDevName] = useState('WorknAi Technologies India Pvt Ltd');
  const [consolePackageIds, setConsolePackageIds] = useState('');
  const [isSyncingConsole, setIsSyncingConsole] = useState(false);

  // Manual Form State for Apps
  const [formName, setFormName] = useState('');
  const [formEnv, setFormEnv] = useState<'Production' | 'Staging' | 'Development'>('Production');
  const [formUrl, setFormUrl] = useState('');
  const [formServer, setFormServer] = useState('');
  const [formPackageId, setFormPackageId] = useState('');

  // Form State for Websites
  const [webFormName, setWebFormName] = useState('');
  const [webFormUrl, setWebFormUrl] = useState('');
  const [webFormCategory, setWebFormCategory] = useState<'Production' | 'Client' | 'Personal' | 'Staging' | 'Tools'>('Production');
  const [webFormNotes, setWebFormNotes] = useState('');

  // Feedback Modal
  const [feedbackModal, setFeedbackModal] = useState<{
    visible: boolean;
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  } | null>(null);

  const showFeedback = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setFeedbackModal({ visible: true, title, message, type });
  };

  const loadData = useCallback(async () => {
    try {
      const [appList, webList, consoleCfg] = await Promise.all([
        fetchApplicationsList(),
        fetchWebsitesList(),
        getConsoleAccount(),
      ]);

      if (consoleCfg) {
        setConsoleAccount(consoleCfg);
        if (!consoleDevName || consoleDevName === 'WorknAi Technologies India Pvt Ltd') {
          setConsoleDevName(consoleCfg.developerName);
        }
      }

      // Safely upgrade verified brand applications if exact packageId matches
      const verifiedApps = appList.map((app) => {
        const pkg = (app.packageId || '').toLowerCase();
        for (const [, b] of Object.entries(BRAND_CATALOG)) {
          if (pkg && pkg === b.packageId.toLowerCase()) {
            if (b.iconUrl && (!app.iconUrl || app.iconUrl.includes('google.com/s2/favicons') || app.iconUrl.includes('clearbit'))) {
              return { ...app, iconUrl: b.iconUrl, playStoreUrl: app.playStoreUrl || b.playStoreUrl };
            }
          }
        }
        return app;
      });

      setApps(verifiedApps);
      setWebsites(webList);
    } catch (e) {
      // silently fallback
    }
  }, [consoleDevName]);

  const handleSyncConsole = async (overrideName?: string) => {
    const nameToUse = (overrideName || consoleDevName).trim();
    if (!nameToUse) {
      showFeedback('Missing Name', 'Please enter your Google Play developer console name.', 'error');
      return;
    }
    setIsSyncingConsole(true);
    try {
      const pkgs = consolePackageIds
        .split(/[\n,]+/)
        .map((p) => p.trim())
        .filter(Boolean);

      const result = await syncConsoleAccount({
        developerName: nameToUse,
        packageIds: pkgs.length > 0 ? pkgs : undefined,
      });

      setConsoleAccount({
        developerName: nameToUse,
        connectedAt: new Date().toISOString(),
        autoSync: true,
      });
      setIsConsoleModalOpen(false);
      await loadData();
      showFeedback(
        'Console Synced!',
        `Successfully fetched ${result.syncedCount} apps from "${nameToUse}". All applications are now live in your workspace!`,
        'success'
      );
    } catch (err: any) {
      showFeedback('Sync Error', err?.message || 'Failed to sync console applications.', 'error');
    } finally {
      setIsSyncingConsole(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ---------------------------------------------------------------------------
  // APPS METRICS & FILTERING
  // ---------------------------------------------------------------------------
  const totalAppsCount = apps.length;
  const prodAppsCount = useMemo(
    () => apps.filter((a) => a.releaseTrack === 'Production' && a.status === 'healthy').length,
    [apps]
  );
  const reviewAppsCount = useMemo(
    () =>
      apps.filter(
        (a) =>
          a.releaseTrack?.toLowerCase().includes('draft') ||
          a.releaseTrack?.toLowerCase().includes('review') ||
          a.releaseTrack?.toLowerCase().includes('unpublished')
      ).length,
    [apps]
  );
  const issuesAppsCount = useMemo(
    () => apps.filter((a) => a.status === 'error' || a.releaseTrack?.toLowerCase().includes('rejected')).length,
    [apps]
  );

  const filteredApps = useMemo(() => {
    return apps.filter((a) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        a.name.toLowerCase().includes(query) ||
        (a.packageId && a.packageId.toLowerCase().includes(query)) ||
        (a.developerName && a.developerName.toLowerCase().includes(query)) ||
        (a.releaseTrack && a.releaseTrack.toLowerCase().includes(query));

      if (appFilter === 'Production') return matchesSearch && a.releaseTrack === 'Production' && a.status === 'healthy';
      if (appFilter === 'Review') {
        return (
          matchesSearch &&
          (a.releaseTrack?.toLowerCase().includes('draft') ||
            a.releaseTrack?.toLowerCase().includes('review') ||
            a.releaseTrack?.toLowerCase().includes('unpublished'))
        );
      }
      if (appFilter === 'Issues') {
        return matchesSearch && (a.status === 'error' || a.releaseTrack?.toLowerCase().includes('rejected'));
      }
      return matchesSearch;
    });
  }, [apps, searchQuery, appFilter]);

  // ---------------------------------------------------------------------------
  // WEBSITES METRICS & FILTERING
  // ---------------------------------------------------------------------------
  const totalWebsitesCount = websites.length;
  const prodWebsitesCount = useMemo(
    () => websites.filter((w) => w.category === 'Production').length,
    [websites]
  );
  const clientWebsitesCount = useMemo(
    () => websites.filter((w) => w.category === 'Client').length,
    [websites]
  );
  const personalWebsitesCount = useMemo(
    () => websites.filter((w) => w.category === 'Personal').length,
    [websites]
  );

  const filteredWebsites = useMemo(() => {
    return websites.filter((w) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        w.name.toLowerCase().includes(query) ||
        w.url.toLowerCase().includes(query) ||
        (w.category && w.category.toLowerCase().includes(query)) ||
        (w.notes && w.notes.toLowerCase().includes(query));

      if (webCategoryFilter !== 'All') {
        return matchesSearch && (w.category || '').toLowerCase() === webCategoryFilter.toLowerCase();
      }
      return matchesSearch;
    });
  }, [websites, searchQuery, webCategoryFilter]);

  // ---------------------------------------------------------------------------
  // APP HANDLERS
  // ---------------------------------------------------------------------------
  const openAddAppModal = () => {
    setFormName('');
    setFormEnv('Production');
    setFormUrl('');
    setFormServer('Google Play Console');
    setFormPackageId('');
    setShowAddAppModal(true);
  };

  const openEditAppModal = (app: ApplicationItem) => {
    setEditingApp(app);
    setFormName(app.name);
    setFormEnv(app.environment);
    setFormUrl(app.url || app.playStoreUrl || '');
    setFormServer(app.serverName || '');
    setFormPackageId(app.packageId || '');
    setSelectedAppMenu(null);
  };

  const handleSaveApp = async () => {
    let cleanPackageId = formPackageId.trim();
    const rawUrl = formUrl.trim();

    // Auto-extract packageId if user pasted a Play Store URL in either field
    if (cleanPackageId.includes('id=')) {
      const match = cleanPackageId.match(/id=([a-zA-Z0-9._]+)/);
      if (match && match[1]) cleanPackageId = match[1];
    } else if (!cleanPackageId && rawUrl.includes('id=')) {
      const match = rawUrl.match(/id=([a-zA-Z0-9._]+)/);
      if (match && match[1]) cleanPackageId = match[1];
    }

    const cleanUrl = rawUrl ? normalizeWebsiteUrl(rawUrl) : '';
    const extractedDomain = cleanUrl ? extractDomainFromUrl(cleanUrl) : '';
    let cleanName = formName.trim();

    // Safe, exact brand matching
    let matchedBrand: (typeof BRAND_CATALOG)[string] | null = null;
    const pkgLower = cleanPackageId.toLowerCase();
    const domainLower = extractedDomain.toLowerCase();
    const nameLower = cleanName.toLowerCase();

    for (const [key, b] of Object.entries(BRAND_CATALOG)) {
      if (pkgLower && b.packageId.toLowerCase() === pkgLower) {
        matchedBrand = b;
        break;
      }
      if (domainLower && b.domain && domainLower === b.domain.toLowerCase()) {
        matchedBrand = b;
        break;
      }
      if (nameLower.length >= 3 && nameLower.includes(key)) {
        matchedBrand = b;
        break;
      }
    }

    if (!cleanPackageId && matchedBrand) {
      cleanPackageId = matchedBrand.packageId;
    }

    if (!cleanName) {
      if (matchedBrand) {
        cleanName = matchedBrand.name;
      } else if (cleanPackageId) {
        const parts = cleanPackageId.split('.');
        const lastPart = parts[parts.length - 1] || 'App';
        cleanName = lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
      } else if (extractedDomain) {
        cleanName = extractedDomain.replace(/^www\./, '');
      } else {
        showFeedback('Missing Information', 'Please provide a name, package ID, or URL.', 'error');
        return;
      }
    }

    const playStoreUrl = cleanPackageId
      ? `https://play.google.com/store/apps/details?id=${cleanPackageId}`
      : matchedBrand?.playStoreUrl || `https://play.google.com/store/search?q=${encodeURIComponent(cleanName)}&c=apps`;

    const appWebUrl = cleanUrl || matchedBrand?.url;
    const appIconUrl = matchedBrand?.iconUrl || (extractedDomain ? `https://www.google.com/s2/favicons?domain=${extractedDomain}&sz=256` : undefined);

    setIsSubmitting(true);
    try {
      if (editingApp) {
        const updated = await updateApplication(editingApp.id, {
          name: cleanName,
          environment: formEnv,
          url: appWebUrl || undefined,
          serverName: formServer.trim() || undefined,
          packageId: cleanPackageId || undefined,
          playStoreUrl,
          iconUrl: appIconUrl,
        });
        if (updated) {
          setApps((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        }
        setEditingApp(null);
        setShowAddAppModal(false);
        showFeedback('Application Updated', `"${cleanName}" has been updated.`, 'success');
      } else {
        const created = await createApplication({
          name: cleanName,
          environment: formEnv,
          url: appWebUrl || undefined,
          serverName: formServer.trim() || undefined,
          packageId: cleanPackageId || undefined,
          playStoreUrl,
          iconUrl: appIconUrl,
        });
        if (created) {
          setApps((prev) => [created, ...prev.filter((a) => a.id !== created.id)]);
        }
        setShowAddAppModal(false);
        setEditingApp(null);
        showFeedback('Application Created', `"${cleanName}" is now monitored.`, 'success');
      }
      await loadData();
    } catch (err: any) {
      showFeedback('Save Failed', err?.message || 'Could not save application.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteApp = async (app: ApplicationItem) => {
    try {
      await deleteApplication(app.id);
      setSelectedAppMenu(null);
      setApps((prev) => prev.filter((a) => a.id !== app.id));
      showFeedback('Application Removed', `"${app.name}" was removed from your portfolio.`, 'info');
    } catch (err: any) {
      showFeedback('Delete Failed', err?.message || 'Could not delete application.', 'error');
    }
  };

  const handleOpenUrl = (url?: string) => {
    if (!url) return;
    const cleanUrl = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(cleanUrl).catch(() => {
      showFeedback('Invalid Link', `Could not open ${cleanUrl}`, 'error');
    });
  };

  const handleShareApp = (app: ApplicationItem) => {
    const link = app.playStoreUrl || app.url || `https://play.google.com/store/apps/details?id=${app.packageId}`;
    Share.share({
      title: app.name,
      message: `${app.name}\nPackage ID: ${app.packageId}\n\n${link}`,
    }).catch(() => {});
  };

  // ---------------------------------------------------------------------------
  // WEBSITE HANDLERS
  // ---------------------------------------------------------------------------
  const openAddWebsiteModal = () => {
    setWebFormName('');
    setWebFormUrl('');
    setWebFormCategory('Production');
    setWebFormNotes('');
    setShowAddWebModal(true);
  };

  const openEditWebsiteModal = (site: WebsiteItem) => {
    setEditingWebsite(site);
    setWebFormName(site.name);
    setWebFormUrl(site.url);
    setWebFormCategory(site.category || 'Production');
    setWebFormNotes(site.notes || '');
    setSelectedWebMenu(null);
  };

  const handleSaveWebsite = async () => {
    const rawUrl = webFormUrl.trim();
    if (!rawUrl) {
      showFeedback('Missing URL', 'Please enter a valid website address or domain.', 'error');
      return;
    }

    const normalizedUrl = normalizeWebsiteUrl(rawUrl);
    const domain = extractDomainFromUrl(normalizedUrl);

    // Safe, exact brand matching for websites
    let matchedBrand: (typeof BRAND_CATALOG)[string] | null = null;
    const domainLower = domain.toLowerCase();
    const nameLower = webFormName.trim().toLowerCase();

    for (const [key, b] of Object.entries(BRAND_CATALOG)) {
      if (domainLower && b.domain && domainLower === b.domain.toLowerCase()) {
        matchedBrand = b;
        break;
      }
      if (nameLower.length >= 3 && nameLower.includes(key)) {
        matchedBrand = b;
        break;
      }
    }

    let cleanName = webFormName.trim();
    if (!cleanName) {
      if (matchedBrand) {
        cleanName = matchedBrand.name.split(':')[0].trim();
      } else if (domain) {
        const base = domain.replace(/^www\./, '');
        cleanName = base.charAt(0).toUpperCase() + base.slice(1);
      } else {
        cleanName = 'Website';
      }
    }

    const logoUrl = matchedBrand?.iconUrl || (domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=256` : undefined);

    setIsSubmitting(true);
    try {
      if (editingWebsite) {
        const updated = await updateWebsite(editingWebsite.id, {
          name: cleanName,
          url: normalizedUrl,
          category: webFormCategory,
          notes: webFormNotes.trim() || undefined,
          logoUrl,
        });
        if (updated) {
          setWebsites((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
        }
        setEditingWebsite(null);
        setShowAddWebModal(false);
        setActiveSection('websites');
        showFeedback('Website Updated', `"${cleanName}" has been updated.`, 'success');
      } else {
        const created = await createWebsite({
          name: cleanName,
          url: normalizedUrl,
          category: webFormCategory,
          notes: webFormNotes.trim() || undefined,
        });
        if (created) {
          const withRealLogo = logoUrl ? { ...created, logoUrl } : created;
          setWebsites((prev) => [withRealLogo, ...prev.filter((w) => w.id !== created.id)]);
        }
        setShowAddWebModal(false);
        setEditingWebsite(null);
        setActiveSection('websites');
        showFeedback('Website Added', `"${cleanName}" has been added to your websites.`, 'success');
      }
      await loadData();
    } catch (err: any) {
      showFeedback('Save Failed', err?.message || 'Could not save website.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteWebsite = async (site: WebsiteItem) => {
    try {
      await deleteWebsite(site.id);
      setSelectedWebMenu(null);
      setWebsites((prev) => prev.filter((w) => w.id !== site.id));
      showFeedback('Website Removed', `"${site.name}" was removed from your websites list.`, 'info');
    } catch (err: any) {
      showFeedback('Delete Failed', err?.message || 'Could not remove website.', 'error');
    }
  };

  const handleOpenWebsiteDirect = async (url: string) => {
    try {
      await openWebsiteInBrowser(url);
    } catch (err: any) {
      showFeedback('Browser Error', err?.message || 'Could not open website in browser.', 'error');
    }
  };

  const handleShareWebsite = (site: WebsiteItem) => {
    const fullUrl = normalizeWebsiteUrl(site.url);
    Share.share({
      title: site.name,
      message: `${site.name}\n${fullUrl}\nCategory: ${site.category}`,
    }).catch(() => {});
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Executive Header Bar */}
      <View style={[styles.headerBar, { borderBottomColor: colors.borderSubtle }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {activeSection === 'apps' ? 'Applications' : 'Websites'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            WorknAi Technologies • {activeSection === 'apps' ? `${totalAppsCount} Live Apps` : `${totalWebsitesCount} Monitored Sites`}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.addHeaderBtn, { backgroundColor: activeSection === 'apps' ? '#0284c7' : '#0284c7' }]}
          onPress={activeSection === 'apps' ? openAddAppModal : openAddWebsiteModal}
          activeOpacity={0.85}
        >
          <Text style={styles.addHeaderBtnText}>
            {activeSection === 'apps' ? '+ Add App' : '+ Add Site'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Top Segmented Control: [ :: Applications 18 ] | [ 🌐 Websites 17 ] */}
      <View style={styles.segmentContainer}>
        <View
          style={[
            styles.segmentTrack,
            {
              backgroundColor: isDark ? '#0f172a' : '#f8fafd',
              borderColor: isDark ? '#1e293b' : '#e6effa',
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.segmentTab,
              activeSection === 'apps' && {
                backgroundColor: '#0066FF',
                borderRadius: 20,
              },
            ]}
            onPress={() => setActiveSection('apps')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="apps"
              size={17}
              color={activeSection === 'apps' ? '#ffffff' : isDark ? '#64748b' : '#475569'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.segmentTabText,
                {
                  color: activeSection === 'apps' ? '#ffffff' : isDark ? '#94a3b8' : '#475569',
                  fontWeight: activeSection === 'apps' ? '700' : '600',
                },
              ]}
            >
              Applications
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentTab,
              activeSection === 'websites' && {
                backgroundColor: '#0066FF',
                borderRadius: 20,
              },
            ]}
            onPress={() => setActiveSection('websites')}
            activeOpacity={0.8}
          >
            <Ionicons
              name="globe-outline"
              size={17}
              color={activeSection === 'websites' ? '#ffffff' : isDark ? '#64748b' : '#475569'}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.segmentTabText,
                {
                  color: activeSection === 'websites' ? '#ffffff' : isDark ? '#94a3b8' : '#475569',
                  fontWeight: activeSection === 'websites' ? '700' : '600',
                },
              ]}
            >
              Websites
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* KPI Status Strip (Matching Reference: Icon on top, big number, label) */}
      {activeSection === 'apps' ? (
        <View style={styles.kpiContainer}>
          <TouchableOpacity
            style={[
              styles.kpiCard,
              {
                backgroundColor: isDark ? '#0f172a' : '#edf5ff',
                borderColor: appFilter === 'All' ? '#0066FF' : isDark ? '#1e293b' : '#d0e5ff',
                borderWidth: appFilter === 'All' ? 2 : 1,
              },
            ]}
            onPress={() => setAppFilter('All')}
            activeOpacity={0.7}
          >
            <Ionicons name="apps" size={17} color="#0066FF" />
            <Text style={[styles.kpiValue, { color: '#0047cc' }]}>{totalAppsCount}</Text>
            <Text style={[styles.kpiLabel, { color: isDark ? '#94a3b8' : '#475569' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              Total Apps
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.kpiCard,
              {
                backgroundColor: isDark ? '#0f172a' : '#edfcf2',
                borderColor: appFilter === 'Production' ? '#10b981' : isDark ? '#1e293b' : '#bbf7d0',
                borderWidth: appFilter === 'Production' ? 2 : 1,
              },
            ]}
            onPress={() => setAppFilter(appFilter === 'Production' ? 'All' : 'Production')}
            activeOpacity={0.7}
          >
            <Ionicons name="bar-chart" size={17} color="#00C853" />
            <Text style={[styles.kpiValue, { color: '#059669' }]}>{prodAppsCount}</Text>
            <Text style={[styles.kpiLabel, { color: isDark ? '#94a3b8' : '#475569' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              Production
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.kpiCard,
              {
                backgroundColor: isDark ? '#0f172a' : '#fefce8',
                borderColor: appFilter === 'Review' ? '#f59e0b' : isDark ? '#1e293b' : '#fef08a',
                borderWidth: appFilter === 'Review' ? 2 : 1,
              },
            ]}
            onPress={() => setAppFilter(appFilter === 'Review' ? 'All' : 'Review')}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={17} color="#F59E0B" />
            <Text style={[styles.kpiValue, { color: '#d97706' }]}>{reviewAppsCount}</Text>
            <Text style={[styles.kpiLabel, { color: isDark ? '#94a3b8' : '#475569' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              In Review
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.kpiCard,
              {
                backgroundColor: isDark ? '#0f172a' : '#fef2f2',
                borderColor: appFilter === 'Issues' ? '#ef4444' : isDark ? '#1e293b' : '#fecaca',
                borderWidth: appFilter === 'Issues' ? 2 : 1,
              },
            ]}
            onPress={() => setAppFilter(appFilter === 'Issues' ? 'All' : 'Issues')}
            activeOpacity={0.7}
          >
            <Ionicons name="alert-circle-outline" size={17} color="#EF4444" />
            <Text style={[styles.kpiValue, { color: '#ef4444' }]}>{issuesAppsCount}</Text>
            <Text style={[styles.kpiLabel, { color: isDark ? '#94a3b8' : '#475569' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              Action Req.
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.kpiContainer}>
          <TouchableOpacity
            style={[
              styles.kpiCard,
              {
                backgroundColor: isDark ? '#0f172a' : '#edf5ff',
                borderColor: webCategoryFilter === 'All' ? '#0066FF' : isDark ? '#1e293b' : '#d0e5ff',
                borderWidth: webCategoryFilter === 'All' ? 2 : 1,
              },
            ]}
            onPress={() => setWebCategoryFilter('All')}
            activeOpacity={0.7}
          >
            <Ionicons name="globe-outline" size={17} color="#0066FF" />
            <Text style={[styles.kpiValue, { color: '#0047cc' }]}>{totalWebsitesCount}</Text>
            <Text style={[styles.kpiLabel, { color: isDark ? '#94a3b8' : '#475569' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              Total Sites
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.kpiCard,
              {
                backgroundColor: isDark ? '#0f172a' : '#edfcf2',
                borderColor: webCategoryFilter === 'Production' ? '#10b981' : isDark ? '#1e293b' : '#bbf7d0',
                borderWidth: webCategoryFilter === 'Production' ? 2 : 1,
              },
            ]}
            onPress={() => setWebCategoryFilter(webCategoryFilter === 'Production' ? 'All' : 'Production')}
            activeOpacity={0.7}
          >
            <Ionicons name="bar-chart" size={17} color="#00C853" />
            <Text style={[styles.kpiValue, { color: '#059669' }]}>{prodWebsitesCount}</Text>
            <Text style={[styles.kpiLabel, { color: isDark ? '#94a3b8' : '#475569' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              Production
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.kpiCard,
              {
                backgroundColor: isDark ? '#0f172a' : '#f7f2fe',
                borderColor: webCategoryFilter === 'Client' ? '#8b5cf6' : isDark ? '#1e293b' : '#ede9fe',
                borderWidth: webCategoryFilter === 'Client' ? 2 : 1,
              },
            ]}
            onPress={() => setWebCategoryFilter(webCategoryFilter === 'Client' ? 'All' : 'Client')}
            activeOpacity={0.7}
          >
            <Ionicons name="people" size={17} color="#8B5CF6" />
            <Text style={[styles.kpiValue, { color: '#6d28d9' }]}>{clientWebsitesCount}</Text>
            <Text style={[styles.kpiLabel, { color: isDark ? '#94a3b8' : '#475569' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              Clients
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.kpiCard,
              {
                backgroundColor: isDark ? '#0f172a' : '#fffbeb',
                borderColor: webCategoryFilter === 'Personal' ? '#f59e0b' : isDark ? '#1e293b' : '#fef08a',
                borderWidth: webCategoryFilter === 'Personal' ? 2 : 1,
              },
            ]}
            onPress={() => setWebCategoryFilter(webCategoryFilter === 'Personal' ? 'All' : 'Personal')}
            activeOpacity={0.7}
          >
            <Ionicons name="person" size={17} color="#FF9800" />
            <Text style={[styles.kpiValue, { color: '#d97706' }]}>{personalWebsitesCount}</Text>
            <Text style={[styles.kpiLabel, { color: isDark ? '#94a3b8' : '#475569' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              Personal
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Google Play Console Sync Section */}
      {activeSection === 'apps' && (
        <View style={styles.consoleCardContainer}>
          <View
            style={[
              styles.consoleCard,
              {
                backgroundColor: isDark ? '#0f172a' : '#f0fdf4',
                borderColor: isDark ? '#1e293b' : '#bbf7d0',
              },
            ]}
          >
            <View style={styles.consoleCardHeader}>
              <View style={[styles.consoleIconBox, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
                <Image source={PLAY_STORE_LOCAL_ICON} style={styles.consolePlayIcon} />
              </View>

              <View style={styles.consoleInfoCol}>
                <View style={styles.consoleBadgeRow}>
                  <Text style={[styles.consoleCardTitle, { color: colors.text }]}>Google Play Console</Text>
                  {consoleAccount?.developerName ? (
                    <View style={styles.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={11} color="#16a34a" />
                      <Text style={styles.verifiedBadgeText}>Connected</Text>
                    </View>
                  ) : (
                    <View style={[styles.verifiedBadge, { backgroundColor: 'rgba(2, 132, 199, 0.1)' }]}>
                      <Text style={[styles.verifiedBadgeText, { color: '#0284c7' }]}>Ready</Text>
                    </View>
                  )}
                </View>

                {consoleAccount?.developerName ? (
                  <>
                    <Text style={[styles.consoleDevNameText, { color: '#0284c7' }]} numberOfLines={1}>
                      {consoleAccount.developerName}
                    </Text>
                    <Text style={[styles.consoleSubCount, { color: colors.textSecondary }]}>
                      {apps.filter((a) => a.serverName === 'Google Play Console' || a.developerName).length} Console Apps Synchronized
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.consoleDescText, { color: colors.textSecondary }]}>
                    Fetch all live applications from your console account.
                  </Text>
                )}
              </View>

              <View style={styles.consoleActionCol}>
                {consoleAccount?.developerName ? (
                  <View style={{ gap: 6, alignItems: 'flex-end' }}>
                    <TouchableOpacity
                      style={[styles.consoleSyncBtn, isSyncingConsole && { opacity: 0.6 }]}
                      onPress={() => handleSyncConsole(consoleAccount.developerName)}
                      disabled={isSyncingConsole}
                      activeOpacity={0.8}
                    >
                      {isSyncingConsole ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <>
                          <Ionicons name="sync" size={12} color="#ffffff" />
                          <Text style={styles.consoleSyncBtnText}>Re-Sync</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.consoleSwitchBtn, { borderColor: isDark ? '#334155' : '#cbd5e1' }]}
                      onPress={() => setIsConsoleModalOpen(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.consoleSwitchBtnText, { color: colors.textSecondary }]}>Switch</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.consoleConnectBtn}
                    onPress={() => setIsConsoleModalOpen(true)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.consoleConnectBtnText}>+ Connect</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={
              activeSection === 'apps'
                ? 'Search apps, package IDs, versions or tracks...'
                : 'Search websites, URLs or categories...'
            }
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ color: colors.textMuted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main Content List */}
      <ScrollView
        contentContainerStyle={styles.scrollList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {activeSection === 'apps' ? (
          /* =================================================================== */
          /* APPLICATIONS LIST                                                   */
          /* =================================================================== */
          filteredApps.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe' }]}>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#0284c7' }}>APP</Text>
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {searchQuery || appFilter !== 'All' ? 'No matching applications' : 'No applications tracked'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {searchQuery || appFilter !== 'All'
                  ? 'Try adjusting your search terms or filter selection.'
                  : 'All your Google Play Console apps are managed in this view.'}
              </Text>
              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: '#0284c7' }]}
                onPress={openAddAppModal}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryActionBtnText}>+ Add Application</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredApps.map((app) => {
              const isRejected = app.status === 'error' || app.releaseTrack?.toLowerCase().includes('rejected');
              const isReview =
                app.releaseTrack?.toLowerCase().includes('draft') ||
                app.releaseTrack?.toLowerCase().includes('unpublished') ||
                app.releaseTrack?.toLowerCase().includes('review');

              const statusBadgeBg = isRejected
                ? isDark
                  ? 'rgba(239, 68, 68, 0.15)'
                  : '#fee2e2'
                : isReview
                ? isDark
                  ? 'rgba(245, 158, 11, 0.15)'
                  : '#fef3c7'
                : isDark
                ? 'rgba(16, 185, 129, 0.15)'
                : '#dcfce7';

              const statusBadgeTextColor = isRejected ? '#ef4444' : isReview ? '#f59e0b' : '#10b981';
              const statusLabel = isRejected
                ? 'Rejected'
                : isReview
                ? app.releaseTrack?.includes('Unpublished')
                  ? 'Unpublished'
                  : 'In Review'
                : 'Production';

              return (
                <TouchableOpacity
                  key={app.id}
                  style={[styles.appCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  activeOpacity={0.85}
                  onPress={() => setSelectedAppMenu(app)}
                >
                  <View style={styles.appCardTop}>
                    {/* Clean Official Logo Squircle */}
                    <ProfessionalAppIcon app={app} size={48} />

                    {/* App Details & Title */}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={[styles.appName, { color: colors.text }]} numberOfLines={1}>
                          {app.name}
                        </Text>

                        {/* Status Badge */}
                        <View style={[styles.statusBadge, { backgroundColor: statusBadgeBg }]}>
                          <Text style={[styles.statusText, { color: statusBadgeTextColor }]}>
                            ● {statusLabel}
                          </Text>
                        </View>
                      </View>

                      {/* Sub-row: Package ID */}
                      <View style={styles.appMetaRow}>
                        {app.packageId && (
                          <Text style={[styles.packageChipText, { color: colors.textMuted }]} numberOfLines={1}>
                            {app.packageId}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>

                  {/* Bottom Action Strip */}
                  <View style={[styles.appBottomStrip, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}>
                    <Text style={[styles.updatedDateText, { color: colors.textMuted }]}>
                      {formatAppUpdatedDate(app.updatedAt)}
                    </Text>

                    <TouchableOpacity
                      style={styles.detailsIconBtn}
                      onPress={() => setSelectedAppMenu(app)}
                      activeOpacity={0.6}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[styles.detailsIconText, { color: colors.textSecondary }]}>⋮</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )
        ) : (
          /* =================================================================== */
          /* WEBSITES LIST (EXECUTIVE & PROFESSIONAL WITH OFFICIAL BRAND LOGOS)  */
          /* =================================================================== */
          filteredWebsites.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? 'rgba(2, 132, 199, 0.15)' : '#e0f2fe' }]}>
                <Ionicons name="globe-outline" size={28} color="#0284c7" />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {searchQuery || webCategoryFilter !== 'All' ? 'No matching websites' : 'No websites added yet'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                {searchQuery || webCategoryFilter !== 'All'
                  ? 'Try adjusting your search terms or category selection.'
                  : 'Add your web applications, client sites, or portals to open them directly.'}
              </Text>
              <TouchableOpacity
                style={[styles.primaryActionBtn, { backgroundColor: '#0284c7' }]}
                onPress={openAddWebsiteModal}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryActionBtnText}>+ Add Website</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredWebsites.map((site) => {
              const domain = extractDomainFromUrl(site.url);

              const categoryBadgeBg =
                site.category === 'Production'
                  ? isDark
                    ? 'rgba(16, 185, 129, 0.15)'
                    : '#dcfce7'
                  : site.category === 'Client'
                  ? isDark
                    ? 'rgba(139, 92, 246, 0.15)'
                    : '#ede9fe'
                  : isDark
                  ? 'rgba(56, 189, 248, 0.15)'
                  : '#e0f2fe';

              const categoryBadgeTextColor =
                site.category === 'Production'
                  ? '#10b981'
                  : site.category === 'Client'
                  ? '#8b5cf6'
                  : '#0284c7';

              return (
                <TouchableOpacity
                  key={site.id}
                  style={[styles.appCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  activeOpacity={0.85}
                  onPress={() => handleOpenWebsiteDirect(site.url)}
                >
                  <View style={styles.appCardTop}>
                    {/* Official Real Brand Icon Squircle */}
                    <ProfessionalWebsiteIcon site={site} size={48} />

                    {/* Site Details */}
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={[styles.appName, { color: colors.text }]} numberOfLines={1}>
                          {site.name}
                        </Text>

                        {/* Category Badge */}
                        <View style={[styles.statusBadge, { backgroundColor: categoryBadgeBg }]}>
                          <Text style={[styles.statusText, { color: categoryBadgeTextColor }]}>
                            ● {site.category}
                          </Text>
                        </View>
                      </View>

                      {/* Sub-row: Domain */}
                      <View style={styles.appMetaRow}>
                        <Ionicons name="lock-closed" size={11} color="#10b981" />
                        <Text style={[styles.packageChipText, { color: colors.textMuted }]} numberOfLines={1}>
                          {domain}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Bottom Action Strip */}
                  <View style={[styles.appBottomStrip, { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9' }]}>
                    <Text style={[styles.updatedDateText, { color: colors.textMuted }]} numberOfLines={1}>
                      {site.url.replace(/^https?:\/\//i, '')}
                    </Text>

                    <TouchableOpacity
                      style={styles.detailsIconBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        setSelectedWebMenu(site);
                      }}
                      activeOpacity={0.6}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[styles.detailsIconText, { color: colors.textSecondary }]}>⋮</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )
        )}
      </ScrollView>

      {/* ========================================================================= */}
      {/* 3-DOTS ACTION SHEET / DETAILS MODAL FOR APPS                              */}
      {/* ========================================================================= */}
      <Modal
        visible={selectedAppMenu !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSelectedAppMenu(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismissArea} activeOpacity={1} onPress={() => setSelectedAppMenu(null)} />
          <View style={[styles.sheetModalContainer, { backgroundColor: isDark ? '#0b132b' : '#ffffff', paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />

            {selectedAppMenu && (
              <>
                <View style={styles.actionSheetHeader}>
                  <ProfessionalAppIcon app={selectedAppMenu} size={52} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[styles.sheetTitle, { color: colors.text }]}>{selectedAppMenu.name}</Text>
                    <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                      {selectedAppMenu.packageId || selectedAppMenu.url || 'Google Play Store Verified'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.statsStrip, { backgroundColor: isDark ? '#111c3a' : '#f8fafc', borderColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
                  <View style={styles.statCol}>
                    <Text style={[styles.statValue, { color: colors.text }]}>Android</Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>Platform</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]} />
                  <View style={styles.statCol}>
                    <Text
                      style={[
                        styles.statValue,
                        {
                          color:
                            selectedAppMenu.status === 'error'
                              ? '#ef4444'
                              : selectedAppMenu.releaseTrack?.toLowerCase().includes('draft')
                              ? '#f59e0b'
                              : '#10b981',
                        },
                      ]}
                    >
                      {selectedAppMenu.releaseTrack || 'Production'}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>Play Track</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]} />
                  <View style={styles.statCol}>
                    <Text style={[styles.statValue, { color: '#10b981' }]}>Active</Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>State</Text>
                  </View>
                </View>

                <View style={styles.sheetActionsList}>
                  {/* Google Play Store Action Button */}
                  <TouchableOpacity
                    style={[
                      styles.sheetActionItem,
                      {
                        backgroundColor: isDark ? '#111c3a' : '#ffffff',
                        borderColor: isDark ? '#1e293b' : '#e2e8f0',
                      },
                    ]}
                    onPress={() => {
                      const targetUrl =
                        selectedAppMenu.playStoreUrl ||
                        (selectedAppMenu.packageId
                          ? `https://play.google.com/store/apps/details?id=${selectedAppMenu.packageId}`
                          : `https://play.google.com/store/search?q=${encodeURIComponent(selectedAppMenu.name)}&c=apps`);
                      handleOpenUrl(targetUrl);
                      setSelectedAppMenu(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.actionIconBadge,
                        {
                          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#ffffff',
                          borderColor: isDark ? '#334155' : '#e2e8f0',
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <GooglePlayStoreIcon size={22} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetActionTitle, { color: colors.text }]}>Open in Google Play Store</Text>
                      <Text style={[styles.sheetActionSub, { color: colors.textMuted }]} numberOfLines={1}>
                        {selectedAppMenu.playStoreUrl ||
                          (selectedAppMenu.packageId
                            ? `https://play.google.com/store/apps/details?id=${selectedAppMenu.packageId}`
                            : `Search Google Play for ${selectedAppMenu.name}`)}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0284c7', marginLeft: 4 }}>↗</Text>
                  </TouchableOpacity>

                  {/* Web Application / Healthcheck URL if available */}
                  {selectedAppMenu.url && (
                    <TouchableOpacity
                      style={[
                        styles.sheetActionItem,
                        {
                          backgroundColor: isDark ? '#111c3a' : '#ffffff',
                          borderColor: isDark ? '#1e293b' : '#e2e8f0',
                        },
                      ]}
                      onPress={() => {
                        handleOpenWebsiteDirect(selectedAppMenu.url!);
                        setSelectedAppMenu(null);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.actionIconBadge, { backgroundColor: 'rgba(2, 132, 199, 0.15)' }]}>
                        <Ionicons name="globe-outline" size={18} color="#0284c7" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.sheetActionTitle, { color: colors.text }]}>Open Web Application</Text>
                        <Text style={[styles.sheetActionSub, { color: colors.textMuted }]} numberOfLines={1}>
                          {selectedAppMenu.url}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#0284c7', marginLeft: 4 }}>↗</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.sheetActionItem, { backgroundColor: isDark ? '#111c3a' : '#ffffff', borderColor: isDark ? '#1e293b' : '#e2e8f0' }]}
                    onPress={() => {
                      handleShareApp(selectedAppMenu);
                      setSelectedAppMenu(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.actionIconBadge, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
                      <Text style={{ fontSize: 16, fontWeight: '900', color: '#6366f1' }}>⤴</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetActionTitle, { color: colors.text }]}>Share Application Info</Text>
                      <Text style={[styles.sheetActionSub, { color: colors.textMuted }]}>Share package details</Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textMuted, marginLeft: 4 }}>›</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.sheetActionItem, { backgroundColor: isDark ? '#111c3a' : '#ffffff', borderColor: isDark ? '#1e293b' : '#e2e8f0' }]}
                    onPress={() => openEditAppModal(selectedAppMenu)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.actionIconBadge, { backgroundColor: 'rgba(139, 92, 246, 0.12)' }]}>
                      <Text style={{ fontSize: 16, fontWeight: '900', color: '#8b5cf6' }}>✎</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetActionTitle, { color: colors.text }]}>Edit Application</Text>
                      <Text style={[styles.sheetActionSub, { color: colors.textMuted }]}>Modify custom endpoint or package name</Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textMuted, marginLeft: 4 }}>›</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.sheetActionItem, { backgroundColor: isDark ? '#111c3a' : '#ffffff', borderColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2' }]}
                    onPress={() => handleDeleteApp(selectedAppMenu)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.actionIconBadge, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                      <Text style={{ fontSize: 15, fontWeight: '900', color: '#ef4444' }}>✕</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetActionTitle, { color: '#ef4444' }]}>Delete Application</Text>
                      <Text style={[styles.sheetActionSub, { color: colors.textMuted }]}>Remove permanently from portfolio</Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#ef4444', marginLeft: 4 }}>›</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.sheetCloseButton, { backgroundColor: isDark ? '#1e293b' : '#0f172a' }]}
              onPress={() => setSelectedAppMenu(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.sheetCloseButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 3-DOTS ACTION SHEET / DETAILS MODAL FOR WEBSITES                          */}
      {/* ========================================================================= */}
      <Modal
        visible={selectedWebMenu !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setSelectedWebMenu(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalDismissArea} activeOpacity={1} onPress={() => setSelectedWebMenu(null)} />
          <View style={[styles.sheetModalContainer, { backgroundColor: isDark ? '#0b132b' : '#ffffff', paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />

            {selectedWebMenu && (
              <>
                <View style={styles.actionSheetHeader}>
                  <ProfessionalWebsiteIcon site={selectedWebMenu} size={52} />
                  <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[styles.sheetTitle, { color: colors.text }]}>{selectedWebMenu.name}</Text>
                    <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                      {selectedWebMenu.url}
                    </Text>
                  </View>
                </View>

                <View style={[styles.statsStrip, { backgroundColor: isDark ? '#111c3a' : '#f8fafc', borderColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
                  <View style={styles.statCol}>
                    <Text style={[styles.statValue, { color: '#0284c7' }]}>Browser</Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>Type</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]} />
                  <View style={styles.statCol}>
                    <Text style={[styles.statValue, { color: colors.text }]}>{selectedWebMenu.category}</Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>Category</Text>
                  </View>
                  <View style={[styles.statDivider, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]} />
                  <View style={styles.statCol}>
                    <Text style={[styles.statValue, { color: '#10b981' }]}>HTTPS</Text>
                    <Text style={[styles.statLabel, { color: colors.textMuted }]}>SSL</Text>
                  </View>
                </View>

                <View style={styles.sheetActionsList}>
                  {/* Direct Open in In-App Browser */}
                  <TouchableOpacity
                    style={[
                      styles.sheetActionItem,
                      {
                        backgroundColor: isDark ? '#111c3a' : '#ffffff',
                        borderColor: isDark ? '#1e293b' : '#e2e8f0',
                      },
                    ]}
                    onPress={() => {
                      const url = selectedWebMenu.url;
                      setSelectedWebMenu(null);
                      handleOpenWebsiteDirect(url);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.actionIconBadge, { backgroundColor: 'rgba(2, 132, 199, 0.15)' }]}>
                      <Ionicons name="globe" size={18} color="#0284c7" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetActionTitle, { color: colors.text }]}>Open Website in Browser</Text>
                      <Text style={[styles.sheetActionSub, { color: colors.textMuted }]} numberOfLines={1}>
                        {selectedWebMenu.url}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0284c7', marginLeft: 4 }}>↗</Text>
                  </TouchableOpacity>

                  {/* Share Link */}
                  <TouchableOpacity
                    style={[styles.sheetActionItem, { backgroundColor: isDark ? '#111c3a' : '#ffffff', borderColor: isDark ? '#1e293b' : '#e2e8f0' }]}
                    onPress={() => {
                      handleShareWebsite(selectedWebMenu);
                      setSelectedWebMenu(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.actionIconBadge, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
                      <Ionicons name="share-social-outline" size={18} color="#6366f1" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetActionTitle, { color: colors.text }]}>Share Website Link</Text>
                      <Text style={[styles.sheetActionSub, { color: colors.textMuted }]}>Share URL with others</Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textMuted, marginLeft: 4 }}>›</Text>
                  </TouchableOpacity>

                  {/* Edit Website */}
                  <TouchableOpacity
                    style={[styles.sheetActionItem, { backgroundColor: isDark ? '#111c3a' : '#ffffff', borderColor: isDark ? '#1e293b' : '#e2e8f0' }]}
                    onPress={() => openEditWebsiteModal(selectedWebMenu)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.actionIconBadge, { backgroundColor: 'rgba(139, 92, 246, 0.12)' }]}>
                      <Ionicons name="create-outline" size={18} color="#8b5cf6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetActionTitle, { color: colors.text }]}>Edit Website</Text>
                      <Text style={[styles.sheetActionSub, { color: colors.textMuted }]}>Change name, URL or category</Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textMuted, marginLeft: 4 }}>›</Text>
                  </TouchableOpacity>

                  {/* Delete Website */}
                  <TouchableOpacity
                    style={[styles.sheetActionItem, { backgroundColor: isDark ? '#111c3a' : '#ffffff', borderColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2' }]}
                    onPress={() => handleDeleteWebsite(selectedWebMenu)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.actionIconBadge, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetActionTitle, { color: '#ef4444' }]}>Delete Website</Text>
                      <Text style={[styles.sheetActionSub, { color: colors.textMuted }]}>Remove permanently from list</Text>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#ef4444', marginLeft: 4 }}>›</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.sheetCloseButton, { backgroundColor: isDark ? '#1e293b' : '#0f172a' }]}
              onPress={() => setSelectedWebMenu(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.sheetCloseButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* ADD / EDIT APP MODAL                                                      */}
      {/* ========================================================================= */}
      <Modal
        visible={showAddAppModal || editingApp !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          setShowAddAppModal(false);
          setEditingApp(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => {
              setShowAddAppModal(false);
              setEditingApp(null);
            }}
          />
          <View
            style={[
              styles.sheetModalContainer,
              {
                backgroundColor: isDark ? '#0b132b' : '#ffffff',
                paddingBottom: Math.max(insets.bottom, 20),
                maxHeight: '88%',
              },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />

            <View style={styles.sheetHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>
                  {editingApp ? 'Edit Application' : 'Register Application'}
                </Text>
                <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                  {editingApp ? 'Update microservice or app details' : 'Add Android app or backend service'}
                </Text>
              </View>
            </View>

            <ScrollView
              style={{ flexShrink: 1, maxHeight: 340 }}
              contentContainerStyle={{ paddingBottom: 12 }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Application Name *</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      color: isDark ? '#ffffff' : '#0f172a',
                      backgroundColor: isDark ? '#111c3a' : '#f8fafc',
                      borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    },
                  ]}
                  placeholder="e.g. My App Name"
                  placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                  cursorColor="#0284c7"
                  selectionColor="rgba(2, 132, 199, 0.4)"
                  value={formName}
                  onChangeText={setFormName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Environment</Text>
                <View style={styles.envSelectorRow}>
                  {(['Production', 'Staging', 'Development'] as const).map((env) => {
                    const isSelected = formEnv === env;
                    return (
                      <TouchableOpacity
                        key={env}
                        style={[
                          styles.envOptionBtn,
                          {
                            backgroundColor: isSelected ? '#0284c7' : isDark ? '#111c3a' : '#f1f5f9',
                            borderColor: isSelected ? '#0284c7' : isDark ? '#1e293b' : colors.border,
                          },
                        ]}
                        onPress={() => setFormEnv(env)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.envOptionText, { color: isSelected ? '#ffffff' : colors.text, fontWeight: isSelected ? '800' : '600' }]}>
                          {env}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Android Package ID (Optional)</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      color: isDark ? '#ffffff' : '#0f172a',
                      backgroundColor: isDark ? '#111c3a' : '#f8fafc',
                      borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    },
                  ]}
                  placeholder="e.g. com.worknai.app"
                  placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                  cursorColor="#0284c7"
                  selectionColor="rgba(2, 132, 199, 0.4)"
                  value={formPackageId}
                  onChangeText={setFormPackageId}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Healthcheck Endpoint / Web URL</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      color: isDark ? '#ffffff' : '#0f172a',
                      backgroundColor: isDark ? '#111c3a' : '#f8fafc',
                      borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    },
                  ]}
                  placeholder="e.g. https://api.myservice.com/health"
                  placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                  cursorColor="#0284c7"
                  selectionColor="rgba(2, 132, 199, 0.4)"
                  value={formUrl}
                  onChangeText={setFormUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                onPress={() => {
                  setShowAddAppModal(false);
                  setEditingApp(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalCancelBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: '#0284c7' }, isSubmitting && { opacity: 0.7 }]}
                onPress={handleSaveApp}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>{editingApp ? 'Save Changes' : 'Register Service'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* ADD / EDIT WEBSITE MODAL                                                  */}
      {/* ========================================================================= */}
      <Modal
        visible={showAddWebModal || editingWebsite !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => {
          setShowAddWebModal(false);
          setEditingWebsite(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => {
              setShowAddWebModal(false);
              setEditingWebsite(null);
            }}
          />
          <View
            style={[
              styles.sheetModalContainer,
              {
                backgroundColor: isDark ? '#0b132b' : '#ffffff',
                paddingBottom: Math.max(insets.bottom, 20),
                maxHeight: '88%',
              },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />

            <View style={styles.sheetHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>
                  {editingWebsite ? 'Edit Website' : 'Add New Website'}
                </Text>
                <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                  {editingWebsite ? 'Update website address and details' : 'Track website and open directly in browser'}
                </Text>
              </View>
            </View>

            <ScrollView
              style={{ flexShrink: 1, maxHeight: 340 }}
              contentContainerStyle={{ paddingBottom: 12 }}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Website Name *</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      color: isDark ? '#ffffff' : '#0f172a',
                      backgroundColor: isDark ? '#111c3a' : '#f8fafc',
                      borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    },
                  ]}
                  placeholder="e.g. WorknAi Official Portal"
                  placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                  cursorColor="#0284c7"
                  selectionColor="rgba(2, 132, 199, 0.4)"
                  value={webFormName}
                  onChangeText={setWebFormName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Website URL / Address *</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      color: isDark ? '#ffffff' : '#0f172a',
                      backgroundColor: isDark ? '#111c3a' : '#f8fafc',
                      borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    },
                  ]}
                  placeholder="e.g. worknai.com or https://worknai.com"
                  placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                  cursorColor="#0284c7"
                  selectionColor="rgba(2, 132, 199, 0.4)"
                  value={webFormUrl}
                  onChangeText={setWebFormUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Category</Text>
                <View style={[styles.envSelectorRow, { flexWrap: 'wrap' }]}>
                  {(['Production', 'Client', 'Personal', 'Staging', 'Tools'] as const).map((cat) => {
                    const isSelected = webFormCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.envOptionBtn,
                          {
                            flexBasis: '30%',
                            flexGrow: 1,
                            backgroundColor: isSelected ? '#0284c7' : isDark ? '#111c3a' : '#f1f5f9',
                            borderColor: isSelected ? '#0284c7' : isDark ? '#1e293b' : colors.border,
                          },
                        ]}
                        onPress={() => setWebFormCategory(cat)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.envOptionText, { color: isSelected ? '#ffffff' : colors.text, fontWeight: isSelected ? '800' : '600' }]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Notes / Description (Optional)</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      color: isDark ? '#ffffff' : '#0f172a',
                      backgroundColor: isDark ? '#111c3a' : '#f8fafc',
                      borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    },
                  ]}
                  placeholder="e.g. Main landing website and client portal"
                  placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                  cursorColor="#0284c7"
                  selectionColor="rgba(2, 132, 199, 0.4)"
                  value={webFormNotes}
                  onChangeText={setWebFormNotes}
                />
              </View>
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                onPress={() => {
                  setShowAddWebModal(false);
                  setEditingWebsite(null);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalCancelBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: '#0284c7' }, isSubmitting && { opacity: 0.7 }]}
                onPress={handleSaveWebsite}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>{editingWebsite ? 'Save Changes' : 'Add Website'}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* CONNECT GOOGLE PLAY CONSOLE MODAL                                         */}
      {/* ========================================================================= */}
      <Modal
        visible={isConsoleModalOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsConsoleModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalDismissArea}
            activeOpacity={1}
            onPress={() => setIsConsoleModalOpen(false)}
          />
          <View
            style={[
              styles.sheetModalContainer,
              {
                backgroundColor: isDark ? '#0b132b' : '#ffffff',
                paddingBottom: Math.max(insets.bottom, 24),
              },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} />

            <View style={styles.sheetHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.modalPlayIconBox}>
                  <Image source={PLAY_STORE_LOCAL_ICON} style={{ width: 26, height: 26 }} />
                </View>
                <View>
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>Google Play Console</Text>
                  <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                    Sync live applications from developer console
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsConsoleModalOpen(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={{ fontSize: 18, color: colors.textSecondary, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Quick Suggestion Chip for WorknAi */}
              <View style={styles.suggestionBox}>
                <Text style={[styles.suggestionLabel, { color: colors.textSecondary }]}>Quick Preset:</Text>
                <TouchableOpacity
                  style={styles.suggestionChip}
                  onPress={() => setConsoleDevName('WorknAi Technologies India Pvt Ltd')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionChipText}>⚡ WorknAi Technologies India Pvt Ltd</Text>
                </TouchableOpacity>
              </View>

              {/* Input: Console Developer Account Name */}
              <View style={styles.modalFieldGroup}>
                <Text style={[styles.modalFieldLabel, { color: colors.textSecondary }]}>
                  Console Account Name / Developer Name *
                </Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
                  placeholder="e.g. WorknAi Technologies India Pvt Ltd"
                  placeholderTextColor={colors.textMuted}
                  value={consoleDevName}
                  onChangeText={setConsoleDevName}
                />
                <Text style={[styles.modalHint, { color: colors.textMuted }]}>
                  Enter the developer name exactly as registered in your Google Play Console.
                </Text>
              </View>

              {/* Input: Custom Package IDs (Optional) */}
              <View style={styles.modalFieldGroup}>
                <Text style={[styles.modalFieldLabel, { color: colors.textSecondary }]}>
                  Package IDs / Identifiers (Optional)
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      color: colors.text,
                      borderColor: colors.border,
                      height: 80,
                      textAlignVertical: 'top',
                      paddingTop: 8,
                    },
                  ]}
                  placeholder={"e.g. com.example.app\ncom.company.portal"}
                  placeholderTextColor={colors.textMuted}
                  value={consolePackageIds}
                  onChangeText={setConsolePackageIds}
                  multiline={true}
                  numberOfLines={3}
                  autoCapitalize="none"
                />
                <Text style={[styles.modalHint, { color: colors.textMuted }]}>
                  Optional: If you have specific Android app package IDs, enter them separated by commas or lines.
                </Text>
              </View>
            </ScrollView>

            {/* Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}
                onPress={() => setIsConsoleModalOpen(false)}
              >
                <Text style={[styles.modalCancelBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSaveBtn,
                  { backgroundColor: '#0284c7' },
                  isSyncingConsole && { opacity: 0.6 },
                ]}
                onPress={() => handleSyncConsole()}
                disabled={isSyncingConsole}
              >
                {isSyncingConsole ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>🚀 Fetch & Sync Apps</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ========================================================================= */}
      {/* CUSTOM FEEDBACK DIALOG                                                    */}
      {/* ========================================================================= */}
      <Modal
        visible={feedbackModal?.visible ?? false}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setFeedbackModal(null)}
      >
        <View style={styles.feedbackOverlay}>
          <TouchableOpacity style={styles.backdropTouchable} activeOpacity={1} onPress={() => setFeedbackModal(null)} />
          <View style={[styles.feedbackCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View
              style={[
                styles.feedbackIconBadge,
                {
                  backgroundColor:
                    feedbackModal?.type === 'success'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : feedbackModal?.type === 'error'
                      ? 'rgba(239, 68, 68, 0.15)'
                      : 'rgba(56, 189, 248, 0.15)',
                },
              ]}
            >
              <Text
                style={[
                  styles.feedbackIconGlyph,
                  {
                    color:
                      feedbackModal?.type === 'success'
                        ? '#10b981'
                        : feedbackModal?.type === 'error'
                        ? '#ef4444'
                        : '#0284c7',
                  },
                ]}
              >
                {feedbackModal?.type === 'success' ? '✓' : feedbackModal?.type === 'error' ? '✕' : 'ℹ'}
              </Text>
            </View>

            <Text style={[styles.feedbackTitle, { color: colors.text }]}>{feedbackModal?.title}</Text>
            <Text style={[styles.feedbackMessage, { color: colors.textSecondary }]}>{feedbackModal?.message}</Text>

            <TouchableOpacity
              style={[
                styles.feedbackBtn,
                {
                  backgroundColor: feedbackModal?.type === 'error' ? '#ef4444' : '#0284c7',
                },
              ]}
              onPress={() => setFeedbackModal(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.feedbackBtnText}>{feedbackModal?.type === 'success' ? 'Done' : 'Got it'}</Text>
            </TouchableOpacity>
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
  headerTitle: {
    ...Typography.titleMedium,
    fontWeight: '800',
    fontSize: 20,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  addHeaderBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  addHeaderBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  segmentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 12,
  },
  segmentTrack: {
    flexDirection: 'row',
    borderRadius: 24,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 20,
  },
  segmentTabText: {
    fontSize: 14,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 6,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  kpiContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: 14,
    gap: 6,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 19,
    fontWeight: '800',
    marginTop: 5,
  },
  kpiLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 2,
  },
  searchSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  searchIcon: {
    fontSize: 15,
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  filterTabsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 10,
  },
  filterTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterTabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterTabText: {
    fontSize: 12,
  },
  scrollList: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl + 120,
    gap: Spacing.md,
  },
  appCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  appCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appName: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
    marginRight: 6,
  },
  appMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  packageChipText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  versionPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  versionPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  appBottomStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
  },
  updatedDateText: {
    fontSize: 11,
    flex: 1,
    marginRight: 8,
  },
  actionBtnPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  detailsIconBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  detailsIconText: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyBox: {
    borderWidth: 1,
    borderRadius: 20,
    padding: Spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 280,
  },
  primaryActionBtn: {
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryActionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetModalContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.lg,
    zIndex: 10,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    marginBottom: Spacing.md,
  },
  statCol: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#334155',
  },
  sheetActionsList: {
    gap: 8,
  },
  sheetActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  sheetActionSub: {
    fontSize: 11,
    marginTop: 1,
  },
  sheetCloseButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  sheetCloseButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  formGroup: {
    gap: 6,
    marginBottom: Spacing.md,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  formInput: {
    borderWidth: 1.2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    fontWeight: '500',
    minHeight: 48,
  },
  envSelectorRow: {
    flexDirection: 'row',
    gap: 8,
  },
  envOptionBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  envOptionText: {
    fontSize: 12,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalSaveBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284c7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  modalSaveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  feedbackOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  backdropTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  feedbackCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: Spacing.xxl,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  feedbackIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  feedbackIconGlyph: {
    fontSize: 26,
    fontWeight: '800',
  },
  feedbackTitle: {
    ...Typography.titleMedium,
    fontWeight: '800',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  feedbackMessage: {
    ...Typography.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  feedbackBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackBtnText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
  },
  consoleCardContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  consoleCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  consoleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  consoleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.2)',
  },
  consolePlayIcon: {
    width: 26,
    height: 26,
  },
  consoleInfoCol: {
    flex: 1,
  },
  consoleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  consoleCardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16a34a',
  },
  consoleDevNameText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  consoleSubCount: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  consoleDescText: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  consoleActionCol: {
    justifyContent: 'center',
  },
  consoleSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  consoleSyncBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  consoleSwitchBtn: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
  },
  consoleSwitchBtnText: {
    fontSize: 10,
    fontWeight: '600',
  },
  consoleConnectBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  consoleConnectBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalPlayIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
  },
  suggestionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.md,
    backgroundColor: 'rgba(2, 132, 199, 0.06)',
    padding: 8,
    borderRadius: 10,
  },
  suggestionLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  suggestionChip: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  suggestionChipText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  modalFieldGroup: {
    marginBottom: Spacing.md,
    gap: 6,
  },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalInput: {
    borderWidth: 1.2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 14,
    fontWeight: '500',
    minHeight: 46,
  },
  modalHint: {
    fontSize: 11,
    lineHeight: 15,
  },
});
