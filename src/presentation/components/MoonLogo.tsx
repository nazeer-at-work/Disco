import React from 'react';
import { Image, View } from 'react-native';
import { styles } from './MoonLogo.styles';

export function MoonLogo() {
  return (
    <View style={styles.container}>
      <Image source={require('../../../assets/logo/logo.webp')} style={styles.moonImage} />
    </View>
  );
}
