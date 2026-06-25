import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Loading } from '../../components/common/Loading';
import { reviewAPI } from '../../services/api';
import { useAppSelector } from '../../store';
import { Colors, Typography, Spacing, BorderRadius } from '../../utils/theme';
import { formatDate } from '../../utils/helpers';

interface Props { navigation: any }

interface Review {
  id: string;
  booking_id: string;
  customer_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export const WorkshopReviewsScreen: React.FC<Props> = ({ navigation }) => {
  const { myWorkshop } = useAppSelector((s) => s.workshops);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!myWorkshop?.id) return;
    try {
      const res = await reviewAPI.getWorkshopReviews(myWorkshop.id);
      setReviews(res.data || []);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [myWorkshop?.id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const avgRating = reviews.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '–';

  const renderStars = (rating: number, size = 14) => (
    <View style={styles.stars}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < rating ? 'star' : 'star-outline'}
          size={size}
          color={i < rating ? '#FBBC04' : Colors.border}
        />
      ))}
    </View>
  );

  const renderReview = ({ item }: { item: Review }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.customer_name?.[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.customerName}>{item.customer_name}</Text>
          <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        </View>
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={12} color="#FBBC04" />
          <Text style={styles.ratingBadgeText}>{item.rating}</Text>
        </View>
      </View>

      {renderStars(item.rating)}

      {item.comment ? (
        <Text style={styles.comment}>"{item.comment}"</Text>
      ) : (
        <Text style={styles.noComment}>No comment left</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Customer Reviews</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Summary bar */}
      <View style={styles.summary}>
        <View style={styles.summaryLeft}>
          <Text style={styles.avgNumber}>{avgRating}</Text>
          {renderStars(Math.round(Number(avgRating)), 18)}
          <Text style={styles.totalText}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.ratingBreakdown}>
          {[5, 4, 3, 2, 1].map((star) => {
            const count = reviews.filter((r) => r.rating === star).length;
            const pct = reviews.length ? (count / reviews.length) * 100 : 0;
            return (
              <View key={star} style={styles.barRow}>
                <Ionicons name="star" size={11} color="#FBBC04" />
                <Text style={styles.barLabel}>{star}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%` as any }]} />
                </View>
                <Text style={styles.barCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {loading ? (
        <Loading message="Loading reviews..." />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, reviews.length === 0 && styles.listEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="star-outline" size={40} color={Colors.textLight} />
              </View>
              <Text style={styles.emptyTitle}>No reviews yet</Text>
              <Text style={styles.emptyText}>
                Reviews from customers will appear here after they complete a service
              </Text>
            </View>
          }
          renderItem={renderReview}
        />
      )}
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
  refreshBtn: { padding: 4 },

  summary: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    margin: Spacing.lg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryLeft: { alignItems: 'center', justifyContent: 'center', paddingRight: Spacing.md, gap: 6 },
  avgNumber: { fontSize: 40, fontWeight: '700', color: Colors.text, lineHeight: 44 },
  totalText: { ...Typography.caption, color: Colors.textSecondary },
  summaryDivider: { width: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.md },
  stars: { flexDirection: 'row', gap: 2 },

  ratingBreakdown: { flex: 1, justifyContent: 'center', gap: 5 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  barLabel: { ...Typography.caption, color: Colors.textSecondary, width: 10 },
  barTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: '#FBBC04', borderRadius: 3 },
  barCount: { ...Typography.caption, color: Colors.textSecondary, width: 16, textAlign: 'right' },

  list: { paddingHorizontal: Spacing.lg, paddingBottom: 32, gap: 12, paddingTop: 4 },
  listEmpty: { flex: 1 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: { ...Typography.body, fontWeight: '700', color: Colors.primary },
  cardInfo: { flex: 1 },
  customerName: { ...Typography.body, fontWeight: '600', color: Colors.text },
  date: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FBBC0420',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  ratingBadgeText: { fontSize: 12, fontWeight: '700', color: '#B8860B' },
  comment: {
    ...Typography.body,
    color: Colors.text,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  noComment: { ...Typography.caption, color: Colors.textLight, fontStyle: 'italic' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { ...Typography.h3, color: Colors.text, marginBottom: 8 },
  emptyText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.xl,
  },
});
