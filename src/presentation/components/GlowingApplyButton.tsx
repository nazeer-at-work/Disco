import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { typography } from '../theme/typography';

interface GlowingApplyButtonProps {
  onPress: () => void;
  title: string;
  style?: ViewStyle;
}

export const GlowingApplyButton: React.FC<GlowingApplyButtonProps> = ({
  onPress,
  title,
  style,
}) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const glowAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Gentle background pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Sweeping sheen/shimmer animation
    Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [glowAnim, shimmerAnim]);

  const onLayout = (event: LayoutChangeEvent) => {
    setDimensions({
      width: event.nativeEvent.layout.width,
      height: event.nativeEvent.layout.height,
    });
  };

  const shadowGlow = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 200],
  });

  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      style={({ pressed }) => [
        styles.container,
        style,
        { transform: [{ scale: pressed ? 0.95 : 1 }] }
      ]}
    >
      {/* Animated glowing outer border */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.glowWrapper, { opacity: shadowGlow }]} />

      {/* Inner SVG Gradient and Shimmer */}
      <View style={[StyleSheet.absoluteFill, styles.svgContainer]}>
        {dimensions.width > 0 && dimensions.height > 0 && (
          <Svg width={dimensions.width} height={dimensions.height}>
            <Defs>
              <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#4A6CF7" stopOpacity="1" />
                <Stop offset="1" stopColor="#304AA0" stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect
              x={0}
              y={0}
              width={dimensions.width}
              height={dimensions.height}
              rx={dimensions.height / 2}
              ry={dimensions.height / 2}
              fill="url(#grad)"
            />
          </Svg>
        )}

        {/* Shimmer effect */}
        {dimensions.width > 0 && (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                width: 60,
                transform: [{ translateX: shimmerTranslate }],
                opacity: 0.5,
              },
            ]}
          >
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id="shimmer" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="white" stopOpacity="0" />
                  <Stop offset="0.5" stopColor="white" stopOpacity="1" />
                  <Stop offset="1" stopColor="white" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect
                x={0}
                y={0}
                width="100%"
                height="100%"
                fill="url(#shimmer)"
                transform="skewX(-20)"
              />
            </Svg>
          </Animated.View>
        )}
      </View>

      <View style={styles.content}>
        <Text style={styles.text} numberOfLines={1}>{title}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minWidth: 100,
  },
  glowWrapper: {
    borderRadius: 100,
    borderWidth: 3,
    borderColor: '#93A9F5',
    margin: -3,
    zIndex: -1,
  },
  svgContainer: {
    borderRadius: 100,
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  text: {
    fontFamily: typography.bold,
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
