import React, { useState, useEffect } from 'react';
import { View, Image, Text, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../store/theme-context';
import { getDomainLogoUrl } from '../../services/liveDomainLookup';

interface DomainLogoProps {
  domainName?: string;
  logoUrl?: string;
  size?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
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

  // Multi-tier authentic logo sources for ANY domain in the world
  const sources = React.useMemo(() => {
    if (!cleanDomain) return [];
    const list: string[] = [];

    // 1. Official / Verified Logo or Google S2 PNG CDN
    const primary = getDomainLogoUrl(cleanDomain);
    if (primary) {
      list.push(primary);
    }

    if (logoUrl && logoUrl.startsWith('http') && !list.includes(logoUrl)) {
      list.push(logoUrl);
    }

    // 2. Google Favicon V2 Social API (Returns PNG)
    const googleV2 = `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${encodeURIComponent(cleanDomain)}&size=128`;
    if (!list.includes(googleV2)) {
      list.push(googleV2);
    }

    // 3. Google High-Resolution Favicon CDN (Returns PNG)
    const googleS2 = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanDomain)}&sz=128`;
    if (!list.includes(googleS2)) {
      list.push(googleS2);
    }

    // 4. Unavatar Brand Identity API
    list.push(`https://unavatar.io/${encodeURIComponent(cleanDomain)}?fallback=false`);

    return list;
  }, [cleanDomain, logoUrl]);

  const [sourceIndex, setSourceIndex] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setSourceIndex(0);
    setHasError(false);
  }, [cleanDomain, logoUrl]);

  const handleImageError = () => {
    if (sourceIndex < sources.length - 1) {
      setSourceIndex((prev) => prev + 1);
    } else {
      setHasError(true);
    }
  };

  const currentUri = sources[sourceIndex];

  // Generate clean brand monogram for fallback
  const monogram = React.useMemo(() => {
    if (!cleanDomain) return 'D';
    const mainPart = cleanDomain.split('.')[0] || cleanDomain;
    return mainPart.slice(0, 2).toUpperCase();
  }, [cleanDomain]);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor: isDark ? '#1e293b' : '#f8fafc',
          borderColor: isDark ? '#334155' : '#e2e8f0',
        },
        style,
      ]}
    >
      {!hasError && currentUri ? (
        <Image
          source={{ uri: currentUri }}
          style={[
            styles.image,
            {
              width: Math.round(size * 0.72),
              height: Math.round(size * 0.72),
              borderRadius: Math.max(4, Math.round(borderRadius * 0.6)),
            },
            imageStyle,
          ]}
          resizeMode="contain"
          onError={handleImageError}
        />
      ) : (
        <View style={styles.fallbackContainer}>
          {monogram.length > 0 && monogram !== 'D' ? (
            <Text
              style={[
                styles.monogramText,
                {
                  fontSize: Math.max(12, Math.round(size * 0.36)),
                  color: isDark ? '#38bdf8' : '#0284c7',
                },
              ]}
            >
              {monogram}
            </Text>
          ) : (
            <Ionicons
              name="globe-outline"
              size={size * 0.52}
              color={isDark ? '#94a3b8' : '#64748b'}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    backgroundColor: 'transparent',
  },
  fallbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
