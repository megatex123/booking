import React, { useEffect, useState, useCallback, useMemo} from 'react';
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

interface Props { navigation: any }

const FILTERS = [
  { key: 'all',         label: 'All',        icon: 'apps-outline' },
  { key: 'pending',     label: 'Pending',    icon: 'time-outline' },
  { key: 'confirmed',   label: 'Confirmed',  icon: 'checkmark-circle-outline' },
  { key: 'in_progress', label: 'In Progress',icon: 'construct-outline' },
  { key: 'completed',   label: 'Done',       icon: 'ribbon-outline' },
  { key: 'cancelled',   label: 'Cancelled',  icon: 'close-circle-outline' },
] as const;

const STATS = [
  { key: 'pending',     label: 'Pending',  icon: 'time',         color: Statuscolors.pending },
  { key: 'in_progress', label: 'Active',   icon: 'construct',    color: Statuscolors.in_progress },
  { key: 'completed',   label: 'Done',     icon: 'ribbon',       color: Statuscolors.completed },
  { key: 'rejected',    label: 'Rejected', icon: 'close-circle', color: Statuscolors.rejected },
];

export const BookingHistoryScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const { bookings, loading } = useAppSelector((s) => s.bookings);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => dispatch(fetchMyBookings(undefined)), [dispatch]);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);
  const countOf = (s: string) => bookings.filter((b) => b.status === s).length;

  const renderBooking = ({ item }: { item: Booking }) => {
    const accent = StatusColors[item.status] || colors.textLight;
    const canPay = ['confirmed', 'completed'].includes(item.status) && item.payment_status === 'unpaid';
    const canChat = ['confirmed', 'in_progress'].includes(item.status);
    const canReview = item.status === 'completed' && item.payment_status === 'paid' && !item.has_review;
    const canCancel = ['pending', 'confirmed'].includes(item.status);
    const awaitingPayment = item.status === 'completed' && item.payment_status === 'unpaid';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
        activeOpacity={0.88}
      >
        {/* Left accent strip */}
        <View style={[styles.accent, { backgroundColor: accent }]} />

        <View style={styles.cardBody}>
          {/* Header row */}
          <View style={styles.cardHeader}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.workshopName} numberOfLines={1}>{item.workshop_name}</Text>
              <Text style={styles.services} numberOfLines={1}>
                {item.services.map((s: any) => s.name).join(' · ')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <StatusBadge status={item.status} />
              {item.payment_status === 'unpaid' && item.status !== 'cancelled' && item.status !== 'rejected' && (
                <View style={styles.unpaidBadge}>
                  <Text style={styles.unpaidText}>Unpaid</Text>
                </View>
              )}
            </View>
          </View>

          {/* Info row */}
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.infoText}>{formatDate(item.scheduled_date)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.infoText}>{formatTime(item.scheduled_time)}</Text>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="car-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.infoText}>{item.vehicle_plate}</Text>
            </View>
          </View>

          {/* Pay-to-unlock notice */}
          {awaitingPayment && (
            <View style={styles.payNotice}>
              <Ionicons name="card-outline" size={12} color={colors.warning} />
              <Text style={styles.payNoticeText}>Pay to unlock review</Text>
            </View>
          )}

          {/* Footer: total + quick actions */}
          <View style={styles.cardFooter}>
            <Text style={styles.price}>{formatPrice(item.total_price)}</Text>
            <View style={styles.actions}>
              {canPay && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.success }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    navigation.navigate('Payment', { bookingId: item.id, totalPrice: item.total_price });
                  }}
                >
                  <Ionicons name="card-outline" size={13} color="#fff" />
                  <Text style={styles.actionText}>Pay</Text>
                </TouchableOpacity>
              )}
              {canChat && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    navigation.navigate('Chat', { bookingId: item.id, workshopName: item.workshop_name });
                  }}
                >
                  <Ionicons name="chatbubble-outline" size={13} color="#fff" />
                  <Text style={styles.actionText}>Chat</Text>
                </TouchableOpacity>
              )}
              {canReview && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.warning }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    navigation.navigate('Review', { booking: item });
                  }}
                >
                  <Ionicons name="star-outline" size={13} color="#fff" />
                  <Text style={styles.actionText}>Review</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.textLight }]}
                onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
              >
                <Text style={styles.actionText}>Details</Text>
                <Ionicons name="chevron-forward" size={13} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const emptyMessages: Record<string, { icon: any; text: string }> = {
    all: { icon: 'receipt-outline', text: 'No bookings yet.\nExplore workshops to make your first booking!' },
    pending: { icon: 'time-outline', text: 'No pending bookings' },
    confirmed: { icon: 'checkmark-circle-outline', text: 'No confirmed bookings' },
    in_progress: { icon: 'construct-outline', text: 'No active services right now' },
    completed: { icon: 'ribbon-outline', text: 'No completed services yet' },
    cancelled: { icon: 'close-circle-outline', text: 'No cancelled bookings' },
    rejected: { icon: 'close-circle-outline', text: 'No rejected bookings' },
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
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

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        style={styles.filterScroll}
      >
        {FILTERS.map((f) => {
          const count = f.key === 'all' ? bookings.length : countOf(f.key);
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Ionicons name={f.icon as any} size={13} color={active ? '#fff' : colors.textSecondary} />
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {f.label}
              </Text>
              {count > 0 && (
                <View style={[styles.countBadge, active && styles.countBadgeActive]}>
                  <Text style={[styles.countText, active && styles.countTextActive]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.resultCount}>
        {filtered.length} booking{filtered.length !== 1 ? 's' : ''}
      </Text>

      {loading && !refreshing ? (
        <Loading message="Loading bookings..." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, filtered.length === 0 && styles.listEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name={emptyMessages[filter]?.icon} size={40} color={colors.textLight} />
              </View>
              <Text style={styles.emptyText}>{emptyMessages[filter]?.text}</Text>
              {filter === 'all' && (
                <TouchableOpacity
                  style={styles.exploreBtn}
                  onPress={() => navigation.navigate('HomeTab')}
                >
                  <Text style={styles.exploreBtnText}>Explore Workshops</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={renderBooking}
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
  filterChip: {
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
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { ...Typography.caption, color: colors.textSecondary, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  countBadge: {
    backgroundColor: colors.border,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  countText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
  countTextActive: { color: '#fff' },

  resultCount: {
    ...Typography.caption,
    color: colors.textSecondary,
    paddingHorizontal: Spacing.lg,
    marginBottom: 8,
  },

  list: { paddingHorizontal: Spacing.lg, paddingBottom: 32, gap: 12 },
  listEmpty: { flex: 1 },

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
  workshopName: { ...Typography.body, fontWeight: '700', color: colors.text },
  services: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },
  unpaidBadge: {
    backgroundColor: colors.danger + '15',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  unpaidText: { fontSize: 10, fontWeight: '600', color: colors.danger },

  payNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.warning + '12',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  payNoticeText: { fontSize: 11, fontWeight: '600', color: colors.warning },
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
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyText: { ...Typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 24 },
  exploreBtn: {
    marginTop: 20,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
  },
  exploreBtnText: { ...Typography.button, color: '#fff' },
  });
}
