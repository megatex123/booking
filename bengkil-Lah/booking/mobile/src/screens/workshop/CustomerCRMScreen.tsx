import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { showAlert } from '../../utils/webAlert';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CRMCustomer {
  customer_id: string;
  name: string;
  phone?: string;
  total_visits: number;
  total_spent: number;
  last_visit: string; // "YYYY-MM-DD"
  vehicles: string[];
}

type SortKey = 'recent' | 'top_spender' | 'most_visits';

interface Props {
  navigation: any;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatLastVisit(dateStr: string): string {
  // dateStr is "YYYY-MM-DD"
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const day = parseInt(parts[2], 10);
  const month = MONTH_NAMES[parseInt(parts[1], 10) - 1] ?? '';
  const year = parts[0];
  return `${day} ${month} ${year}`;
}

function formatMoney(amount: number): string {
  return `RM ${amount.toFixed(0)}`;
}

// ─── Sort config ─────────────────────────────────────────────────────────────

const SORT_OPTIONS: { key: SortKey; label: string; icon: string }[] = [
  { key: 'recent',      label: 'Recent',      icon: 'time-outline' },
  { key: 'top_spender', label: 'Top Spender', icon: 'cash-outline' },
  { key: 'most_visits', label: 'Most Visits', icon: 'repeat-outline' },
];

function sortCustomers(list: CRMCustomer[], sort: SortKey): CRMCustomer[] {
  const copy = [...list];
  if (sort === 'recent') {
    return copy.sort((a, b) => b.last_visit.localeCompare(a.last_visit));
  }
  if (sort === 'top_spender') {
    return copy.sort((a, b) => b.total_spent - a.total_spent);
  }
  // most_visits
  return copy.sort((a, b) => b.total_visits - a.total_visits);
}

// ─── Main component ───────────────────────────────────────────────────────────

export const CustomerCRMScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [customers, setCustomers] = useState<CRMCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await api.get('/workshops/my/customers');
      setCustomers(res.data ?? []);
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ?? 'Failed to load customer data. Please try again.';
      showAlert('Error', msg);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchCustomers().finally(() => setLoading(false));
  }, [fetchCustomers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCustomers();
    setRefreshing(false);
  }, [fetchCustomers]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q
      ? customers.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.phone && c.phone.toLowerCase().includes(q)),
        )
      : customers;
    return sortCustomers(base, sort);
  }, [customers, search, sort]);

  const totalRevenue = useMemo(
    () => customers.reduce((sum, c) => sum + c.total_spent, 0),
    [customers],
  );

  const avgSpend = customers.length > 0 ? totalRevenue / customers.length : 0;

  // ── Render item ────────────────────────────────────────────────────────────

  const renderItem = ({ item }: { item: CRMCustomer }) => {
    const shownVehicles = item.vehicles.slice(0, 2);
    const extraVehicles = item.vehicles.length - shownVehicles.length;

    return (
      <View style={styles.card}>
        {/* Avatar + name row */}
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={22} color={colors.primary} />
          </View>

          <View style={styles.customerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.customerName} numberOfLines={1}>
                {item.name}
              </Text>
              {/* Visit count badge */}
              <View style={styles.visitBadge}>
                <Text style={styles.visitBadgeText}>
                  {item.total_visits} {item.total_visits === 1 ? 'visit' : 'visits'}
                </Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.metaText}>
                Last visit: {formatLastVisit(item.last_visit)}
              </Text>
            </View>

            {item.phone ? (
              <View style={styles.metaRow}>
                <Ionicons name="call-outline" size={12} color={colors.textSecondary} />
                <Text style={styles.metaText}>{item.phone}</Text>
              </View>
            ) : null}
          </View>

          {/* Total spent */}
          <Text style={styles.totalSpent}>{formatMoney(item.total_spent)}</Text>
        </View>

        {/* Vehicles */}
        {item.vehicles.length > 0 && (
          <View style={styles.vehiclesRow}>
            <Ionicons name="car-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.vehicleText} numberOfLines={1}>
              {shownVehicles.join('  ·  ')}
              {extraVehicles > 0 ? `  +${extraVehicles} more` : ''}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Customers</Text>
          {!loading && (
            <Text style={styles.headerCount}>{customers.length} total</Text>
          )}
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={16} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading customers...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.customer_id}
          contentContainerStyle={[
            styles.listContent,
            filtered.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            <>
              {/* Summary stats */}
              {customers.length > 0 && (
                <View style={styles.statsRow}>
                  <View style={styles.statPill}>
                    <Ionicons name="people-outline" size={14} color={colors.primary} />
                    <Text style={styles.statValue}>{customers.length}</Text>
                    <Text style={styles.statLabel}>Customers</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Ionicons name="cash-outline" size={14} color={colors.success} />
                    <Text style={[styles.statValue, { color: colors.success }]}>
                      {formatMoney(totalRevenue)}
                    </Text>
                    <Text style={styles.statLabel}>Revenue</Text>
                  </View>
                  <View style={styles.statPill}>
                    <Ionicons name="trending-up-outline" size={14} color={colors.secondary} />
                    <Text style={[styles.statValue, { color: colors.secondary }]}>
                      {formatMoney(avgSpend)}
                    </Text>
                    <Text style={styles.statLabel}>Avg Spend</Text>
                  </View>
                </View>
              )}

              {/* Sort toggles */}
              {customers.length > 0 && (
                <View style={styles.sortRow}>
                  {SORT_OPTIONS.map((opt) => {
                    const active = sort === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.sortBtn, active && styles.sortBtnActive]}
                        onPress={() => setSort(opt.key)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={opt.icon as any}
                          size={12}
                          color={active ? '#fff' : colors.textSecondary}
                        />
                        <Text style={[styles.sortBtnText, active && styles.sortBtnTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Result count when searching */}
              {search.trim().length > 0 && (
                <Text style={styles.resultCount}>
                  {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "{search.trim()}"
                </Text>
              )}
            </>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons
                  name={search.trim() ? 'search-outline' : 'people-outline'}
                  size={40}
                  color={colors.textLight}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {search.trim() ? 'No results found' : 'No customers yet'}
              </Text>
              <Text style={styles.emptyText}>
                {search.trim()
                  ? `No customers match "${search.trim()}"`
                  : 'Customers who have completed bookings with your workshop will appear here.'}
              </Text>
            </View>
          }
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  backBtn: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.h2,
    color: colors.text,
  },
  headerCount: {
    ...Typography.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  refreshBtn: {
    padding: 4,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: Spacing.sm,
    height: 42,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    color: colors.text,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
  },

  // List
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 32,
    gap: 0,
  },
  listContentEmpty: {
    flex: 1,
  },

  // Summary stats pills
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
  },
  statPill: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: 12,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  statValue: {
    ...Typography.body,
    fontWeight: '700',
    color: colors.primary,
  },
  statLabel: {
    ...Typography.caption,
    color: colors.textSecondary,
  },

  // Sort row
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sortBtnText: {
    ...Typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sortBtnTextActive: {
    color: '#fff',
  },

  // Result count
  resultCount: {
    ...Typography.caption,
    color: colors.textSecondary,
    marginBottom: Spacing.sm,
  },

  // Customer card
  card: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  customerInfo: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  customerName: {
    ...Typography.body,
    fontWeight: '700',
    color: colors.text,
    flexShrink: 1,
  },
  visitBadge: {
    backgroundColor: colors.primary + '18',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  visitBadgeText: {
    ...Typography.caption,
    fontWeight: '600',
    color: colors.primary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    ...Typography.caption,
    color: colors.textSecondary,
  },
  totalSpent: {
    ...Typography.body,
    fontWeight: '700',
    color: colors.primary,
    flexShrink: 0,
  },

  // Vehicles strip
  vehiclesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  vehicleText: {
    ...Typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },

  // Empty state
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: Spacing.lg,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h3,
    color: colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyText: {
    ...Typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  });
}
