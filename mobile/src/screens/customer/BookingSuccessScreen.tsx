import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { Colors, Typography, Spacing, BorderRadius } from '../../utils/theme';
import { formatPrice, formatDate, formatTime } from '../../utils/helpers';
import { Booking } from '../../types';

interface Props {
  navigation: any;
  route: any;
}

export const BookingSuccessScreen: React.FC<Props> = ({ navigation, route }) => {
  const booking: Booking = route.params?.booking;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.successIcon}>
          <Ionicons name="checkmark-circle" size={72} color={Colors.success} />
        </View>
        <Text style={styles.title}>Booking Sent!</Text>
        <Text style={styles.subtitle}>
          Your booking request has been sent to the workshop. You'll be notified once it's confirmed.
        </Text>

        <View style={styles.card}>
          <Row label="Workshop" value={booking.workshop_name} />
          <Row label="Date" value={formatDate(booking.scheduled_date)} />
          <Row label="Time" value={formatTime(booking.scheduled_time)} />
          <Row label="Vehicle" value={`${booking.vehicle_brand} ${booking.vehicle_name} (${booking.vehicle_plate})`} />
          <Row label="Total" value={formatPrice(booking.total_price)} highlight />
          <Row label="Status" value="Pending Workshop Confirmation" />
        </View>

        <Text style={styles.note}>
          Payment will be processed after the workshop confirms your booking.
        </Text>
      </View>

      <View style={styles.buttons}>
        <Button
          title="Track Booking"
          onPress={() => navigation.navigate('BookingDetail', { bookingId: booking.id })}
          fullWidth
          size="lg"
          style={{ marginBottom: 12 }}
        />
        <Button
          title="Back to Home"
          onPress={() => navigation.navigate('Home')}
          variant="outline"
          fullWidth
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
};

const Row = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <View style={rowStyles.row}>
    <Text style={rowStyles.label}>{label}</Text>
    <Text style={[rowStyles.value, highlight && rowStyles.highlight]}>{value}</Text>
  </View>
);

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  label: { ...Typography.bodySmall, color: Colors.textSecondary },
  value: { ...Typography.bodySmall, color: Colors.text, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
  highlight: { color: Colors.primary, fontWeight: '700' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: Spacing.lg, alignItems: 'center' },
  successIcon: { marginTop: Spacing.xxl, marginBottom: Spacing.lg },
  title: { ...Typography.h1, color: Colors.text, marginBottom: Spacing.sm },
  subtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24, marginBottom: Spacing.xl },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
    marginBottom: Spacing.md,
  },
  note: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.lg,
  },
  buttons: { padding: Spacing.lg },
});
