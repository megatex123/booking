import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../utils/theme';

interface Props {
  unreadCount: number;
  onPress: () => void;
  color?: string;
  size?: number;
}

export const ShakingBell: React.FC<Props> = ({ unreadCount, onPress, color = Colors.text, size = 22 }) => {
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (unreadCount <= 0) {
      shake.setValue(0);
      return;
    }

    const ring = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, { toValue: 12,  duration: 70,  useNativeDriver: false }),
        Animated.timing(shake, { toValue: -12, duration: 70,  useNativeDriver: false }),
        Animated.timing(shake, { toValue: 10,  duration: 60,  useNativeDriver: false }),
        Animated.timing(shake, { toValue: -10, duration: 60,  useNativeDriver: false }),
        Animated.timing(shake, { toValue: 6,   duration: 50,  useNativeDriver: false }),
        Animated.timing(shake, { toValue: -6,  duration: 50,  useNativeDriver: false }),
        Animated.timing(shake, { toValue: 0,   duration: 50,  useNativeDriver: false }),
        Animated.delay(2500),
      ])
    );

    ring.start();
    return () => ring.stop();
  }, [unreadCount]);

  const rotate = shake.interpolate({
    inputRange: [-12, 12],
    outputRange: ['-12deg', '12deg'],
  });

  return (
    <TouchableOpacity onPress={onPress} style={styles.btn} activeOpacity={0.7}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <Ionicons
          name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
          size={size}
          color={unreadCount > 0 ? Colors.primary : color}
        />
      </Animated.View>
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: 4, right: 2,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.error,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: Colors.surface,
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
});
