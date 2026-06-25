import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { StatusColors } from '../../utils/theme';
import { getStatusLabel } from '../../utils/helpers';
import { BookingStatus } from '../../types';

interface Props {
  status: BookingStatus | string;
}

export const StatusBadge: React.FC<Props> = ({ status }) => {
  const color = StatusColors[status] || '#9CA3AF';
  return (
    <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color + '40' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{getStatusLabel(status as BookingStatus)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
  text: { fontSize: 12, fontWeight: '600' },
});
