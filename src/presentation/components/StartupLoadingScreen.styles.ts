import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: '#304AA0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  track: {
    width: 334,
    height: 84,
    position: 'relative',
    justifyContent: 'center',
  },
  logo: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 22,
    zIndex: 10,
    elevation: 10,
  },
  titleContainer: {
    position: 'absolute',
    left: 92,
    height: 48,
    justifyContent: 'center',
    zIndex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleLetter: {
    fontSize: 36,
    lineHeight: 42,
    color: '#F6FAFF',
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
