import React, { useEffect, useMemo } from 'react';
import { Animated, Easing } from 'react-native';
import { styles } from './StartupLoadingScreen.styles';

type StartupLoadingScreenProps = {
  onFinish: () => void;
};

const LOADING_DURATION_MS = 1000;
const MOON_SPIN_DURATION_MS = 18000;
const LETTER_STAGGER_MS = 70;
const LETTER_ANIMATION_MS = 420;
const TITLE = 'Fluffy';

export function StartupLoadingScreen({ onFinish }: StartupLoadingScreenProps) {
  const spinProgress = useMemo(() => new Animated.Value(0), []);
  const wordProgress = useMemo(() => new Animated.Value(0), []);
  const letterProgress = useMemo(
    () => TITLE.split('').map(() => new Animated.Value(0)),
    [],
  );

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spinProgress, {
        toValue: 1,
        duration: MOON_SPIN_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    spinLoop.start();

    const wordIn = Animated.sequence([
      Animated.delay(80),
      Animated.timing(wordProgress, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const lettersIn = Animated.stagger(
      LETTER_STAGGER_MS,
      letterProgress.map((value) =>
        Animated.timing(value, {
          toValue: 1,
          duration: LETTER_ANIMATION_MS,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ),
    );

    wordIn.start();
    lettersIn.start();
    const finishTimer = setTimeout(() => {
      onFinish();
    }, LOADING_DURATION_MS);

    return () => {
      clearTimeout(finishTimer);
      spinLoop.stop();
      spinProgress.stopAnimation();
      wordProgress.stopAnimation();
      letterProgress.forEach((value) => value.stopAnimation());
    };
  }, [letterProgress, onFinish, spinProgress, wordProgress]);

  const rotate = spinProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const wordOpacity = wordProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const wordTranslateX = wordProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 0],
  });
  const wordScale = wordProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.98, 1],
  });

  return (
    <Animated.View style={styles.container}>
      <Animated.View style={styles.track}>
        <Animated.Image
          source={require('../../../assets/logo/logo.webp')}
          style={[{ transform: [{ rotate }] }]}
          resizeMode="contain"
        />
        <Animated.View style={styles.titleContainer}>
          <Animated.View
            style={[
              styles.titleRow,
              {
                opacity: wordOpacity,
                transform: [{ translateX: wordTranslateX }, { scale: wordScale }],
              },
            ]}>
            {TITLE.split('').map((letter, index) => {
              const opacity = letterProgress[index].interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              });
              const translateY = letterProgress[index].interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              });
              const scale = letterProgress[index].interpolate({
                inputRange: [0, 0.65, 1],
                outputRange: [0.9, 1.06, 1],
              });

              return (
                <Animated.Text
                  key={`${letter}-${index}`}
                  numberOfLines={1}
                  style={[
                    styles.titleLetter,
                    {
                      opacity,
                      transform: [{ translateY }, { scale }],
                    },
                  ]}>
                  {letter}
                </Animated.Text>
              );
            })}
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}
