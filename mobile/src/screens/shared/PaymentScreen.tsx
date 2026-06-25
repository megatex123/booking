import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { showAlert } from '../../utils/webAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { paymentAPI } from '../../services/api';
import { Colors, Typography, Spacing, BorderRadius } from '../../utils/theme';
import { formatPrice } from '../../utils/helpers';

interface Props {
  navigation: any;
  route: any;
}

export const PaymentScreen: React.FC<Props> = ({ navigation, route }) => {
  const { bookingId, totalPrice } = route.params;
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'select' | 'processing' | 'done'>('select');
  const [method, setMethod] = useState<'card' | 'google_pay'>('card');

  const PAYMENT_METHODS = [
    { id: 'card' as const, icon: 'card-outline', label: 'Credit / Debit Card' },
    { id: 'google_pay' as const, icon: 'logo-google', label: 'Google Pay' },
  ];

  const handlePay = async () => {
    setLoading(true);
    setStep('processing');
    try {
      await paymentAPI.createIntent(bookingId);
      await new Promise((r) => setTimeout(r, 1500));
      await paymentAPI.confirmPayment(bookingId);
      setStep('done');
    } catch (e: any) {
      setStep('select');
      showAlert('Payment Failed', e.response?.data?.detail || 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'done') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={80} color={Colors.success} />
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <Text style={styles.successText}>
            You've paid {formatPrice(totalPrice)} for your car service.
          </Text>
          <Button
            title="View Booking"
            onPress={() => navigation.navigate('BookingDetail', { bookingId })}
            fullWidth
            size="lg"
            style={{ marginTop: 32 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payment</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Amount */}
        <Card style={styles.amountCard}>
          <Text style={styles.amountLabel}>Total Amount</Text>
          <Text style={styles.amount}>{formatPrice(totalPrice)}</Text>
          <View style={styles.secureRow}>
            <Ionicons name="shield-checkmark" size={14} color={Colors.success} />
            <Text style={styles.secureText}>Secured payment</Text>
          </View>
        </Card>

        {/* Payment Methods */}
        <Text style={styles.sectionTitle}>Payment Method</Text>
        {PAYMENT_METHODS.map((pm) => (
          <TouchableOpacity
            key={pm.id}
            style={[styles.methodCard, method === pm.id && styles.methodCardSelected]}
            onPress={() => setMethod(pm.id)}
            activeOpacity={0.85}
          >
            <View style={styles.methodIcon}>
              <Ionicons name={pm.icon as any} size={22} color={method === pm.id ? Colors.primary : Colors.textSecondary} />
            </View>
            <Text style={[styles.methodLabel, method === pm.id && styles.methodLabelSelected]}>
              {pm.label}
            </Text>
            <View style={[styles.radio, method === pm.id && styles.radioSelected]}>
              {method === pm.id && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.noteBox}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.primary} />
          <Text style={styles.noteText}>
            This is a demo payment. No actual charge will be made. In production, Stripe handles secure card processing.
          </Text>
        </View>

        <Button
          title={step === 'processing' ? 'Processing...' : `Pay ${formatPrice(totalPrice)}`}
          onPress={handlePay}
          loading={loading}
          fullWidth
          size="lg"
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { ...Typography.h3, color: Colors.text },
  content: { padding: Spacing.lg, gap: 12 },
  amountCard: { alignItems: 'center', paddingVertical: Spacing.xl },
  amountLabel: { ...Typography.body, color: Colors.textSecondary, marginBottom: 8 },
  amount: { fontSize: 42, fontWeight: '800', color: Colors.text, letterSpacing: -1 },
  secureRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 },
  secureText: { ...Typography.caption, color: Colors.success },
  sectionTitle: { ...Typography.h3, color: Colors.text, marginTop: 8 },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  methodCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '06' },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodLabel: { ...Typography.body, color: Colors.text, flex: 1 },
  methodLabelSelected: { color: Colors.primary, fontWeight: '600' },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: Colors.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: Colors.primary + '10',
    borderRadius: BorderRadius.sm,
    padding: 12,
  },
  noteText: { ...Typography.caption, color: Colors.textSecondary, flex: 1, lineHeight: 18 },
  successContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  successTitle: { ...Typography.h1, color: Colors.text, marginTop: 20, marginBottom: 12 },
  successText: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24 },
});
