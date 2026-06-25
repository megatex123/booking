import React, { useEffect, useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { reviewAPI } from '../../services/api';
import { Loading } from '../../components/common/Loading';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';

interface Review {
  id: string;
  booking_id: string;
  workshop_id: string;
  workshop_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface Props { navigation: any }

const Stars = ({ rating }: { rating: number }) => {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 2, marginTop: 4 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={14}
          color={i <= rating ? '#FBBC04' : colors.border}
        />
      ))}
    </View>
  );
};

const formatDate = (iso: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const MyReviewsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await reviewAPI.getMyReviews();
      setReviews(res.data ?? []);
    } catch {
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—';

  const renderItem = ({ item }: { item: Review }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.workshopIcon}>
          <Ionicons name="build" size={18} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.workshopName} numberOfLines={1}>
            {item.workshop_name || 'Workshop'}
          </Text>
          <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
        </View>
        <Stars rating={item.rating} />
      </View>
      {item.comment ? (
        <Text style={styles.comment}>"{item.comment}"</Text>
      ) : (
        <Text style={styles.noComment}>No comment added</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>My Reviews</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.backBtn}>
          <Ionicons name="refresh-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {reviews.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <Text style={styles.avgValue}>{avgRating}</Text>
            <Stars rating={Math.round(Number(avgRating))} />
            <Text style={styles.summaryCount}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.breakdown}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = reviews.filter((r) => r.rating === star).length;
              const pct = reviews.length ? (count / reviews.length) * 100 : 0;
              return (
                <View key={star} style={styles.breakdownRow}>
                  <Text style={styles.breakdownStar}>{star}</Text>
                  <Ionicons name="star" size={10} color="#FBBC04" />
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pct}%` as any }]} />
                  </View>
                  <Text style={styles.breakdownCount}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {loading && !refreshing ? (
        <Loading message="Loading reviews..." />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[styles.list, reviews.length === 0 && { flex: 1 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="star-outline" size={40} color={colors.textLight} />
              </View>
              <Text style={styles.emptyTitle}>No reviews yet</Text>
              <Text style={styles.emptyText}>Reviews appear here after you rate a completed service.</Text>
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
  backBtn: { padding: 4 },
  title: { ...Typography.h2, color: colors.text },

  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryLeft: { alignItems: 'center', width: 80 },
  avgValue: { ...Typography.h1, color: colors.text, fontWeight: '700' },
  summaryCount: { ...Typography.caption, color: colors.textSecondary, marginTop: 4 },
  summaryDivider: { width: 1, backgroundColor: colors.border, alignSelf: 'stretch', marginHorizontal: Spacing.md },
  stars: { flexDirection: 'row', gap: 2, marginTop: 4 },

  breakdown: { flex: 1, gap: 5 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  breakdownStar: { ...Typography.caption, color: colors.text, width: 10, textAlign: 'right' },
  barTrack: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, backgroundColor: '#FBBC04', borderRadius: 3 },
  breakdownCount: { ...Typography.caption, color: colors.textSecondary, width: 16, textAlign: 'right' },

  list: { paddingHorizontal: Spacing.lg, paddingBottom: 32, gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  workshopIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: colors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  workshopName: { ...Typography.body, fontWeight: '700', color: colors.text },
  dateText: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },
  comment: { ...Typography.body, color: colors.text, lineHeight: 22, fontStyle: 'italic' },
  noComment: { ...Typography.caption, color: colors.textLight, fontStyle: 'italic' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { ...Typography.h3, color: colors.text, marginBottom: 8 },
  emptyText: { ...Typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 24 },
  });
}
