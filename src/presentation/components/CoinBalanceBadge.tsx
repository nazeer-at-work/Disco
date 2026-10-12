import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { typography } from '../theme/typography';

interface CoinBalanceBadgeProps {
  freeCoins: number;
  paidCoins: number;
  onPress: () => void;
}

export function CoinBalanceBadge({ freeCoins, paidCoins, onPress }: CoinBalanceBadgeProps) {
  const totalCoins = freeCoins + paidCoins;

  return (
    <Pressable style={styles.badge} onPress={onPress}>
      <View style={styles.coinIconWrap}>
        <Text style={styles.coinEmoji}>🪙</Text>
      </View>
      <Text style={styles.coinText}>{totalCoins}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  coinIconWrap: {
    marginRight: 4,
  },
  coinEmoji: {
    fontSize: 16,
  },
  coinText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: typography.semiBold,
  },
});
