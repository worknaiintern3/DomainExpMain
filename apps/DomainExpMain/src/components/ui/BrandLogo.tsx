import React from 'react';
import { View, StyleSheet } from 'react-native';

interface BrandLogoProps {
  size?: number;
}

export function BrandLogo({ size = 72 }: BrandLogoProps) {
  const scale = size / 72;
  const outerRadius = 18 * scale;
  const innerRadius = 9 * scale;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: outerRadius,
          shadowRadius: 16 * scale,
        },
      ]}
    >
      {/* Outer D Shape */}
      <View
        style={[
          styles.outerD,
          {
            width: size * 0.86,
            height: size * 0.86,
            borderTopRightRadius: size * 0.43,
            borderBottomRightRadius: size * 0.43,
            borderTopLeftRadius: 10 * scale,
            borderBottomLeftRadius: 10 * scale,
          },
        ]}
      >
        {/* Inner cutout to form the 'D' */}
        <View
          style={[
            styles.innerCutout,
            {
              width: size * 0.42,
              height: size * 0.46,
              borderTopRightRadius: innerRadius * 2,
              borderBottomRightRadius: innerRadius * 2,
              borderTopLeftRadius: 4 * scale,
              borderBottomLeftRadius: 4 * scale,
            },
          ]}
        />

        {/* Pulse center node */}
        <View
          style={[
            styles.pulseNode,
            {
              width: size * 0.22,
              height: 7 * scale,
              borderRadius: 3.5 * scale,
              left: size * 0.16,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1877F2',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    elevation: 8,
  },
  outerD: {
    backgroundColor: '#1877F2',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  innerCutout: {
    backgroundColor: '#ffffff',
    position: 'absolute',
    left: '26%',
  },
  pulseNode: {
    backgroundColor: '#1877F2',
    position: 'absolute',
  },
});
