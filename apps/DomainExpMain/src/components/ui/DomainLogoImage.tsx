import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Image, ImageStyle as ExpoImageStyle } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../store/theme-context';
import { getDomainLogoUrl } from '../../services/liveDomainLookup';

const LOCAL_BRAND_ASSETS: Record<string, any> = {
  // WorknAi client & main domains
  'worknai.com': require('../../../assets/images/app-icons/worknaiclient.png'),
  'worknai.media': require('../../../assets/images/app-icons/worknaiclient.png'),
  'worknai.store': require('../../../assets/images/app-icons/worknaiclient.png'),
  'worknaiclient': require('../../../assets/images/app-icons/worknaiclient.png'),
  'worknai': require('../../../assets/images/app-icons/worknaiclient.png'),

  // WorknAi HRMS
  'worknaihrms.online': require('../../../assets/images/app-icons/worknaihrms.png'),
  'hrms.worknai.com': require('../../../assets/images/app-icons/worknaihrms.png'),
  'worknaihrms': require('../../../assets/images/app-icons/worknaihrms.png'),
  'hrms': require('../../../assets/images/app-icons/worknaihrms.png'),

  // Healthy Food
  'healthyfood.cafe': require('../../../assets/images/app-icons/healthyfood.png'),
  'healthyfood.auction': require('../../../assets/images/app-icons/healthyfood.png'),
  'healthyfood': require('../../../assets/images/app-icons/healthyfood.png'),

  // Blood Donation / Raktdaan / BloodInfo
  'blooddonation.online': require('../../../assets/images/app-icons/blooddonation.png'),
  'raktdaan.online': require('../../../assets/images/app-icons/blooddonation.png'),
  'bloodinfo.in': require('../../../assets/images/app-icons/blooddonation.png'),
  'bloodinfo.org': require('../../../assets/images/app-icons/blooddonation.png'),
  'bloodinfo.online': require('../../../assets/images/app-icons/blooddonation.png'),
  'blooddonation': require('../../../assets/images/app-icons/blooddonation.png'),
  'raktdaan': require('../../../assets/images/app-icons/blooddonation.png'),
  'bloodinfo': require('../../../assets/images/app-icons/blooddonation.png'),

  // MobilePay / BillPay
  'billpay.business': require('../../../assets/images/app-icons/mobilepay.png'),
  'mobilepay.cafe': require('../../../assets/images/app-icons/mobilepay.png'),
  'mobilepay': require('../../../assets/images/app-icons/mobilepay.png'),
  'billpay': require('../../../assets/images/app-icons/mobilepay.png'),

  // Inquiry Experts
  'inquiryexperts.online': require('../../../assets/images/app-icons/inquiryexperts.png'),
  'inquiryexperts.app': require('../../../assets/images/app-icons/inquiryexperts.png'),
  'inquiry.deals': require('../../../assets/images/app-icons/inquiryexperts.png'),
  'inquiry.expert': require('../../../assets/images/app-icons/inquiryexperts.png'),
  'inquiry.doctor': require('../../../assets/images/app-icons/inquiryexperts.png'),
  'inquiryexperts': require('../../../assets/images/app-icons/inquiryexperts.png'),
  'inquiry': require('../../../assets/images/app-icons/inquiryexperts.png'),

  // AI Tourism
  'aitourism.in': require('../../../assets/images/app-icons/aitourism.png'),
  'aitourism': require('../../../assets/images/app-icons/aitourism.png'),

  // AnyWork Services
  'anyworkservices.com': require('../../../assets/images/app-icons/anywork.png'),
  'anyworkservices': require('../../../assets/images/app-icons/anywork.png'),
  'anywork': require('../../../assets/images/app-icons/anywork.png'),

  // GoAirClass
  'goairclass.online': require('../../../assets/images/app-icons/goairclass.png'),
  'goairclass': require('../../../assets/images/app-icons/goairclass.png'),

  // Gym / Fitness
  'gymproplus.com': require('../../../assets/images/app-icons/gymfitness.png'),
  'gymfitness': require('../../../assets/images/app-icons/gymfitness.png'),
  'gympro': require('../../../assets/images/app-icons/gymfitness.png'),

  // ITJobX
  'itjobx.com': require('../../../assets/images/app-icons/itjobx.png'),
  'itjobx': require('../../../assets/images/app-icons/itjobx.png'),

  // Lovenzea
  'lovenzea.online': require('../../../assets/images/app-icons/lovenzea.png'),
  'lovenzea': require('../../../assets/images/app-icons/lovenzea.png'),

  // Namasteyyy / Yoga
  'namasteyyy.com': require('../../../assets/images/app-icons/namasteyoga.png'),
  'namasteyyy': require('../../../assets/images/app-icons/namasteyoga.png'),
  'namaste': require('../../../assets/images/app-icons/namasteyoga.png'),

  // OnlineGo
  'onlinego.in': require('../../../assets/images/app-icons/onlinego.png'),
  'onlinego': require('../../../assets/images/app-icons/onlinego.png'),

  // Logistics
  'onlinegologistics.com': require('../../../assets/images/app-icons/quicklogistics.png'),
  'onlinegologistics': require('../../../assets/images/app-icons/quicklogistics.png'),
  'quicklogistics': require('../../../assets/images/app-icons/quicklogistics.png'),

  // PG Info
  'pginfo.online': require('../../../assets/images/app-icons/pginfo.png'),
  'pginfo': require('../../../assets/images/app-icons/pginfo.png'),

  // Smart Chess
  'smartchess': require('../../../assets/images/app-icons/smartchess.png'),

  // Hostinger / hstgr
  'hstgr.cloud': require('../../../assets/images/providers/hostinger.png'),
  'hostinger': require('../../../assets/images/providers/hostinger.png'),
  'hstgr': require('../../../assets/images/providers/hostinger.png'),

  // Providers
  'aws': require('../../../assets/images/providers/aws.png'),
  'cloudflare': require('../../../assets/images/providers/cloudflare.png'),
  'godaddy': require('../../../assets/images/providers/godaddy.png'),
  'digitalocean': require('../../../assets/images/providers/digitalocean.png'),
  'hetzner': require('../../../assets/images/providers/hetzner.png'),
  'namecheap': require('../../../assets/images/providers/namecheap.png'),
  'vultr': require('../../../assets/images/providers/vultr.png'),
  'linode': require('../../../assets/images/providers/linode.png'),
  'azure': require('../../../assets/images/providers/azure.png'),
  'gcp': require('../../../assets/images/providers/gcp.png'),
};

