import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  Pressable,
  Animated,
} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import { typography } from '../theme/typography';

interface ActionButton {
  text: string;
  onPress: () => void;
  primary?: boolean;
}

interface ApplyLauncherModalProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: ActionButton[];
  onClose: () => void;
}

export function ApplyLauncherModal({
  visible,
  title,
  message,
  buttons,
  onClose,
}: ApplyLauncherModalProps) {
  const scaleAnim = useState(new Animated.Value(0.9))[0];
  const opacityAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <MaterialIcons name="touch-app" size={48} color="#3B82F6" />
            </View>
            
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
            
            <View style={styles.buttonRow}>
              {buttons.map((btn, index) => (
                <Pressable
                  key={index}
                  style={({ pressed }) => [
                    styles.button,
                    btn.primary ? styles.buttonPrimary : styles.buttonSecondary,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={btn.onPress}
                >
                  <Text style={[
                    styles.buttonText,
                    btn.primary ? styles.buttonTextPrimary : styles.buttonTextSecondary
                  ]}>
                    {btn.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  content: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 50,
    backgroundColor: '#F1F5F9', // light gray background for icon
  },

  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: '#3B82F6',
  },
  buttonSecondary: {
    backgroundColor: '#F1F5F9',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 15,
    fontFamily: typography.bold,
  },
  buttonTextPrimary: {
    color: '#FFFFFF',
  },
  buttonTextSecondary: {
    color: '#475569', 
  },
  title: {
    color: '#1E293B',
    fontSize: 20,
    fontFamily: typography.bold,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    color: '#64748B',
    fontSize: 14,
    fontFamily: typography.regular,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
});
