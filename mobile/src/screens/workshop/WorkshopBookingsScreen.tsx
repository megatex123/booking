import React, { useEffect, useState, useCallback, useRef, useMemo} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Loading } from '../../components/common/Loading';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchMyBookings } from '../../store/bookingSlice';
import { Colors, StatusColors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { formatPrice, formatDate, formatTime } from '../../utils/helpers';
import { Booking } from '../../types';

interface Props { navigation: any; route?: any }

const FILTERS = [
  { key: 'all',         label: 'All',         icon: 'apps-outline' },
  { key: 'pending',     label: 'Pending',      icon: 'time-outline' },
  { key: 'confirmed',   label: 'Confirmed',    icon: 'checkmark-circle-outline' },
  { key: 'in_progress', label: 'In Progress',  icon: 'construct-outline' },
  { key: 'completed',   label: 'Done',         icon: 'ribbon-outline' },
  { key: 'rejected',    label: 'Rejected',     icon: 'close-circle-outline' },
];

const STATS = [
  { key: 'pending',     label: 'Pending',  icon: 'time',         color: Statuscolors.pending },
  { key: 'in_progress', label: 'Active',   icon: 'construct',    color: Statuscolors.in_progress },
  { key: 'completed',   label: 'Done',     icon: 'ribbon',       color: Statuscolors.completed },
  { key: 'rejected',    label: 'Rejected', icon: 'close-circle', color: Statuscolors.rejected },
];

export const WorkshopBookingsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const { bookings, loading } = useAppSelector((s) => s.bookings);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const appliedTs = useRef<number | null>(null);

  const load = useCallback(() => dispatch(fetchMyBookings(undefined)), [dispatch]);

  useEffect(() => { load(); }, []);

  // Apply filter from dashboard navigation (track by timestamp to re-apply same filter)
  useEffect(() => {
    const { initialFilter, _ts } = route?.params ?? {};
    if (initialFilter && _ts !== appliedTs.current) {
      appliedTs.current = _ts ?? 0;
      setFilter(initialFilter);
    }
  }, [route?.params?.initialFilter, route?.params?._ts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);
  const countOf = (key: string) =>
    key === 'all' ? bookings.length : bookings.filter((b) => b.status === key).length;

  const renderItem = ({ item }: { item: Booking }) => {
    const accent = StatusColors[item.status] || colors.textLight;
    const isPending = item.status === 'pending';
    const isConfirmed = item.status === 'confirmed';
    const isInProgress = item.status === 'in_progress';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('WorkshopBookingDetail', { bookingId: item.id })}
        activeOpacity={0.88}
      >
        <View style={[styles.accent, { backgroundColor: accent }]} />
        <View style={styles.cardBody}>
          {/* Header */}
          <View style={styles.cardHeader}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.customerName} numberOfLines={1}>{item.customer_name}</Text>
              <Text style={styles.services} numberOfLines={1}>
                {item.services.map((s: any) => s.name).join(' · ')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <StatusBadge status={item.status} />
              <StatusBadge status={item.payment_status} />
            </View>
          </View>

          {/* Info */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="person-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.infoText}>{item.vehicle_plate}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.infoText}>{formatDate(item.scheduled_date)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.infoText}>{formatTime(item.scheduled_time)}</Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.cardFooter}>
            <Text style={styles.price}>{formatPrice(item.total_price)}</Text>
            <View style={styles.actions}>
              {(isPending || isConfirmed || isInProgress) && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    navigation.navigate('Chat', { bookingId: item.id, customerName: item.customer_name });
                  }}
                >
                  <Ionicons name="chatbubble-outline" size={13} color="#fff" />
                  <Text style={styles.actionText}>Chat</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionBtn, {
                  backgroundColor: isPending ? colors.success : colors.textSecondary,
                }]}
                onPress={() => navigation.navigate('WorkshopBookingDetail', { bookingId: item.id })}
              >
                <Text style={styles.actionText}>{isPending ? 'Review' : 'Details'}</Text>
                <Ionicons name="chevron-forward" size={13} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bookings</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      {bookings.length > 0 && (
        <View style={styles.statsRow}>
          {STATS.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={styles.statCard}
              onPress={() => setFilter(s.key)}
              activeOpacity={0.8}
            >
              <View style={[styles.statIcon, { backgroundColor: s.color + '20' }]}>
                <Ionicons name={s.icon as any} size={18} color={s.color} />
              </View>
              <Text style={styles.statCount}>{countOf(s.key)}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        style={styles.filterScroll}
      >
        {FILTERS.map((f) => {
          const count = countOf(f.key);
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Ionicons name={f.icon as any} size={13} color={active ? '#fff' : colors.textSecondary} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
              {count > 0 && (
                <View style={[styles.badge, active && styles.badgeActive]}>
                  <Text style={[styles.badgeText, active && styles.badgeTextActive]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Result count */}
      <Text style={styles.resultCount}>{filtered.length} booking{filtered.length !== 1 ? 's' : ''}</Text>

      {loading && !refreshing ? (
        <Loading message="Loading bookings..." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          contentContainerStyle={[styles.list, filtered.length === 0 && { flex: 1 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="receipt-outline" size={40} color={colors.textLight} />
              </View>
              <Text style={styles.emptyTitle}>No bookings found</Text>
              <Text style={styles.emptyText}>
                {filter === 'pending' ? 'No new requests yet' :
                 filter === 'in_progress' ? 'No active services' :
                 'Nothing here yet'}
              </Text>
            </View>
          }
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
};

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { ...Typography.h2, color: colors.text },
  refreshBtn: { padding: 4 },

  statsRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statCount: { ...Typography.h3, color: colors.text },
  statLabel: { ...Typography.caption, color: colors.textSecondary },

  filterScroll: { maxHeight: 44, marginBottom: 8 },
  filterList: { paddingHorizontal: Spacing.lg, gap: 8, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...Typography.caption, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  badge: {
    backgroundColor: colors.border,
    borderRadius: 8, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
  badgeTextActive: { color: '#fff' },

  resultCount: {
    ...Typography.caption,
    color: colors.textSecondary,
    paddingHorizontal: Spacing.lg,
    marginBottom: 8,
  },

  list: { paddingHorizontal: Spacing.lg, paddingBottom: 32, gap: 12 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  accent: { width: 4 },
  cardBody: { flex: 1, padding: Spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  customerName: { ...Typography.body, fontWeight: '700', color: colors.text },
  services: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },

  infoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  infoText: { ...Typography.caption, color: colors.textSecondary },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { ...Typography.body, fontWeight: '700', color: colors.primary },
  actions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  actionText: { fontSize: 11, fontWeight: '600', color: '#fff' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { ...Typography.h3, color: colors.text, marginBottom: 6 },
  emptyText: { ...Typography.body, color: colors.textSecondary },
  });
}
