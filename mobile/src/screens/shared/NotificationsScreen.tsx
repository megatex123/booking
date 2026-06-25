import React, { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../utils/theme';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchNotifications, markRead, markAllRead } from '../../store/notificationSlice';

interface Props { navigation: any }

const TYPE_ICON: Record<string, { icon: string; color: string }> = {
  new_booking:         { icon: 'calendar',              color: Colors.primary },
  booking_confirmed:   { icon: 'checkmark-circle',      color: Colors.success },
  booking_rejected:    { icon: 'close-circle',          color: Colors.error },
  booking_in_progress: { icon: 'construct',             color: Colors.warning },
  booking_completed:   { icon: 'checkmark-done-circle', color: Colors.success },
  booking_cancelled:   { icon: 'ban',                   color: Colors.error },
  new_message:         { icon: 'chatbubble',            color: Colors.secondary },
  service_reminder:     { icon: 'car-sport',             color: '#F59E0B' },
  low_stock:            { icon: 'warning-outline',        color: '#EF4444' },
  referral_reward:      { icon: 'gift',                  color: '#8B5CF6' },
  loyalty_reward:       { icon: 'star',                  color: '#F59E0B' },
  insurance_claim:      { icon: 'shield-checkmark',      color: '#0EA5E9' },
  insurance_claim_update: { icon: 'shield-checkmark',   color: '#0EA5E9' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { items, unreadCount, loading } = useAppSelector(s => s.notifications);
  const userRole = useAppSelector(s => s.auth.user?.role);

  useEffect(() => {
    dispatch(fetchNotifications());
  }, []);

  const handlePress = useCallback((item: any) => {
    if (!item.is_read) dispatch(markRead(item.id));

    if (item.type === 'service_reminder' && item.data?.workshop_id) {
      // Navigate to the workshop so the customer can rebook
      navigation.getParent()?.navigate('HomeTab', {
        screen: 'WorkshopDetail',
        params: { workshopId: item.data.workshop_id },
      });
      return;
    }

    if (item.data?.booking_id) {
      const screen = userRole === 'workshop' ? 'WorkshopBookingDetail' : 'BookingDetail';
      navigation.navigate(screen, { bookingId: item.data.booking_id });
    }
  }, [dispatch, navigation, userRole]);

  const handleMarkAll = useCallback(() => {
    dispatch(markAllRead());
  }, [dispatch]);

  const renderItem = ({ item }: { item: any }) => {
    const { icon, color } = TYPE_ICON[item.type] || { icon: 'notifications', color: Colors.primary };
    const isReminder = item.type === 'service_reminder';
    return (
      <TouchableOpacity
        style={[styles.item, !item.is_read && styles.itemUnread]}
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: color + '20' }]}>
          <Ionicons name={icon as any} size={22} color={color} />
        </View>
        <View style={styles.itemBody}>
          <View style={styles.itemRow}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            <Text style={styles.itemTime}>{timeAgo(item.created_at)}</Text>
          </View>
          <Text style={styles.itemText}>{item.body}</Text>
          {isReminder && (
            <View style={styles.bookNowRow}>
              <Ionicons name="calendar-outline" size={12} color={color} />
              <Text style={[styles.bookNowText, { color }]}>Book Again →</Text>
            </View>
          )}
        </View>
        {!item.is_read && <View style={styles.dot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAll} style={styles.markBtn}>
            <Text style={styles.markBtnText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 80 }} />
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={Colors.primary} size="large" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={64} color={Colors.textLight} />
              <Text style={styles.emptyTitle}>No notifications</Text>
            </View>
          }
        />
      )}
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
  markBtn: { paddingHorizontal: 8 },
  markBtnText: { ...Typography.bodySmall, color: Colors.primary, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: 100 },
  emptyTitle: { ...Typography.h3, color: Colors.textSecondary, marginTop: Spacing.lg },
  item: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: Colors.surface, padding: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  itemUnread: { backgroundColor: Colors.primary + '08' },
  iconWrap: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md,
  },
  itemBody: { flex: 1 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  itemTitle: { ...Typography.body, fontWeight: '600', color: Colors.text, flex: 1, marginRight: 8 },
  itemTime: { ...Typography.caption, color: Colors.textLight },
  itemText: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 18 },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.primary, marginTop: 6, marginLeft: 6,
  },
  bookNowRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6,
  },
  bookNowText: { fontSize: 12, fontWeight: '600' },
});
