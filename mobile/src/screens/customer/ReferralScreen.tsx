import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { referralAPI } from '../../services/api';
import { Colors, Typography, Spacing, BorderRadius } from '../../utils/theme';
import { showAlert } from '../../utils/webAlert';

interface Props { navigation: any }

interface ReferralStats {
  code: string;
  credits: number;
  total_referrals: number;
  rewarded_referrals: number;
  pending_referrals: number;
  reward_per_referral: number;
  discount_pct: number;
  discount_cap: number;
}

interface HistoryItem {
  id: string;
  referee_name: string;
  booking_id: string | null;
  discount_given: number;
  reward_earned: number;
  status: 'pending' | 'rewarded';
  created_at: string;
}

function copyToClipboard(text: string) {
  if (Platform.OS === 'web') {
    navigator.clipboard?.writeText(text).catch(() => {});
  }
}

export const ReferralScreen: React.FC<Props> = ({ navigation }) => {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, hRes] = await Promise.all([referralAPI.getMyCode(), referralAPI.getHistory()]);
      setStats(sRes.data);
      setHistory(hRes.data);
    } catch {
      showAlert('Error', 'Could not load referral data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCopy = () => {
    if (!stats) return;
    copyToClipboard(stats.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ flex: 1 }} color={Colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Referral Program</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="gift" size={36} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Invite Friends, Earn Rewards</Text>
          <Text style={styles.heroSub}>
            Your friend gets {stats?.discount_pct}% off their first booking (up to RM{stats?.discount_cap?.toFixed(0)}).
            You earn RM{stats?.reward_per_referral?.toFixed(0)} credit when their booking completes.
          </Text>
        </View>

        {/* Credits balance */}
        <View style={styles.creditsCard}>
          <Text style={styles.creditsLabel}>Available Credits</Text>
          <Text style={styles.creditsValue}>RM {stats?.credits?.toFixed(2)}</Text>
          <Text style={styles.creditsNote}>Applied automatically at checkout</Text>
        </View>

        {/* Code card */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your Referral Code</Text>
          <View style={styles.codeRow}>
            <Text style={styles.code}>{stats?.code}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={handleCopy}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={copied ? Colors.success : Colors.primary} />
              <Text style={[styles.copyText, copied && { color: Colors.success }]}>{copied ? 'Copied!' : 'Copy'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { label: 'Total Referrals', value: stats?.total_referrals ?? 0 },
            { label: 'Completed', value: stats?.rewarded_referrals ?? 0 },
            { label: 'Pending', value: stats?.pending_referrals ?? 0 },
          ].map((s, i) => (
            <View key={i} style={[styles.statCell, i < 2 && styles.statBorder]}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* History */}
        <Text style={styles.sectionTitle}>Referral History</Text>
        {history.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={Colors.textLight} />
            <Text style={styles.emptyText}>No referrals yet. Share your code to get started!</Text>
          </View>
        ) : (
          history.map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <View style={styles.historyRow}>
                <View style={[styles.statusDot, { backgroundColor: item.status === 'rewarded' ? Colors.success : Colors.warning }]} />
                <Text style={styles.historyName}>{item.referee_name || 'Friend'}</Text>
                <Text style={styles.historyDate}>{item.created_at.slice(0, 10)}</Text>
              </View>
              <View style={styles.historyDetails}>
                <Text style={styles.historyDetail}>
                  Discount given: <Text style={styles.historyAmount}>RM{item.discount_given.toFixed(2)}</Text>
                </Text>
                {item.status === 'rewarded' && (
                  <Text style={styles.historyDetail}>
                    Reward earned: <Text style={[styles.historyAmount, { color: Colors.success }]}>+RM{item.reward_earned.toFixed(2)}</Text>
                  </Text>
                )}
                <View style={[styles.statusBadge, { backgroundColor: item.status === 'rewarded' ? Colors.success + '20' : Colors.warning + '20' }]}>
                  <Text style={[styles.statusText, { color: item.status === 'rewarded' ? Colors.success : Colors.warning }]}>
                    {item.status === 'rewarded' ? 'Rewarded' : 'Pending completion'}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.h3, color: Colors.text },
  hero: {
    alignItems: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  heroIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8, textAlign: 'center' },
  heroSub: { ...Typography.body, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 22 },
  creditsCard: {
    marginHorizontal: Spacing.lg, marginTop: Spacing.lg,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.lg, alignItems: 'center',
    borderWidth: 2, borderColor: '#8B5CF6',
  },
  creditsLabel: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 4 },
  creditsValue: { fontSize: 32, fontWeight: '800', color: '#8B5CF6' },
  creditsNote: { ...Typography.caption, color: Colors.textLight, marginTop: 4 },
  codeCard: {
    marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.lg,
  },
  codeLabel: { ...Typography.caption, color: Colors.textSecondary, marginBottom: 10 },
  codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  code: { fontSize: 28, fontWeight: '800', color: Colors.text, letterSpacing: 4 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.sm, backgroundColor: Colors.primary + '15' },
  copyText: { ...Typography.bodySmall, color: Colors.primary, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg, marginTop: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md },
  statBorder: { borderRightWidth: 1, borderRightColor: Colors.border },
  statValue: { ...Typography.h2, color: Colors.primary },
  statLabel: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  sectionTitle: { ...Typography.h3, color: Colors.text, marginHorizontal: Spacing.lg, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  empty: { alignItems: 'center', paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg },
  emptyText: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginTop: 12 },
  historyCard: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  historyRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  historyName: { ...Typography.body, color: Colors.text, fontWeight: '600', flex: 1 },
  historyDate: { ...Typography.caption, color: Colors.textLight },
  historyDetails: { gap: 4 },
  historyDetail: { ...Typography.bodySmall, color: Colors.textSecondary },
  historyAmount: { fontWeight: '700', color: Colors.text },
  statusBadge: { alignSelf: 'flex-start', borderRadius: BorderRadius.sm, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  statusText: { ...Typography.caption, fontWeight: '600' },
});
