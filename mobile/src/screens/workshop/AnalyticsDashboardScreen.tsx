import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { Colors, Typography, Spacing, BorderRadius } from '../../utils/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MonthlyRevenue {
  month: string;   // "2025-01"
  revenue: number;
  count: number;
}

interface TopService {
  name: string;
  revenue: number;
  count: number;
}

interface CustomerStats {
  total: number;
  repeat: number;
  new: number;
  repeat_rate: number;
}

interface AnalyticsData {
  monthly_revenue: MonthlyRevenue[];
  peak_hours: Record<string, number>;
  top_services: TopService[];
  customer_stats: CustomerStats;
}

type MonthsOption = 3 | 6 | 12;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatMonth = (m: string): string => {
  const [y, mo] = m.split('-');
  return `${MONTHS[parseInt(mo, 10) - 1]} '${y.slice(2)}`;
};

const formatRM = (value: number): string =>
  `RM ${value % 1 === 0 ? value.toFixed(0) : value.toFixed(2)}`;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const SectionCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.card}>{children}</View>
);

const SectionHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <Text style={styles.sectionSubtitle}>{subtitle}</Text>
  </View>
);

const EmptyNote: React.FC<{ text: string }> = ({ text }) => (
  <Text style={styles.emptyNote}>{text}</Text>
);

// ---------------------------------------------------------------------------
// Monthly Revenue Chart
// ---------------------------------------------------------------------------

