import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, AppTheme } from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { bookingAPI } from '../../services/api';

interface Props { navigation: any }

interface VehicleHealth {
  vehicle_plate: string;
  vehicle_name: string | null;
  vehicle_brand: string | null;
  score: number | null;
  status: string;
  last_service: string | null;
  last_workshop: string | null;
  next_due: string | null;
  days_until_due: number | null;
  days_overdue: number | null;
  service_count: number;
  next_service_months: number | null;
}

function scoreColor(score: number | null): string {
  if (score === null) return '#94A3B8';
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#34D399';
  if (score >= 40) return '#F59E0B';
  if (score >= 20) return '#F97316';
  return '#EF4444';
}

function scoreLabel(score: number | null, status: string): string {
  if (score === null) return status === 'No History' ? 'No Service History' : 'Unknown';
  return status;
}

function ScoreGauge({ score, size = 130 }: { score: number | null; size?: number }) {
  const color = scoreColor(score);
  const strokeWidth = 11;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score !== null ? score / 100 : 0;
  const dashOffset = circumference * (1 - progress);
  const cx = size / 2;
  const cy = size / 2;

  return (
    // @ts-ignore — SVG works on Expo web
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      {/* Background ring */}
      {/* @ts-ignore */}
      <circle
        cx={cx} cy={cy} r={radius}
        fill="none" stroke="#E2E8F0" strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      {score !== null && (
        // @ts-ignore
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      )}
      {/* Score text */}
      {/* @ts-ignore */}
      <text
        x="50%" y="44%" textAnchor="middle" dominantBaseline="middle"
        fontSize="30" fontWeight="800" fill={color}
      >
        {score !== null ? score : '–'}
      </text>
      {/* "/100" label */}
      {/* @ts-ignore */}
      <text
        x="50%" y="66%" textAnchor="middle" dominantBaseline="middle"
        fontSize="11" fontWeight="600" fill="#94A3B8"
      >
        {score !== null ? '/100' : 'N/A'}
      </text>
    </svg>
  );
}

