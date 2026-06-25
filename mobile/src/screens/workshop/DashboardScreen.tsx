import React, { useEffect, useCallback, useMemo} from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Loading } from '../../components/common/Loading';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchMyBookings } from '../../store/bookingSlice';
import { fetchMyWorkshop } from '../../store/workshopSlice';
import { fetchUnreadCount } from '../../store/notificationSlice';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { ShakingBell } from '../../components/common/ShakingBell';
import { formatPrice, formatDate, formatTime } from '../../utils/helpers';
import { Booking } from '../../types';

interface Props {
  navigation: any;
}

export const DashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const { bookings, loading } = useAppSelector((s) => s.bookings);
  const { myWorkshop } = useAppSelector((s) => s.workshops);
  const { user } = useAppSelector((s) => s.auth);
  const { unreadCount: notifUnread } = useAppSelector((s) => s.notifications);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = useCallback(() => {
    dispatch(fetchMyWorkshop());
    dispatch(fetchMyBookings(undefined));
    dispatch(fetchUnreadCount());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([dispatch(fetchMyWorkshop()), dispatch(fetchMyBookings(undefined))]);
    setRefreshing(false);
  };

  const pendingBookings = bookings.filter((b) => b.status === 'pending');
  const todayBookings = bookings.filter((b) => {
    const today = new Date().toISOString().split('T')[0];
    return b.scheduled_date === today && ['confirmed', 'in_progress'].includes(b.status);
  });
  const completedCount = bookings.filter((b) => b.status === 'completed').length;
  const rejectedCount = bookings.filter((b) => b.status === 'rejected').length;
  const revenue = bookings
    .filter((b) => b.status === 'completed' && b.payment_status === 'paid')
    .reduce((sum, b) => sum + b.total_price, 0);

  const goToBookings = (filterKey: string) => {
    navigation.navigate('BookingsTab', {
      screen: 'Bookings',
      params: { initialFilter: filterKey, _ts: Date.now() },
    });
  };

  const revenueCard = { icon: 'cash-outline', label: 'Revenue', value: `RM ${revenue.toFixed(0)}`, color: colors.secondary, filter: 'completed' };
  const stats = [
    { icon: 'time-outline',            label: 'Pending',    value: pendingBookings.length,   color: colors.warning,   filter: 'pending' },
    { icon: 'calendar-outline',        label: "Today's",    value: todayBookings.length,     color: colors.primary,   filter: 'in_progress' },
    { icon: 'checkmark-circle-outline',label: 'Completed',  value: completedCount,           color: colors.success,   filter: 'completed' },
    { icon: 'close-circle-outline',    label: 'Rejected',   value: rejectedCount,            color: colors.danger,    filter: 'rejected' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]}! 👋</Text>
            <Text style={styles.workshopName}>{myWorkshop?.workshop_name || 'Your Workshop'}</Text>
          </View>
          <View style={styles.headerActions}>
            <ShakingBell
              unreadCount={notifUnread}
              onPress={() => navigation.navigate('Notifications')}
            />
            <TouchableOpacity onPress={() => navigation.navigate('WorkshopManagement')} style={styles.headerIconBtn}>
              <Ionicons name="grid-outline" size={22} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.navigate('WorkshopProfile')} style={styles.headerIconBtn}>
              <Ionicons name="settings-outline" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Open/Closed Toggle */}
        {myWorkshop && (
          <View style={styles.statusBar}>
            <View style={[styles.statusIndicator, myWorkshop.is_open ? styles.openIndicator : styles.closedIndicator]} />
            <Text style={styles.statusBarText}>
              Workshop is currently <Text style={{ fontWeight: '700' }}>{myWorkshop.is_open ? 'Open' : 'Closed'}</Text>
            </Text>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsGrid}>
          {/* Revenue — spans full row */}
          <TouchableOpacity
            style={styles.revenueCard}
            onPress={() => goToBookings(revenueCard.filter)}
            activeOpacity={0.8}
          >
            <Ionicons name={revenueCard.icon as any} size={26} color={revenueCard.color} />
            <Text style={[styles.statValue, styles.statValueLarge, { color: revenueCard.color }]}>{revenueCard.value}</Text>
            <Text style={styles.statLabel}>{revenueCard.label}</Text>
          </TouchableOpacity>
          {/* 4 stats in 2 rows of 2 */}
          <View style={styles.statsRow}>
            {stats.slice(0, 2).map((stat) => (
              <TouchableOpacity key={stat.label} style={styles.statCard} onPress={() => goToBookings(stat.filter)} activeOpacity={0.8}>
                <Ionicons name={stat.icon as any} size={22} color={stat.color} />
                <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.statsRow}>
            {stats.slice(2, 4).map((stat) => (
              <TouchableOpacity key={stat.label} style={styles.statCard} onPress={() => goToBookings(stat.filter)} activeOpacity={0.8}>
                <Ionicons name={stat.icon as any} size={22} color={stat.color} />
                <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Pending Requests */}
        {pendingBookings.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Pending Requests</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Bookings')}>
                <Text style={styles.seeAll}>See all</Text>
              </TouchableOpacity>
            </View>
            {pendingBookings.slice(0, 3).map((booking) => (
              <BookingRequestCard
                key={booking.id}
                booking={booking}
                onPress={() => navigation.navigate('WorkshopBookingDetail', { bookingId: booking.id })}
              />
            ))}
          </View>
        )}

        {/* Today's Schedule */}
        {todayBookings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
            {todayBookings.map((booking) => (
              <BookingRequestCard
                key={booking.id}
                booking={booking}
                onPress={() => navigation.navigate('WorkshopBookingDetail', { bookingId: booking.id })}
              />
            ))}
          </View>
        )}

        {pendingBookings.length === 0 && todayBookings.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={56} color={colors.textLight} />
            <Text style={styles.emptyTitle}>All clear!</Text>
            <Text style={styles.emptyText}>No pending requests or scheduled jobs today.</Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const BookingRequestCard = ({ booking, onPress }: { booking: Booking; onPress: () => void }) => {
  const { colors } = useTheme();
  const bStyles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 1,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    customer: { ...Typography.body, fontWeight: '600', color: colors.text },
    services: { ...Typography.caption, color: colors.textSecondary, marginBottom: 8 },
    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    vehicleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    meta: { ...Typography.caption, color: colors.textSecondary },
    price: { ...Typography.body, fontWeight: '700', color: colors.primary },
  }), [colors]);
  return (
    <TouchableOpacity style={bStyles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={bStyles.header}>
        <Text style={bStyles.customer}>{booking.customer_name}</Text>
        <StatusBadge status={booking.status} />
      </View>
      <Text style={bStyles.services} numberOfLines={1}>
        {booking.services.map((s: any) => s.name).join(', ')}
      </Text>
      <View style={bStyles.footer}>
        <View style={bStyles.metaItem}>
          <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
          <Text style={bStyles.meta}>{formatDate(booking.scheduled_date)} · {formatTime(booking.scheduled_time)}</Text>
        </View>
        <Text style={bStyles.price}>{formatPrice(booking.total_price)}</Text>
      </View>
      <View style={bStyles.vehicleRow}>
        <Ionicons name="car-outline" size={12} color={colors.textSecondary} />
        <Text style={bStyles.meta}>{booking.vehicle_brand} {booking.vehicle_name} ({booking.vehicle_plate})</Text>
      </View>
    </TouchableOpacity>
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
    paddingVertical: Spacing.md,
  },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerIconBtn: { padding: 6, position: 'relative' },
  notifBadge: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: colors.danger, borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  greeting: { ...Typography.h3, color: colors.text },
  workshopName: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
  },
  statusIndicator: { width: 10, height: 10, borderRadius: 5 },
  openIndicator: { backgroundColor: colors.success },
  closedIndicator: { backgroundColor: colors.danger },
  statusBarText: { ...Typography.bodySmall, color: colors.textSecondary },
  statsGrid: {
    gap: 10,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  revenueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 22,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 20,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statValueLarge: { fontSize: 28, lineHeight: 34 },
  statValue: { ...Typography.h2, fontWeight: '700' },
  statLabel: { ...Typography.caption, color: colors.textSecondary },
  section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { ...Typography.h3, color: colors.text },
  seeAll: { ...Typography.bodySmall, color: colors.primary, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: Spacing.lg },
  emptyTitle: { ...Typography.h3, color: colors.text, marginTop: 16, marginBottom: 8 },
  emptyText: { ...Typography.body, color: colors.textSecondary, textAlign: 'center' },
  });
}
