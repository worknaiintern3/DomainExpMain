import React from 'react';
import { View, Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';

interface BrandLogoProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

export function BrandLogo({ size = 72, style, imageStyle }: BrandLogoProps) {
  const borderRadius = Math.round(size * 0.22);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
        },
        style,
      ]}
    >
      <Image
        source={require('../../../assets/images/icon.png')}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius,
          },
          imageStyle,
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  image: {
    overflow: 'hidden',
  },
});
