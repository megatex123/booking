import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, RefreshControl, TextInput,
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
  customers: number; vendors: number; bookings: number;
  active_bookings: number; workshops: number; queue_today: number;
}

interface AppUser {
  id: string; name: string; email: string; role: string; created_at?: string;
}

type MainTab = 'flags' | 'users';
type FlagTab = 'customer' | 'vendor';

interface Props { navigation: any }

export const AdminDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const records = useAppSelector((s) => s.flags.records);

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [mainTab, setMainTab] = useState<MainTab>('flags');
  const [flagTab, setFlagTab] = useState<FlagTab>('customer');
  const [toggling, setToggling] = useState<string | null>(null);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersFilter, setUsersFilter] = useState<'all' | 'customer' | 'workshop'>('all');

  const loadStats = useCallback(async () => {
    try { const r = await adminAPI.stats(); setStats(r.data); } catch {}
    setStatsLoading(false);
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try { const r = await adminAPI.users(); setUsers(r.data); } catch {}
    setUsersLoading(false);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), mainTab === 'users' ? loadUsers() : Promise.resolve()]);
    setRefreshing(false);
  };

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { if (mainTab === 'users' && users.length === 0) loadUsers(); }, [mainTab]);

  const handleToggleFlag = async (flag: FlagRecord, value: boolean) => {
    if (toggling) return;
    setToggling(flag.key);
    dispatch(setFlag({ key: flag.key, enabled: value }));
    try { await flagsAPI.update(flag.key, value); }
    catch { dispatch(setFlag({ key: flag.key, enabled: !value })); }
    setToggling(null);
  };

  const handleLogout = async () => {
    const ok = await showConfirm('Logout', 'Sign out of admin panel?');
    if (ok) dispatch(logout());
  };

  const visibleFlags = records.filter((f) => f.group === flagTab);

  const filteredUsers = users.filter((u) => {
    const matchRole = usersFilter === 'all' || u.role === usersFilter;
    const q = usersSearch.toLowerCase();
    const matchSearch = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    return matchRole && matchSearch;
  });

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
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
        ) : stats ? (
          <View style={styles.statsGrid}>
            <StatCard label="Customers"   value={stats.customers}       icon="person-outline"        color="#3B82F6" colors={colors} />
            <StatCard label="Vendors"     value={stats.vendors}         icon="storefront-outline"    color="#10B981" colors={colors} />
            <StatCard label="Bookings"    value={stats.bookings}        icon="receipt-outline"       color="#F59E0B" colors={colors} />
            <StatCard label="Active"      value={stats.active_bookings} icon="time-outline"          color="#EF4444" colors={colors} />
            <StatCard label="Workshops"   value={stats.workshops}       icon="business-outline"      color="#8B5CF6" colors={colors} />
            <StatCard label="Queue Today" value={stats.queue_today}     icon="people-circle-outline" color="#0EA5E9" colors={colors} />
          </View>
        ) : null}

        {/* Main tabs */}
        <View style={[styles.mainTabs, { borderColor: colors.border, backgroundColor: colors.background }]}>
          {(['flags', 'users'] as MainTab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.mainTab, mainTab === t && { backgroundColor: colors.primary }]}
              onPress={() => setMainTab(t)}
            >
              <Ionicons
                name={t === 'flags' ? 'toggle-outline' : 'people-outline'}
                size={15}
                color={mainTab === t ? '#fff' : colors.textSecondary}
              />
              <Text style={[styles.mainTabLabel, { color: mainTab === t ? '#fff' : colors.textSecondary }]}>
                {t === 'flags' ? 'Feature Flags' : 'User Overrides'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Feature Flags tab ── */}
        {mainTab === 'flags' && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Feature Flags</Text>
            <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
              Global toggles — apply to all users of that role unless overridden per-user.
            </Text>

            <View style={[styles.subTabs, { borderColor: colors.border, backgroundColor: colors.background }]}>
              {(['customer', 'vendor'] as FlagTab[]).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.subTab, flagTab === t && { backgroundColor: colors.primary }]}
                  onPress={() => setFlagTab(t)}
                >
                  <Text style={[styles.subTabLabel, { color: flagTab === t ? '#fff' : colors.textSecondary }]}>
                    {t === 'customer' ? 'Customer' : 'Vendor'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {visibleFlags.length === 0 ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
            ) : visibleFlags.map((flag, i) => (
              <View
                key={flag.key}
                style={[styles.flagRow, { borderTopColor: colors.border }, i === 0 && { borderTopWidth: 0 }]}
              >
                <View style={styles.flagInfo}>
                  <Text style={[styles.flagLabel, { color: flag.enabled ? colors.text : colors.textSecondary }]}>
                    {flag.label}
                  </Text>
                  <Text style={[styles.flagDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                    {flag.description}
                  </Text>
                </View>
                {toggling === flag.key ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Switch
                    value={flag.enabled}
                    onValueChange={(v) => handleToggleFlag(flag, v)}
                    trackColor={{ false: colors.border, true: colors.primary + '80' }}
                    thumbColor={flag.enabled ? colors.primary : '#ccc'}
                  />
                )}
              </View>
            ))}
          </View>
        )}

        {/* ── User Overrides tab ── */}
        {mainTab === 'users' && (
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>User Overrides</Text>
            <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
              Select a user to set per-user flag overrides that take priority over global flags.
            </Text>

            {/* Search + filter */}
            <View style={[styles.searchRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search by name or email…"
                placeholderTextColor={colors.textSecondary}
                value={usersSearch}
                onChangeText={setUsersSearch}
              />
              {usersSearch.length > 0 && (
                <TouchableOpacity onPress={() => setUsersSearch('')}>
                  <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.filterChips}>
              {(['all', 'customer', 'workshop'] as const).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, { borderColor: colors.border },
                    usersFilter === f && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setUsersFilter(f)}
                >
                  <Text style={[styles.filterChipText,
                    { color: usersFilter === f ? '#fff' : colors.textSecondary }]}>
                    {f === 'workshop' ? 'Vendor' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {usersLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
            ) : filteredUsers.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No users found.</Text>
            ) : filteredUsers.map((u, i) => (
              <TouchableOpacity
                key={u.id}
                style={[styles.userRow, { borderTopColor: colors.border }, i === 0 && { borderTopWidth: 0 }]}
                onPress={() => navigation.navigate('UserFlags', { user: u })}
                activeOpacity={0.75}
              >
                <View style={[styles.userAvatar, { backgroundColor: u.role === 'customer' ? '#EFF6FF' : '#F0FDF4' }]}>
                  <Ionicons
                    name={u.role === 'customer' ? 'person' : 'storefront'}
                    size={18}
                    color={u.role === 'customer' ? '#2563EB' : '#16A34A'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.userName, { color: colors.text }]}>{u.name}</Text>
                  <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{u.email}</Text>
                </View>
                <View style={[styles.roleBadge, { backgroundColor: u.role === 'customer' ? '#EFF6FF' : '#F0FDF4' }]}>
                  <Text style={[styles.roleText, { color: u.role === 'customer' ? '#2563EB' : '#16A34A' }]}>
                    {u.role === 'workshop' ? 'Vendor' : 'Customer'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} style={{ marginLeft: 4 }} />
              </TouchableOpacity>
            ))}
          </View>
        )}

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
    <View style={[scStyles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[scStyles.iconBox, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[scStyles.value, { color: colors.text }]}>{value}</Text>
      <Text style={[scStyles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const scStyles = StyleSheet.create({
  card: { flex: 1, minWidth: '30%', borderRadius: 12, borderWidth: 1, padding: 12, alignItems: 'center', gap: 6 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  label: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
});

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1,
    },
    headerLeft: { gap: 2 },
    adminBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start',
    },
    adminLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    headerTitle: { ...Typography.h3 },
    logoutBtn: { padding: 6 },

    body: { padding: Spacing.lg, gap: Spacing.md },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

    mainTabs: {
      flexDirection: 'row', borderRadius: BorderRadius.md, borderWidth: 1, overflow: 'hidden',
    },
    mainTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
    mainTabLabel: { fontSize: 13, fontWeight: '700' },

    section: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, gap: 12 },
    sectionTitle: { ...Typography.h3 },
    sectionSub: { ...Typography.bodySmall, lineHeight: 18 },

    subTabs: { flexDirection: 'row', borderRadius: BorderRadius.md, borderWidth: 1, overflow: 'hidden' },
    subTab: { flex: 1, paddingVertical: 8, alignItems: 'center' },
    subTabLabel: { fontSize: 13, fontWeight: '700' },

    flagRow: {
      flexDirection: 'row', alignItems: 'center', paddingTop: 14, borderTopWidth: 1, gap: 12,
    },
    flagInfo: { flex: 1, gap: 3 },
    flagLabel: { fontSize: 14, fontWeight: '700' },
    flagDesc: { fontSize: 12, lineHeight: 16 },

    searchRow: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8,
    },
    searchInput: { flex: 1, fontSize: 14, padding: 0 },
    filterChips: { flexDirection: 'row', gap: 8 },
    filterChip: {
      borderRadius: BorderRadius.full, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5,
    },
    filterChipText: { fontSize: 12, fontWeight: '600' },

    userRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingTop: 14, borderTopWidth: 1,
    },
    userAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    userName: { fontSize: 14, fontWeight: '700' },
    userEmail: { fontSize: 12 },
    roleBadge: { borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
    roleText: { fontSize: 11, fontWeight: '700' },

    emptyText: { ...Typography.bodySmall, textAlign: 'center', paddingVertical: 20 },
  });
}
