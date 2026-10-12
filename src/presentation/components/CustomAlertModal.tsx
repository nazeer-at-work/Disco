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

interface CustomAlertModalProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  buttonText?: string;
  onClose: () => void;
}

export function CustomAlertModal({
  visible,
  title,
  message,
  type = 'info',
  buttonText = 'Got it',
  onClose,
}: CustomAlertModalProps) {
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

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <MaterialIcons name="check-circle" size={48} color="#10B981" />;
      case 'error':
        return <MaterialIcons name="error" size={48} color="#EF4444" />;
      case 'warning':
        return <MaterialIcons name="warning" size={48} color="#F59E0B" />;
      default:
        return <MaterialIcons name="info" size={48} color="#3B82F6" />;
    }
  };

  const getHeaderBorderColor = () => {
    switch (type) {
      case 'success':
        return '#10B981';
      case 'error':
        return '#EF4444';
      case 'warning':
        return '#F59E0B';
      default:
        return '#3B82F6';
    }
  };

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
              borderColor: getHeaderBorderColor(),
            },
          ]}
        >
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              {getIcon()}
            </View>
            
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
            
            <Pressable
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: getHeaderBorderColor() },
                pressed && styles.buttonPressed,
              ]}
              onPress={onClose}
            >
              <Text style={styles.buttonText}>{buttonText}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 16, 28, 0.85)',
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
    backgroundColor: '#0F172A',
    borderRadius: 24,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1.5,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  content: {
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
    padding: 10,
    borderRadius: 50,
    backgroundColor: '#1E293B',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: typography.bold,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    color: '#94A3B8',
    fontSize: 14,
    fontFamily: typography.regular,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: typography.bold,
  },
});
