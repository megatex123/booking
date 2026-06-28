import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BorderRadius } from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
}

export const Card: React.FC<Props> = ({ children, style, padding = 16 }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { padding, backgroundColor: colors.surface }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});
