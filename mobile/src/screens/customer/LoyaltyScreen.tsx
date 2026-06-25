import React, { useEffect, useState, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { loyaltyAPI } from '../../services/api';

interface Props {
  navigation: any;
}

interface Balance {
  points: number;
  total_earned: number;
  total_used: number;
  rm_value: number;
  min_redeem: number;
  points_per_rm: number;
  points_to_rm: number;
}

interface HistoryItem {
  booking_id: string;
  workshop_name: string;
  total_price: number;
  status: string;
  points_earned: number;
  points_used: number;
  discount_rm: number;
  created_at: string;
}

export const LoyaltyScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loyaltyAPI.getBalance(), loyaltyAPI.getHistory()])
      .then(([b, h]) => { setBalance(b.data); setHistory(h.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Loyalty Points</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero balance card */}
        <View style={styles.hero}>
          <View style={styles.starIcon}>
            <Ionicons name="star" size={32} color="#F59E0B" />
          </View>
          {loading ? (
            <ActivityIndicator color="#fff" size="large" style={{ marginVertical: 20 }} />
          ) : (
            <>
              <Text style={styles.pointsLabel}>Your Points Balance</Text>
              <Text style={styles.pointsValue}>{balance?.points ?? 0}</Text>
              <Text style={styles.pointsRm}>≈ RM{balance?.rm_value.toFixed(2) ?? '0.00'}</Text>
              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statVal}>{balance?.total_earned ?? 0}</Text>
                  <Text style={styles.statLbl}>Total earned</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statVal}>{balance?.total_used ?? 0}</Text>
                  <Text style={styles.statLbl}>Total used</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* How it works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <View style={styles.infoCard}>
            {[
              { icon: 'car-outline', color: colors.primary, text: 'Earn 1 point for every RM1 spent on completed bookings' },
              { icon: 'gift-outline', color: colors.success, text: '100 points = RM1 discount on your next booking' },
              { icon: 'time-outline', color: '#F59E0B', text: 'Points never expire — keep earning and saving' },
            ].map((item, i) => (
              <View key={i} style={[styles.infoRow, i < 2 && styles.infoRowBorder]}>
                <View style={[styles.infoIcon, { backgroundColor: item.color + '15' }]}>
                  <Ionicons name={item.icon as any} size={20} color={item.color} />
                </View>
                <Text style={styles.infoText}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : history.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="star-outline" size={36} color={colors.textLight} />
              <Text style={styles.emptyText}>No activity yet. Complete a booking to earn your first points!</Text>
            </View>
          ) : (
            history.map((item) => {
              const hasEarned = item.points_earned > 0;
              const hasUsed = item.points_used > 0;
              return (
                <View key={item.booking_id} style={styles.historyCard}>
                  <View style={styles.historyIcon}>
                    <Ionicons name={hasEarned ? 'add-circle' : 'remove-circle'} size={22} color={hasEarned ? colors.success : colors.danger} />
                  </View>
                  <View style={styles.historyBody}>
                    <Text style={styles.historyWorkshop} numberOfLines={1}>{item.workshop_name}</Text>
                    <Text style={styles.historyDate}>{new Date(item.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                  </View>
                  <View style={styles.historyRight}>
                    {hasEarned && (
                      <Text style={styles.historyEarned}>+{item.points_earned} pts</Text>
                    )}
                    {hasUsed && (
                      <Text style={styles.historyUsed}>-{item.points_used} pts</Text>
                    )}
                    {hasUsed && (
                      <Text style={styles.historySaved}>saved RM{item.discount_rm.toFixed(2)}</Text>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: '#92400E',
  },
  headerTitle: { ...Typography.h3, color: '#fff' },

  hero: {
    backgroundColor: '#92400E',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl + 8,
    alignItems: 'center',
  },
  starIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  pointsLabel: { ...Typography.bodySmall, color: 'rgba(255,255,255,0.75)', marginBottom: 6 },
  pointsValue: { fontSize: 56, fontWeight: '800', color: '#FCD34D', lineHeight: 64 },
  pointsRm: { ...Typography.body, color: 'rgba(255,255,255,0.85)', marginBottom: 20, marginTop: 4 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 32 },
  statItem: { alignItems: 'center' },
  statVal: { ...Typography.h3, color: '#fff' },
  statLbl: { ...Typography.caption, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.25)' },

  section: { padding: Spacing.lg },
  sectionTitle: { ...Typography.h3, color: colors.text, marginBottom: Spacing.md },

  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: Spacing.md },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  infoIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  infoText: { ...Typography.bodySmall, color: colors.text, flex: 1, lineHeight: 20 },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: { ...Typography.bodySmall, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  historyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  historyBody: { flex: 1 },
  historyWorkshop: { ...Typography.bodySmall, fontWeight: '600', color: colors.text },
  historyDate: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },
  historyRight: { alignItems: 'flex-end', gap: 2 },
  historyEarned: { ...Typography.bodySmall, fontWeight: '700', color: colors.success },
  historyUsed: { ...Typography.bodySmall, fontWeight: '700', color: colors.danger },
  historySaved: { ...Typography.caption, color: colors.textSecondary },
  });
}