function daysLabel(item: VehicleHealth): { text: string; color: string; icon: string } {
  if (item.score === null) return { text: 'Service this vehicle to generate a score', color: '#94A3B8', icon: 'information-circle-outline' };
  if ((item.days_overdue ?? 0) > 0) return { text: `Overdue by ${item.days_overdue} day${item.days_overdue === 1 ? '' : 's'}`, color: '#EF4444', icon: 'warning-outline' };
  if ((item.days_until_due ?? 0) === 0) return { text: 'Due today!', color: '#F59E0B', icon: 'alarm-outline' };
  if ((item.days_until_due ?? 0) <= 14) return { text: `Due in ${item.days_until_due} days`, color: '#F97316', icon: 'alarm-outline' };
  if ((item.days_until_due ?? 0) <= 30) return { text: `Due in ${item.days_until_due} days`, color: '#F59E0B', icon: 'time-outline' };
  const months = Math.round((item.days_until_due ?? 0) / 30);
  return { text: `Next service in ~${months} month${months === 1 ? '' : 's'}`, color: '#10B981', icon: 'checkmark-circle-outline' };
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fleetAvgScore(items: VehicleHealth[]): number | null {
  const scored = items.filter((i) => i.score !== null);
  if (scored.length === 0) return null;
  return Math.round(scored.reduce((s, i) => s + (i.score ?? 0), 0) / scored.length);
}

export const CarHealthScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [health, setHealth] = useState<VehicleHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await bookingAPI.getVehicleHealth();
      setHealth(res.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const avgScore = fleetAvgScore(health);
  const avgColor = scoreColor(avgScore);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Car Health Score</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Fleet summary banner */}
          <View style={[styles.fleetBanner, { borderColor: avgColor + '40' }]}>
            <View style={styles.fleetLeft}>
              <Text style={styles.fleetTitle}>Fleet Health</Text>
              <Text style={styles.fleetSub}>{health.length} vehicle{health.length !== 1 ? 's' : ''} tracked</Text>
              {avgScore !== null ? (
                <View style={[styles.fleetBadge, { backgroundColor: avgColor + '18', borderColor: avgColor + '40' }]}>
                  <Text style={[styles.fleetBadgeText, { color: avgColor }]}>{scoreLabel(avgScore, '')}{avgScore >= 80 ? ' 🟢' : avgScore >= 60 ? ' 🟡' : avgScore >= 40 ? ' 🟠' : ' 🔴'}</Text>
                </View>
              ) : (
                <Text style={styles.fleetNoData}>No service history yet</Text>
              )}
            </View>
            <ScoreGauge score={avgScore} size={110} />
          </View>

          {/* How score is calculated */}
          <View style={styles.explainer}>
            <Ionicons name="information-circle-outline" size={15} color={colors.textSecondary} />
            <Text style={styles.explainerText}>
              Score is based on time since last service vs recommended interval. 100 = just serviced, 0 = overdue.
            </Text>
          </View>

          {/* Per-vehicle cards */}
          {health.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>🚗</Text>
              <Text style={styles.emptyTitle}>No vehicles found</Text>
              <Text style={styles.emptySub}>Add vehicles to your profile and complete a service booking to see your health score.</Text>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate('HomeTab')}
              >
                <Text style={styles.emptyBtnText}>Book a Service</Text>
              </TouchableOpacity>
            </View>
          ) : (
            health.map((item) => {
              const color = scoreColor(item.score);
              const due = daysLabel(item);
              const progressPct = item.score !== null ? item.score / 100 : 0;

              return (
                <View key={item.vehicle_plate} style={[styles.card, { borderLeftColor: color }]}>
                  {/* Card header */}
                  <View style={styles.cardTop}>
                    <View style={styles.cardTopLeft}>
                      <View style={[styles.plateChip, { backgroundColor: color + '15', borderColor: color + '40' }]}>
                        <Text style={[styles.plateText, { color }]}>{item.vehicle_plate}</Text>
                      </View>
                      <Text style={styles.vehicleName}>
                        {item.vehicle_brand} {item.vehicle_name}
                      </Text>
                    </View>
                    <ScoreGauge score={item.score} size={110} />
                  </View>

                  {/* Progress bar */}
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progressPct * 100}%` as any, backgroundColor: color }]} />
                  </View>

                  {/* Status label */}
                  <View style={[styles.statusRow, { backgroundColor: color + '12' }]}>
                    <Ionicons name={due.icon as any} size={13} color={due.color} />
                    <Text style={[styles.statusText, { color: due.color }]}>{due.text}</Text>
                  </View>

                  {/* Detail rows */}
                  <View style={styles.detailGrid}>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Last Serviced</Text>
                      <Text style={styles.detailValue}>{formatDate(item.last_service)}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Next Due</Text>
                      <Text style={[styles.detailValue, { color: (item.days_overdue ?? 0) > 0 ? '#EF4444' : colors.text }]}>
                        {formatDate(item.next_due)}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Services Done</Text>
                      <Text style={styles.detailValue}>{item.service_count}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Service Interval</Text>
                      <Text style={styles.detailValue}>
                        {item.next_service_months ? `${item.next_service_months} month${item.next_service_months === 1 ? '' : 's'}` : '—'}
                      </Text>
                    </View>
                  </View>

                  {item.last_workshop && (
                    <View style={styles.workshopRow}>
                      <Ionicons name="build-outline" size={12} color={colors.textSecondary} />
                      <Text style={styles.workshopText} numberOfLines={1}>Last at: {item.last_workshop}</Text>
                    </View>
                  )}

                  {/* CTA if overdue or near due */}
                  {(item.score !== null && item.score < 40) && (
                    <TouchableOpacity
                      style={[styles.bookBtn, { backgroundColor: item.score < 20 ? '#EF4444' : '#F97316' }]}
                      onPress={() => navigation.navigate('HomeTab')}
                    >
                      <Ionicons name="calendar-outline" size={14} color="#fff" />
                      <Text style={styles.bookBtnText}>
                        {item.score < 20 ? 'Book Service Now — Overdue!' : 'Book Service Soon'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { ...Typography.h3, color: colors.text },
    content: { padding: Spacing.lg },

    fleetBanner: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg, borderWidth: 1,
      padding: Spacing.lg, marginBottom: Spacing.md,
    },
    fleetLeft: { flex: 1, marginRight: 12 },
    fleetTitle: { ...Typography.h3, color: colors.text, marginBottom: 4 },
    fleetSub: { ...Typography.caption, color: colors.textSecondary, marginBottom: 10 },
    fleetBadge: {
      alignSelf: 'flex-start', borderRadius: 999, borderWidth: 1,
      paddingHorizontal: 12, paddingVertical: 5,
    },
    fleetBadgeText: { fontSize: 13, fontWeight: '700' },
    fleetNoData: { ...Typography.caption, color: colors.textSecondary },

    explainer: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      backgroundColor: colors.surface, borderRadius: BorderRadius.md,
      padding: Spacing.md, marginBottom: Spacing.lg,
    },
    explainerText: { ...Typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 18 },

    card: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.lg, borderWidth: 1,
      borderColor: colors.border, borderLeftWidth: 4,
      padding: Spacing.md, marginBottom: Spacing.md,
    },
    cardTop: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', marginBottom: Spacing.sm,
    },
    cardTopLeft: { flex: 1 },
    plateChip: {
      alignSelf: 'flex-start', borderRadius: 6, borderWidth: 1,
      paddingHorizontal: 10, paddingVertical: 4, marginBottom: 6,
    },
    plateText: { fontSize: 14, fontWeight: '800', letterSpacing: 1 },
    vehicleName: { ...Typography.body, color: colors.text, fontWeight: '600' },

    progressTrack: {
      height: 6, backgroundColor: colors.border,
      borderRadius: 3, marginVertical: Spacing.sm, overflow: 'hidden',
    },
    progressFill: { height: 6, borderRadius: 3 },

    statusRow: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      borderRadius: BorderRadius.sm, padding: 8, marginBottom: Spacing.md,
    },
    statusText: { fontSize: 13, fontWeight: '600', flex: 1 },

    detailGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 0,
      borderTopWidth: 1, borderTopColor: colors.border, paddingTop: Spacing.sm,
    },
    detailItem: { width: '50%', paddingVertical: 6, paddingRight: 8 },
    detailLabel: { ...Typography.caption, color: colors.textSecondary, marginBottom: 2 },
    detailValue: { ...Typography.body, color: colors.text, fontWeight: '600', fontSize: 14 },

    workshopRow: {
      flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6,
    },
    workshopText: { ...Typography.caption, color: colors.textSecondary, flex: 1 },

    bookBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, borderRadius: BorderRadius.md, padding: 12, marginTop: Spacing.md,
    },
    bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    emptyState: { alignItems: 'center', paddingVertical: 48 },
    emptyTitle: { ...Typography.h3, color: colors.text, marginBottom: 8 },
    emptySub: { ...Typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24, paddingHorizontal: 16 },
    emptyBtn: { paddingHorizontal: 28, paddingVertical: 13, borderRadius: BorderRadius.lg },
    emptyBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}