const RevenueChart: React.FC<{ data: MonthlyRevenue[]; months: MonthsOption }> = ({
  data,
  months,
}) => {
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
  const allZero = totalRevenue === 0;

  return (
    <SectionCard>
      <SectionHeader title="Revenue" subtitle={`Last ${months} months`} />
      <Text style={styles.totalRevenue}>{formatRM(totalRevenue)}</Text>
      {allZero ? (
        <EmptyNote text="No completed bookings yet." />
      ) : (
        <View style={styles.barChartContainer}>
          {data.map((item) => {
            const fillRatio = item.revenue / maxRevenue;
            return (
              <View key={item.month} style={styles.barRow}>
                <Text style={styles.barLabel}>{formatMonth(item.month)}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { flex: fillRatio > 0 ? fillRatio : 0 },
                    ]}
                  />
                  <View style={{ flex: fillRatio < 1 ? 1 - fillRatio : 0 }} />
                </View>
                <Text style={styles.barValue}>
                  {formatRM(item.revenue)} ({item.count})
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </SectionCard>
  );
};

// ---------------------------------------------------------------------------
// Peak Hours Chart
// ---------------------------------------------------------------------------

const DISPLAY_HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7..20

const PeakHoursChart: React.FC<{ peakHours: Record<string, number> }> = ({
  peakHours,
}) => {
  const counts = DISPLAY_HOURS.map((h) => peakHours[String(h)] ?? 0);
  const maxCount = Math.max(...counts, 1);
  const allZero = counts.every((c) => c === 0);

  // Top 3 hours by count
  const sorted = [...counts]
    .map((c, i) => ({ count: c, hour: DISPLAY_HOURS[i] }))
    .sort((a, b) => b.count - a.count);
  const top3Hours = new Set(sorted.slice(0, 3).filter((x) => x.count > 0).map((x) => x.hour));

  const MAX_BAR_HEIGHT = 60;

  const hourLabel = (h: number) => `${h > 12 ? h - 12 : h}${h >= 12 ? 'PM' : 'AM'}`;

  return (
    <SectionCard>
      <SectionHeader title="Peak Hours" subtitle="When customers book" />
      {allZero ? (
        <EmptyNote text="Not enough data yet." />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.peakHoursRow}>
            {DISPLAY_HOURS.map((h, i) => {
              const count = counts[i];
              const barHeight = Math.max((count / maxCount) * MAX_BAR_HEIGHT, count > 0 ? 4 : 0);
              const isTop = top3Hours.has(h);
              return (
                <View key={h} style={styles.peakHourCol}>
                  <View style={[styles.peakBarTrack, { height: MAX_BAR_HEIGHT }]}>
                    <View
                      style={[
                        styles.peakBarFill,
                        {
                          height: barHeight,
                          backgroundColor: isTop ? Colors.primaryDark : Colors.primary,
                          opacity: count === 0 ? 0.15 : 1,
                        },
                      ]}
                    />
                  </View>
                  {count > 0 && (
                    <Text style={[styles.peakCount, isTop && styles.peakCountTop]}>
                      {count}
                    </Text>
                  )}
                  <Text style={styles.peakHourLabel}>{hourLabel(h)}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SectionCard>
  );
};

// ---------------------------------------------------------------------------
// Top Services
// ---------------------------------------------------------------------------

const TopServicesSection: React.FC<{ services: TopService[] }> = ({ services }) => {
  const maxRevenue = services.length > 0 ? services[0].revenue : 1;

  return (
    <SectionCard>
      <SectionHeader title="Top Services" subtitle="by revenue" />
      {services.length === 0 ? (
        <EmptyNote text="No completed services yet." />
      ) : (
        services.map((svc, index) => {
          const fillRatio = maxRevenue > 0 ? svc.revenue / maxRevenue : 0;
          return (
            <View key={svc.name} style={styles.serviceRow}>
              <Text style={styles.serviceRank}>{index + 1}</Text>
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceName} numberOfLines={1}>
                  {svc.name}
                </Text>
                <View style={styles.serviceBarTrack}>
                  <View
                    style={[
                      styles.serviceBarFill,
                      { flex: fillRatio > 0 ? fillRatio : 0 },
                    ]}
                  />
                  <View style={{ flex: fillRatio < 1 ? 1 - fillRatio : 0 }} />
                </View>
              </View>
              <Text style={styles.serviceValue}>
                {formatRM(svc.revenue)} · {svc.count} jobs
              </Text>
            </View>
          );
        })
      )}
    </SectionCard>
  );
};

// ---------------------------------------------------------------------------
// Customer Stats
// ---------------------------------------------------------------------------

const CustomerStatsSection: React.FC<{ stats: CustomerStats }> = ({ stats }) => {
  const repeatPct = Math.round(stats.repeat_rate * 100);
  const newPct = 100 - repeatPct;

  return (
    <SectionCard>
      <SectionHeader title="Customers" subtitle={`${stats.total} total`} />
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: Colors.primary }]}>
          <Text style={styles.statLabel}>Repeat</Text>
          <Text style={[styles.statValue, { color: Colors.primary }]}>
            {stats.repeat}
          </Text>
          <Text style={styles.statPct}>{repeatPct}%</Text>
        </View>
        <View style={[styles.statCard, { borderColor: Colors.success }]}>
          <Text style={styles.statLabel}>New</Text>
          <Text style={[styles.statValue, { color: Colors.success }]}>
            {stats.new}
          </Text>
          <Text style={styles.statPct}>{newPct}%</Text>
        </View>
      </View>
      {stats.total > 0 && (
        <View style={styles.splitBarContainer}>
          <View
            style={[
              styles.splitBarRepeat,
              { flex: repeatPct > 0 ? repeatPct : 0 },
            ]}
          />
          <View
            style={[
              styles.splitBarNew,
              { flex: newPct > 0 ? newPct : 0 },
            ]}
          />
        </View>
      )}
    </SectionCard>
  );
};

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export const AnalyticsDashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [months, setMonths] = useState<MonthsOption>(6);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (selectedMonths: MonthsOption, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await api.get('/workshops/my/analytics', {
        params: { months: selectedMonths },
      });
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Failed to load analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(months);
  }, [months, fetchData]);

  const onRefresh = useCallback(() => {
    fetchData(months, true);
  }, [months, fetchData]);

  const handleMonthsChange = (m: MonthsOption) => {
    if (m !== months) setMonths(m);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top'] as any}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={styles.monthsToggle}>
          {([3, 6, 12] as MonthsOption[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.monthsOption,
                months === m && styles.monthsOptionActive,
              ]}
              onPress={() => handleMonthsChange(m)}
            >
              <Text
                style={[
                  styles.monthsOptionText,
                  months === m && styles.monthsOptionTextActive,
                ]}
              >
                {m}M
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Body */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading analytics…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchData(months)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : data ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
        >
          <RevenueChart data={data.monthly_revenue} months={months} />
          <PeakHoursChart peakHours={data.peak_hours} />
          <TopServicesSection services={data.top_services} />
          <CustomerStatsSection stats={data.customer_stats} />
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    marginRight: Spacing.sm,
    padding: Spacing.xs,
  },
  backArrow: {
    fontSize: 28,
    color: Colors.primary,
    lineHeight: 30,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.text,
    flex: 1,
  },
  monthsToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.divider,
    borderRadius: BorderRadius.full,
    padding: 2,
  },
  monthsOption: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  monthsOptionActive: {
    backgroundColor: Colors.primary,
  },
  monthsOptionText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  monthsOptionTextActive: {
    color: Colors.surface,
  },

  // Body
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  errorText: {
    ...Typography.body,
    color: Colors.danger,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  retryText: {
    ...Typography.button,
    color: Colors.surface,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
    gap: Spacing.sm,
  },
  sectionHeader: {
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  sectionSubtitle: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  emptyNote: {
    ...Typography.body,
    color: Colors.textLight,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },

  // Revenue Chart
  totalRevenue: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  barChartContainer: {
    gap: 10,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  barLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    width: 42,
    textAlign: 'right',
  },
  barTrack: {
    flex: 1,
    height: 18,
    flexDirection: 'row',
    backgroundColor: Colors.divider,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  barFill: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
  },
  barValue: {
    ...Typography.caption,
    color: Colors.textSecondary,
    width: 90,
    textAlign: 'right',
  },

  // Peak Hours Chart
  peakHoursRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingVertical: Spacing.xs,
  },
  peakHourCol: {
    alignItems: 'center',
    width: 36,
    gap: 2,
  },
  peakBarTrack: {
    width: 20,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  peakBarFill: {
    width: 16,
    borderRadius: 3,
  },
  peakCount: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 10,
  },
  peakCountTop: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  peakHourLabel: {
    fontSize: 9,
    color: Colors.textLight,
    textAlign: 'center',
  },

  // Top Services
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  serviceRank: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: Colors.textLight,
    width: 20,
    textAlign: 'center',
  },
  serviceInfo: {
    flex: 1,
    gap: 4,
  },
  serviceName: {
    ...Typography.bodySmall,
    color: Colors.text,
    fontWeight: '500',
  },
  serviceBarTrack: {
    height: 6,
    flexDirection: 'row',
    backgroundColor: Colors.divider,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  serviceBarFill: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  serviceValue: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'right',
    width: 80,
  },

  // Customer Stats
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  statPct: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  splitBarContainer: {
    flexDirection: 'row',
    height: 10,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    backgroundColor: Colors.divider,
  },
  splitBarRepeat: {
    backgroundColor: Colors.primary,
  },
  splitBarNew: {
    backgroundColor: Colors.success,
  },
});
