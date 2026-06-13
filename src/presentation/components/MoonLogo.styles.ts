import { StyleSheet } from 'react-native';

export const MOON_LOGO_SIZE = 118;

export const styles = StyleSheet.create({
  container: {
    width: MOON_LOGO_SIZE,
    height: MOON_LOGO_SIZE,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moonImage: {
    width: 106,
    height: 106,
    resizeMode: 'contain',
  },
});
