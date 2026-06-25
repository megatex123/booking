import React, { useEffect, useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchMyBookings } from '../../store/bookingSlice';
import { fetchUnreadCount } from '../../store/notificationSlice';
import { bookingAPI, reviewAPI } from '../../services/api';
import { Colors, Typography, Spacing, BorderRadius, StatusColors, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { ShakingBell } from '../../components/common/ShakingBell';
import { formatPrice, formatDate } from '../../utils/helpers';

interface Props { navigation: any }

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function daysUntil(date: Date): number {
  return Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

const STATUS_ICON: Record<string, string> = {
  pending: 'time-outline',
  confirmed: 'checkmark-circle-outline',
  in_progress: 'construct-outline',
  completed: 'checkmark-done-circle-outline',
  rejected: 'close-circle-outline',
  cancelled: 'ban-outline',
};

export const CustomerDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const { bookings } = useAppSelector((s) => s.bookings);
  const { unreadCount: notifUnread } = useAppSelector((s) => s.notifications);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewCount, setReviewCount] = useState(0);
  const [completedBookings, setCompletedBookings] = useState<any[]>([]);

  const load = useCallback(async () => {
    await Promise.all([
      dispatch(fetchMyBookings(undefined)),
      dispatch(fetchUnreadCount()),
    ]);
    try {
      const [reviewsRes, completedRes] = await Promise.all([
        reviewAPI.getMyReviews(),
        bookingAPI.getMyBookings('completed'),
      ]);
      setReviewCount(reviewsRes.data?.length ?? 0);
      setCompletedBookings(completedRes.data || []);
    } catch {}
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const activeBookings = bookings.filter((b) =>
    ['pending', 'confirmed', 'in_progress'].includes(b.status)
  );
  const recentCompleted = completedBookings.slice(0, 3);

  // Next service due per vehicle
  const vehicles = user?.vehicles || [];
  const vehicleServiceInfo = vehicles.map((v: any) => {
    const vehicleCompleted = completedBookings.filter(
      (b) => b.vehicle_plate?.toUpperCase() === v.plate?.toUpperCase()
    );
    vehicleCompleted.sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    const latest = vehicleCompleted[0];
    if (!latest) return { vehicle: v, dueDate: null, daysLeft: null, serviceCount: 0 };

    const candidates: number[] = [];
    latest.service_reports?.forEach((r: any) => { if (r.next_service_months) candidates.push(r.next_service_months); });
    if (latest.next_service_months) candidates.push(latest.next_service_months);
    if (candidates.length === 0) return { vehicle: v, dueDate: null, daysLeft: null, serviceCount: vehicleCompleted.length };

    const soonest = Math.min(...candidates);
    const dueDate = addMonths(new Date(latest.updated_at), soonest);
    return { vehicle: v, dueDate, daysLeft: daysUntil(dueDate), serviceCount: vehicleCompleted.length };
  });

  const urgencyColor = (days: number | null) => {
    if (days === null) return colors.textLight;
    if (days < 0) return colors.danger;
    if (days < 30) return '#F59E0B';
    return colors.success;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greetingText}>{greeting()},</Text>
            <Text style={styles.userName}>{user?.name?.split(' ')[0]} 👋</Text>
          </View>
          <View style={styles.headerRight}>
            <ShakingBell
              unreadCount={notifUnread}
              onPress={() => navigation.navigate('Notifications')}
            />
            <TouchableOpacity
              style={styles.notifBtn}
              onPress={() => navigation.navigate('ProfileTab', { screen: 'Profile' })}
            >
              <Ionicons name="settings-outline" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.statCard} activeOpacity={0.7} onPress={() => navigation.navigate('BookingsTab')}>
            <Ionicons name="receipt-outline" size={20} color={colors.primary} />
            <Text style={styles.statValue}>{bookings.length}</Text>
            <Text style={styles.statLabel}>Total Bookings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} activeOpacity={0.7} onPress={() => navigation.navigate('BookingsTab', { screen: 'BookingHistory', params: { filter: 'completed' } })}>
            <Ionicons name="checkmark-done-circle-outline" size={20} color={colors.success} />
            <Text style={styles.statValue}>{completedBookings.length}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} activeOpacity={0.7} onPress={() => navigation.navigate('ProfileTab', { screen: 'MyVehicles' })}>
            <Ionicons name="car-outline" size={20} color={colors.secondary} />
            <Text style={styles.statValue}>{vehicles.length}</Text>
            <Text style={styles.statLabel}>Vehicles</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statCard} activeOpacity={0.7} onPress={() => navigation.navigate('MyReviews')}>
            <Ionicons name="star-outline" size={20} color="#F59E0B" />
            <Text style={styles.statValue}>{reviewCount}</Text>
            <Text style={styles.statLabel}>Reviews</Text>
          </TouchableOpacity>
        </View>

        {/* Active bookings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Bookings</Text>
            {activeBookings.length > 0 && (
              <TouchableOpacity onPress={() => navigation.navigate('BookingsTab')}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            )}
          </View>

          {activeBookings.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={32} color={colors.textLight} />
              <Text style={styles.emptyText}>No active bookings</Text>
              <TouchableOpacity
                style={styles.emptyAction}
                onPress={() => navigation.navigate('HomeTab')}
              >
                <Text style={styles.emptyActionText}>Find a Workshop</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={activeBookings}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(b) => b.id}
              contentContainerStyle={styles.bookingsList}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              renderItem={({ item: b }) => (
                <TouchableOpacity
                  style={styles.bookingCard}
                  onPress={() => navigation.navigate('BookingsTab', { screen: 'BookingDetail', params: { bookingId: b.id } })}
                  activeOpacity={0.85}
                >
                  <View style={[styles.bookingStatusBar, { backgroundColor: StatusColors[b.status] || colors.border }]} />
                  <View style={styles.bookingCardBody}>
                    <View style={[styles.statusChip, { backgroundColor: (StatusColors[b.status] || colors.border) + '18' }]}>
                      <Ionicons
                        name={STATUS_ICON[b.status] as any}
                        size={11}
                        color={StatusColors[b.status] || colors.textSecondary}
                      />
                      <Text style={[styles.statusChipText, { color: StatusColors[b.status] || colors.textSecondary }]}>
                        {STATUS_LABEL[b.status]}
                      </Text>
                    </View>

                    <Text style={styles.bookingWorkshop} numberOfLines={1}>{b.workshop_name}</Text>
                    <Text style={styles.bookingServices} numberOfLines={2}>
                      {(b.services || []).map((s: any) => s.name).join(', ')}
                    </Text>

                    <View style={styles.bookingMeta}>
                      <Ionicons name="car-outline" size={12} color={colors.textSecondary} />
                      <Text style={styles.bookingMetaText}>{b.vehicle_plate}</Text>
                    </View>
                    <View style={styles.bookingMeta}>
                      <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
                      <Text style={styles.bookingMetaText}>{formatDate(b.scheduled_date)} · {b.scheduled_time}</Text>
                    </View>

                    <View style={styles.bookingFooter}>
                      <Text style={styles.bookingPrice}>{formatPrice(b.total_price)}</Text>
                      <View style={[styles.payChip, { backgroundColor: b.payment_status === 'paid' ? colors.success + '18' : colors.danger + '12' }]}>
                        <Text style={[styles.payChipText, { color: b.payment_status === 'paid' ? colors.success : colors.danger }]}>
                          {b.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        {/* Quick actions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
          </View>
          <View style={styles.quickActions}>
            {[
              { icon: 'search-outline', label: 'Find Workshop', color: colors.primary, onPress: () => navigation.navigate('HomeTab') },
              { icon: 'receipt-outline', label: 'My Bookings', color: colors.secondary, onPress: () => navigation.navigate('BookingsTab') },
              { icon: 'car-outline', label: 'My Vehicles', color: '#7C3AED', onPress: () => navigation.navigate('ProfileTab', { screen: 'MyVehicles' }) },
              { icon: 'star-outline', label: 'My Reviews', color: '#F59E0B', onPress: () => navigation.navigate('MyReviews') },
            ].map((action) => (
              <TouchableOpacity key={action.label} style={styles.quickAction} onPress={action.onPress} activeOpacity={0.7}>
                <View style={[styles.quickActionIcon, { backgroundColor: action.color + '15' }]}>
                  <Ionicons name={action.icon as any} size={22} color={action.color} />
                </View>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* My Vehicles with service due */}
        {vehicles.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Vehicles</Text>
              <TouchableOpacity onPress={() => navigation.navigate('ProfileTab', { screen: 'MyVehicles' })}>
                <Text style={styles.seeAll}>Manage</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.vehiclesList}>
              {vehicleServiceInfo.map(({ vehicle, dueDate, daysLeft, serviceCount }: any) => (
                <TouchableOpacity
                  key={vehicle.plate}
                  style={styles.vehicleCard}
                  onPress={() => navigation.navigate('ProfileTab', {
                    screen: 'VehicleServiceHistory',
                    params: { vehicle: { plate: vehicle.plate, model: vehicle.name, year: vehicle.year, color: vehicle.color } },
                  })}
                  activeOpacity={0.8}
                >
                  <View style={styles.vehicleIconWrap}>
                    <Ionicons name="car" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.vehicleInfo}>
                    <Text style={styles.vehiclePlate}>{vehicle.plate}</Text>
                    <Text style={styles.vehicleName}>{vehicle.brand} {vehicle.name}{vehicle.year ? ` · ${vehicle.year}` : ''}</Text>
                    {dueDate ? (
                      <View style={styles.dueDateRow}>
                        <Ionicons name="alarm-outline" size={11} color={urgencyColor(daysLeft)} />
                        <Text style={[styles.dueDateText, { color: urgencyColor(daysLeft) }]}>
                          {daysLeft !== null && daysLeft < 0
                            ? 'Service overdue!'
                            : daysLeft !== null && daysLeft === 0
                            ? 'Due today'
                            : `Next service in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.noHistoryText}>No service history</Text>
                    )}
                  </View>
                  <View style={styles.vehicleRight}>
                    {serviceCount > 0 && (
                      <View style={styles.serviceCountBadge}>
                        <Text style={styles.serviceCountText}>{serviceCount}</Text>
                        <Text style={styles.serviceCountLabel}>services</Text>
                      </View>
                    )}
                    <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Recent services */}
        {recentCompleted.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Services</Text>
              <TouchableOpacity onPress={() => navigation.navigate('BookingsTab')}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.recentList}>
              {recentCompleted.map((b: any) => (
                <TouchableOpacity
                  key={b.id}
                  style={styles.recentCard}
                  onPress={() => navigation.navigate('BookingsTab', { screen: 'BookingDetail', params: { bookingId: b.id } })}
                  activeOpacity={0.8}
                >
                  <View style={styles.recentIcon}>
                    <Ionicons name="construct-outline" size={16} color={colors.success} />
                  </View>
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentWorkshop} numberOfLines={1}>{b.workshop_name}</Text>
                    <Text style={styles.recentServices} numberOfLines={1}>
                      {(b.services || []).map((s: any) => s.name).join(', ')}
                    </Text>
                    <Text style={styles.recentDate}>{formatDate(b.scheduled_date)} · {b.vehicle_plate}</Text>
                  </View>
                  <Text style={styles.recentPrice}>{formatPrice(b.total_price)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

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
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.lg,
  },
  headerLeft: {},
  greetingText: { ...Typography.bodySmall, color: colors.textSecondary },
  userName: { ...Typography.h2, color: colors.text, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, position: 'relative',
  },
  notifBadge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: colors.error, borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  avatarSmall: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarSmallText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  statsRow: {
    flexDirection: 'row', gap: 8,
    marginHorizontal: Spacing.lg, marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    padding: 12, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  statValue: { ...Typography.h3, color: colors.text },
  statLabel: { fontSize: 10, fontWeight: '500', color: colors.textSecondary, textAlign: 'center' },

  section: { marginBottom: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, marginBottom: 10,
  },
  sectionTitle: { ...Typography.h3, color: colors.text },
  seeAll: { ...Typography.bodySmall, color: colors.primary, fontWeight: '600' },

  emptyCard: {
    marginHorizontal: Spacing.lg, backgroundColor: colors.surface,
    borderRadius: BorderRadius.md, padding: Spacing.xl,
    alignItems: 'center', gap: 10, borderWidth: 1, borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyText: { ...Typography.body, color: colors.textSecondary },
  emptyAction: {
    backgroundColor: colors.primary, borderRadius: BorderRadius.full,
    paddingHorizontal: 20, paddingVertical: 9, marginTop: 4,
  },
  emptyActionText: { ...Typography.bodySmall, color: '#fff', fontWeight: '600' },

  bookingsList: { paddingHorizontal: Spacing.lg },
  bookingCard: {
    width: 240, backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    flexDirection: 'row', overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  bookingStatusBar: { width: 5 },
  bookingCardBody: { flex: 1, padding: 12, gap: 5 },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: BorderRadius.full, alignSelf: 'flex-start',
  },
  statusChipText: { fontSize: 10, fontWeight: '700' },
  bookingWorkshop: { ...Typography.bodySmall, fontWeight: '700', color: colors.text },
  bookingServices: { ...Typography.caption, color: colors.textSecondary, lineHeight: 15 },
  bookingMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bookingMetaText: { ...Typography.caption, color: colors.textSecondary },
  bookingFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  bookingPrice: { ...Typography.bodySmall, fontWeight: '700', color: colors.primary },
  payChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: BorderRadius.full },
  payChipText: { fontSize: 10, fontWeight: '700' },

  quickActions: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginHorizontal: Spacing.lg, backgroundColor: colors.surface,
    borderRadius: BorderRadius.md, padding: Spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  quickAction: { alignItems: 'center', gap: 6 },
  quickActionIcon: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  quickActionLabel: { fontSize: 10, fontWeight: '600', color: colors.textSecondary, textAlign: 'center', maxWidth: 56 },

  vehiclesList: { marginHorizontal: Spacing.lg, gap: 8 },
  vehicleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  vehicleIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.primary + '12', alignItems: 'center', justifyContent: 'center',
  },
  vehicleInfo: { flex: 1 },
  vehiclePlate: { ...Typography.bodySmall, fontWeight: '700', color: colors.text },
  vehicleName: { ...Typography.caption, color: colors.textSecondary, marginTop: 1 },
  dueDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  dueDateText: { fontSize: 11, fontWeight: '600' },
  noHistoryText: { ...Typography.caption, color: colors.textLight, marginTop: 4 },
  vehicleRight: { alignItems: 'center', gap: 4 },
  serviceCountBadge: { alignItems: 'center' },
  serviceCountText: { ...Typography.bodySmall, fontWeight: '700', color: colors.primary },
  serviceCountLabel: { fontSize: 9, color: colors.textSecondary },

  recentList: { marginHorizontal: Spacing.lg, gap: 8 },
  recentCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  recentIcon: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.success + '12', alignItems: 'center', justifyContent: 'center',
  },
  recentInfo: { flex: 1 },
  recentWorkshop: { ...Typography.bodySmall, fontWeight: '600', color: colors.text },
  recentServices: { ...Typography.caption, color: colors.textSecondary, marginTop: 1 },
  recentDate: { ...Typography.caption, color: colors.textLight, marginTop: 2 },
  recentPrice: { ...Typography.bodySmall, fontWeight: '700', color: colors.primary },
  });
}
