import React, { memo } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SystemIconDescriptor } from '../../domain/entities/SystemIcon';
import { FluffyIcon } from './FluffyIcon';
import { typography } from '../theme/typography';
import { iconImageMap } from '../../config/icon-image-map.generated';

type IconCardProps = {
  icon: SystemIconDescriptor;
  onPress?: (icon: SystemIconDescriptor) => void;
};

function IconCardComponent({ icon, onPress }: IconCardProps) {
  const imageSource = iconImageMap[icon.id];
  const shouldUseImage = Boolean(imageSource);

  return (
    <Pressable style={styles.container} onPress={() => onPress?.(icon)}>
      <View>
        {shouldUseImage ? (
          <View style={styles.imageShell}>
            <Image
              source={imageSource}
              style={styles.imageIcon}
            />
          </View>
        ) : (
          <FluffyIcon id={icon.id} hue={icon.hue} />
        )}
      </View>
      <Text style={styles.label} numberOfLines={2} ellipsizeMode="tail">
        {icon.label}
      </Text>
    </Pressable>
  );
}

export const IconCard = memo(
  IconCardComponent,
  (prev, next) =>
    prev.icon.id === next.icon.id &&
    prev.icon.label === next.icon.label &&
    prev.icon.hue === next.icon.hue,
);

const styles = StyleSheet.create({
  container: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 18,
    gap: 8,
    paddingHorizontal: 4,
  },
  imageShell: {
    width: 56,
    height: 56,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  imageIcon: {
    width: '100%',
    height: '100%',
  },
  label: {
    fontSize: 12,
    color: '#2B4B72',
    fontFamily: typography.semiBold,
    width: '100%',
    textAlign: 'center',
    lineHeight: 16,
    minHeight: 32,
  },
});