function findLocalBrandAsset(domainOrName: string): any | null {
  if (!domainOrName) return null;
  const clean = domainOrName.toLowerCase().trim().replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
  if (!clean) return null;

  // 1. Exact match
  if (LOCAL_BRAND_ASSETS[clean]) return LOCAL_BRAND_ASSETS[clean];

  // 2. Base domain without extension (e.g. "worknaihrms" from "worknaihrms.online")
  const baseName = clean.split('.')[0];
  if (LOCAL_BRAND_ASSETS[baseName]) return LOCAL_BRAND_ASSETS[baseName];

  // 3. Keyword / partial match
  if (clean.includes('worknaihrms') || clean.includes('hrms')) return LOCAL_BRAND_ASSETS['worknaihrms'];
  if (clean.includes('worknai')) return LOCAL_BRAND_ASSETS['worknai'];
  if (clean.includes('healthyfood')) return LOCAL_BRAND_ASSETS['healthyfood'];
  if (clean.includes('blood') || clean.includes('raktdaan')) return LOCAL_BRAND_ASSETS['blooddonation'];
  if (clean.includes('inquiry')) return LOCAL_BRAND_ASSETS['inquiry'];
  if (clean.includes('mobilepay') || clean.includes('billpay')) return LOCAL_BRAND_ASSETS['mobilepay'];
  if (clean.includes('logistics')) return LOCAL_BRAND_ASSETS['quicklogistics'];
  if (clean.includes('onlinego')) return LOCAL_BRAND_ASSETS['onlinego'];
  if (clean.includes('pginfo')) return LOCAL_BRAND_ASSETS['pginfo'];
  if (clean.includes('itjobx')) return LOCAL_BRAND_ASSETS['itjobx'];
  if (clean.includes('lovenzea')) return LOCAL_BRAND_ASSETS['lovenzea'];
  if (clean.includes('namaste')) return LOCAL_BRAND_ASSETS['namaste'];
  if (clean.includes('aitourism')) return LOCAL_BRAND_ASSETS['aitourism'];
  if (clean.includes('anywork')) return LOCAL_BRAND_ASSETS['anywork'];
  if (clean.includes('goairclass')) return LOCAL_BRAND_ASSETS['goairclass'];
  if (clean.includes('gym') || clean.includes('fitness')) return LOCAL_BRAND_ASSETS['gymfitness'];
  if (clean.includes('hstgr') || clean.includes('hostinger')) return LOCAL_BRAND_ASSETS['hostinger'];
  if (clean.includes('cloudflare')) return LOCAL_BRAND_ASSETS['cloudflare'];
  if (clean.includes('godaddy')) return LOCAL_BRAND_ASSETS['godaddy'];

  return null;
}

