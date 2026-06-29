import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../store';
import { logout } from '../../store/authSlice';
import { setFlag, FlagRecord } from '../../store/flagsSlice';
import { flagsAPI, adminAPI } from '../../services/api';
import { showConfirm } from '../../utils/webAlert';
import { useTheme } from '../../hooks/useTheme';
import { Typography, Spacing, BorderRadius, AppTheme } from '../../utils/theme';

interface Stats {
  customers: number;
  vendors: number;
  bookings: number;
  active_bookings: number;
  workshops: number;
  queue_today: number;
}

type Tab = 'customer' | 'vendor';

interface Props { navigation: any }

export const AdminDashboardScreen: React.FC<Props> = () => {
  const dispatch = useAppDispatch();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const records = useAppSelector((s) => s.flags.records);

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('customer');
  const [toggling, setToggling] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await adminAPI.stats();
      setStats(res.data);
    } catch {}
    setStatsLoading(false);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleToggle = async (flag: FlagRecord, value: boolean) => {
    if (toggling) return;
    setToggling(flag.key);
    dispatch(setFlag({ key: flag.key, enabled: value }));
    try {
      await flagsAPI.update(flag.key, value);
    } catch {
      // revert on failure
      dispatch(setFlag({ key: flag.key, enabled: !value }));
    }
    setToggling(null);
  };

  const handleLogout = async () => {
    const ok = await showConfirm('Logout', 'Sign out of admin panel?');
    if (ok) dispatch(logout());
  };

  const visibleFlags = records.filter((f) => f.group === activeTab);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.adminBadge, { backgroundColor: '#7C3AED15' }]}>
            <Ionicons name="shield-checkmark" size={14} color="#7C3AED" />
            <Text style={[styles.adminLabel, { color: '#7C3AED' }]}>ADMIN</Text>
          </View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Control Panel</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Stats */}
        {statsLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
        ) : stats ? (
          <View style={styles.statsGrid}>
            <StatCard label="Customers"    value={stats.customers}      icon="person-outline"        color="#3B82F6" colors={colors} />
            <StatCard label="Vendors"      value={stats.vendors}        icon="storefront-outline"    color="#10B981" colors={colors} />
            <StatCard label="Bookings"     value={stats.bookings}       icon="receipt-outline"       color="#F59E0B" colors={colors} />
            <StatCard label="Active"       value={stats.active_bookings} icon="time-outline"         color="#EF4444" colors={colors} />
            <StatCard label="Workshops"    value={stats.workshops}      icon="business-outline"      color="#8B5CF6" colors={colors} />
            <StatCard label="Queue Today"  value={stats.queue_today}    icon="people-circle-outline" color="#0EA5E9" colors={colors} />
          </View>
        ) : null}

        {/* Feature Flags */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Feature Flags</Text>
          <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
            Toggle features on or off for customers and vendors. Changes take effect immediately.
          </Text>

          {/* Tabs */}
          <View style={[styles.tabs, { borderColor: colors.border, backgroundColor: colors.background }]}>
            {(['customer', 'vendor'] as Tab[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && { backgroundColor: colors.primary }]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabLabel, { color: activeTab === tab ? '#fff' : colors.textSecondary }]}>
                  {tab === 'customer' ? 'Customer' : 'Vendor'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Flag rows */}
          {visibleFlags.length === 0 ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
          ) : (
            visibleFlags.map((flag, i) => (
              <View
                key={flag.key}
                style={[
                  styles.flagRow,
                  { borderTopColor: colors.border },
                  i === 0 && { borderTopWidth: 0 },
                ]}
              >
                <View style={styles.flagInfo}>
                  <Text style={[styles.flagLabel, { color: flag.enabled ? colors.text : colors.textSecondary }]}>
                    {flag.label}
                  </Text>
                  <Text style={[styles.flagDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                    {flag.description}
                  </Text>
                </View>
                <View style={styles.flagRight}>
                  {toggling === flag.key ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Switch
                      value={flag.enabled}
                      onValueChange={(v) => handleToggle(flag, v)}
                      trackColor={{ false: colors.border, true: colors.primary + '80' }}
                      thumbColor={flag.enabled ? colors.primary : '#ccc'}
                    />
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Footer note */}
        <Text style={[styles.footerNote, { color: colors.textSecondary }]}>
          Disabled features are hidden from users but not deleted.
          All data is preserved and can be re-enabled at any time.
        </Text>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

function StatCard({
  label, value, icon, color, colors,
}: {
  label: string; value: number; icon: any; color: string; colors: AppTheme;
}) {
  return (
    <View style={[statCardStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[statCardStyles.iconBox, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[statCardStyles.value, { color: colors.text }]}>{value}</Text>
      <Text style={[statCardStyles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const statCardStyles = StyleSheet.create({
  card: {
    flex: 1, minWidth: '30%', borderRadius: 12, borderWidth: 1,
    padding: 12, alignItems: 'center', gap: 6,
  },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  label: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
});

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: 1,
    },
    headerLeft: { gap: 2 },
    adminBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
      borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3,
    },
    adminLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    headerTitle: { ...Typography.h3 },
    logoutBtn: { padding: 6 },

    body: { padding: Spacing.lg, gap: Spacing.md },

    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

    section: {
      borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, gap: 12,
    },
    sectionTitle: { ...Typography.h3 },
    sectionSub: { ...Typography.bodySmall, lineHeight: 18 },

    tabs: {
      flexDirection: 'row', borderRadius: BorderRadius.md, borderWidth: 1, overflow: 'hidden',
    },
    tab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
    tabLabel: { fontSize: 13, fontWeight: '700' },

    flagRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingTop: 14, borderTopWidth: 1, gap: 12,
    },
    flagInfo: { flex: 1, gap: 3 },
    flagLabel: { fontSize: 14, fontWeight: '700' },
    flagDesc: { fontSize: 12, lineHeight: 16 },
    flagRight: { width: 52, alignItems: 'center' },

    footerNote: {
      ...Typography.caption, textAlign: 'center', lineHeight: 18, paddingHorizontal: Spacing.md,
    },
  });
}