const BRAND_PALETTES = [
  { bg: '#0284c7', text: '#ffffff', border: '#38bdf8' }, // Sky
  { bg: '#6366f1', text: '#ffffff', border: '#818cf8' }, // Indigo
  { bg: '#059669', text: '#ffffff', border: '#34d399' }, // Emerald
  { bg: '#7c3aed', text: '#ffffff', border: '#a78bfa' }, // Violet
  { bg: '#d97706', text: '#ffffff', border: '#fbbf24' }, // Amber
  { bg: '#e11d48', text: '#ffffff', border: '#fb7185' }, // Rose
  { bg: '#0891b2', text: '#ffffff', border: '#22d3ee' }, // Cyan
  { bg: '#0d9488', text: '#ffffff', border: '#2dd4bf' }, // Teal
];

function getPaletteForDomain(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return BRAND_PALETTES[Math.abs(hash) % BRAND_PALETTES.length];
}

interface DomainLogoProps {
  domainName?: string;
  logoUrl?: any;
  size?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ExpoImageStyle> | any;
}

export function DomainLogoImage({
  domainName = '',
  logoUrl,
  size = 48,
  borderRadius = 14,
  style,
  imageStyle,
}: DomainLogoProps) {
  const { isDark } = useTheme();

  const cleanDomain = (domainName || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split(':')[0];

  // 1. Resolve local bundled asset first (100% offline, instant, highest fidelity)
  const localAsset = useMemo(() => {
    if (logoUrl && typeof logoUrl !== 'string') return logoUrl;
    return findLocalBrandAsset(cleanDomain);
  }, [cleanDomain, logoUrl]);

  // 2. Candidate remote URLs in priority order
  const remoteSources = useMemo(() => {
    if (localAsset) return [];
    if (!cleanDomain) return [];

    const list: string[] = [];

    // Verified official or high-res remote URL
    const primary = getDomainLogoUrl(cleanDomain);
    if (primary && !list.includes(primary)) {
      list.push(primary);
    }

    if (typeof logoUrl === 'string' && logoUrl.startsWith('http') && !list.includes(logoUrl)) {
      list.push(logoUrl);
    }

    // Google S2 Favicon API (High resolution PNG)
    const googleS2 = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanDomain)}&sz=128`;
    if (!list.includes(googleS2)) list.push(googleS2);

    // DuckDuckGo Favicon CDN
    const ddg = `https://icons.duckduckgo.com/ip3/${encodeURIComponent(cleanDomain)}.ico`;
    if (!list.includes(ddg)) list.push(ddg);

    // Clearbit Logo API
    const clearbit = `https://logo.clearbit.com/${encodeURIComponent(cleanDomain)}`;
    if (!list.includes(clearbit)) list.push(clearbit);

    // Icon Horse CDN
    const iconHorse = `https://icon.horse/icon/${encodeURIComponent(cleanDomain)}`;
    if (!list.includes(iconHorse)) list.push(iconHorse);

    return list;
  }, [localAsset, cleanDomain, logoUrl]);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setSourceIndex(0);
    setHasError(false);
  }, [cleanDomain, logoUrl, localAsset]);

  const handleImageError = () => {
    if (sourceIndex < remoteSources.length - 1) {
      setSourceIndex((prev) => prev + 1);
    } else {
      setHasError(true);
    }
  };

  const currentRemoteUri = remoteSources[sourceIndex];

  // Contextual category detection for beautiful icon badge fallback
  const categoryIcon = useMemo<{ name: keyof typeof Ionicons.glyphMap; color: string; bg: string } | null>(() => {
    if (cleanDomain.includes('doctor') || cleanDomain.includes('medic') || cleanDomain.includes('hospital')) {
      return { name: 'medkit-outline', color: '#ffffff', bg: '#0d9488' };
    }
    if (cleanDomain.includes('robo') || cleanDomain.includes('tech') || cleanDomain.includes('bot') || cleanDomain.includes('ai')) {
      return { name: 'hardware-chip-outline', color: '#ffffff', bg: '#6366f1' };
    }
    if (cleanDomain.includes('cloud') || cleanDomain.includes('server') || cleanDomain.includes('host')) {
      return { name: 'cloud-outline', color: '#ffffff', bg: '#0284c7' };
    }
    if (cleanDomain.includes('pay') || cleanDomain.includes('bill') || cleanDomain.includes('cash') || cleanDomain.includes('wallet')) {
      return { name: 'card-outline', color: '#ffffff', bg: '#d97706' };
    }
    if (cleanDomain.includes('store') || cleanDomain.includes('shop') || cleanDomain.includes('deal') || cleanDomain.includes('auction')) {
      return { name: 'pricetag-outline', color: '#ffffff', bg: '#e11d48' };
    }
    if (cleanDomain.includes('media') || cleanDomain.includes('video') || cleanDomain.includes('stream')) {
      return { name: 'play-outline', color: '#ffffff', bg: '#7c3aed' };
    }
    return null;
  }, [cleanDomain]);

  // Clean 2-letter uppercase brand monogram
  const monogram = useMemo(() => {
    if (!cleanDomain) return 'DP';
    const mainPart = cleanDomain.split('.')[0] || cleanDomain;
    return mainPart.slice(0, 2).toUpperCase();
  }, [cleanDomain]);

  const palette = useMemo(() => getPaletteForDomain(cleanDomain), [cleanDomain]);

  // If local asset is present: render directly with expo-image
  if (localAsset) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius,
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor: isDark ? '#334155' : '#e2e8f0',
          },
          style,
        ]}
      >
        <Image
          source={localAsset}
          style={[
            styles.image,
            {
              width: Math.round(size * 0.74),
              height: Math.round(size * 0.74),
              borderRadius: Math.max(4, Math.round(borderRadius * 0.5)),
            },
            imageStyle,
          ]}
          contentFit="contain"
          transition={150}
        />
      </View>
    );
  }

  // If remote URLs are available and haven't errored
  if (!hasError && currentRemoteUri) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius,
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderColor: isDark ? '#334155' : '#e2e8f0',
          },
          style,
        ]}
      >
        <Image
          source={{ uri: currentRemoteUri }}
          style={[
            styles.image,
            {
              width: Math.round(size * 0.72),
              height: Math.round(size * 0.72),
              borderRadius: Math.max(4, Math.round(borderRadius * 0.5)),
            },
            imageStyle,
          ]}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={150}
          onError={handleImageError}
        />
      </View>
    );
  }

  // Fallback: Executive-grade vibrant branded badge
  if (categoryIcon) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius,
            backgroundColor: categoryIcon.bg,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.08)',
          },
          style,
        ]}
      >
        <Ionicons name={categoryIcon.name} size={Math.round(size * 0.48)} color={categoryIcon.color} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: palette.bg,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.25)' : palette.border,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.monogramText,
          {
            fontSize: Math.max(13, Math.round(size * 0.38)),
            color: palette.text,
          },
        ]}
      >
        {monogram}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  image: {
    backgroundColor: 'transparent',
  },
  monogramText: {
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
