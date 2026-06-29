import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { adminAPI } from '../../services/api';
import { useTheme } from '../../hooks/useTheme';
import { Typography, Spacing, BorderRadius, AppTheme } from '../../utils/theme';
import type { FlagRecord } from '../../store/flagsSlice';

interface RouteUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Props {
  navigation: any;
  route: { params: { user: RouteUser } };
}

const GROUP_FOR_ROLE: Record<string, string> = {
  customer: 'customer',
  workshop: 'vendor',
};

export const UserFlagsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { user } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [flags, setFlags] = useState<FlagRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const targetGroup = GROUP_FOR_ROLE[user.role] ?? null;

  const load = useCallback(async () => {
    try {
      const res = await adminAPI.getUserFlags(user.id);
      setFlags(res.data);
    } catch {}
    setLoading(false);
  }, [user.id]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  useEffect(() => { load(); }, [load]);

  const handleToggle = async (flag: FlagRecord, value: boolean) => {
    if (toggling) return;
    setToggling(flag.key);
    // Optimistic update
    setFlags((prev) =>
      prev.map((f) => f.key === flag.key
        ? { ...f, enabled: value, overridden: true, global_enabled: f.global_enabled ?? f.enabled }
        : f
      )
    );
    try {
      const res = await adminAPI.setUserFlag(user.id, flag.key, value);
      setFlags(res.data);
    } catch {
      await load(); // revert on failure
    }
    setToggling(null);
  };

  const handleReset = async (flag: FlagRecord) => {
    if (toggling) return;
    setToggling(flag.key);
    // Optimistic: revert to global
    setFlags((prev) =>
      prev.map((f) => f.key === flag.key
        ? { ...f, enabled: f.global_enabled ?? f.enabled, overridden: false }
        : f
      )
    );
    try {
      const res = await adminAPI.setUserFlag(user.id, flag.key, null);
      setFlags(res.data);
    } catch {
      await load();
    }
    setToggling(null);
  };

  const visible = targetGroup ? flags.filter((f) => f.group === targetGroup) : flags;
  const overriddenCount = visible.filter((f) => f.overridden).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{user.name}</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>{user.email}</Text>
        </View>
        <View style={[styles.roleBadge, { backgroundColor: user.role === 'customer' ? '#EFF6FF' : '#F0FDF4' }]}>
          <Text style={[styles.roleLabel, { color: user.role === 'customer' ? '#2563EB' : '#16A34A' }]}>
            {user.role === 'workshop' ? 'Vendor' : 'Customer'}
          </Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Info banner */}
          <View style={[styles.banner, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
            <Ionicons name="information-circle-outline" size={16} color="#F97316" />
            <Text style={styles.bannerText}>
              Overrides apply to this user only and take priority over global flags.
              {overriddenCount > 0 ? ` ${overriddenCount} override${overriddenCount !== 1 ? 's' : ''} active.` : ' No active overrides.'}
            </Text>
          </View>

          {/* Flag rows */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {visible.map((flag, i) => (
              <View
                key={flag.key}
                style={[styles.flagRow, { borderTopColor: colors.border }, i === 0 && { borderTopWidth: 0 }]}
              >
                <View style={styles.flagMeta}>
                  <View style={styles.flagTopRow}>
                    <Text style={[styles.flagLabel, { color: colors.text }]}>{flag.label}</Text>
                    {flag.overridden && (
                      <View style={[styles.overriddenBadge, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                        <Text style={styles.overriddenText}>overridden</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.flagDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                    {flag.description}
                  </Text>
                  {flag.overridden && (
                    <Text style={[styles.globalState, { color: colors.textSecondary }]}>
                      Global: {flag.global_enabled ? 'ON' : 'OFF'}
                    </Text>
                  )}
                </View>

                <View style={styles.flagActions}>
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
                  {flag.overridden && toggling !== flag.key && (
                    <TouchableOpacity onPress={() => handleReset(flag)} style={styles.resetBtn}>
                      <Text style={styles.resetText}>Reset</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>

          <Text style={[styles.footerNote, { color: colors.textSecondary }]}>
            "Reset" removes the override and reverts this flag to the global setting.
          </Text>
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      borderBottomWidth: 1, gap: 4,
    },
    headerTitle: { ...Typography.body, fontWeight: '700' },
    headerSub: { ...Typography.caption },
    roleBadge: { borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
    roleLabel: { fontSize: 11, fontWeight: '700' },

    body: { padding: Spacing.lg, gap: Spacing.md },

    banner: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 8,
      borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.sm,
    },
    bannerText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 17 },

    card: {
      borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden',
    },

    flagRow: {
      flexDirection: 'row', alignItems: 'flex-start',
      padding: Spacing.md, borderTopWidth: 1, gap: 12,
    },
    flagMeta: { flex: 1, gap: 4 },
    flagTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    flagLabel: { fontSize: 14, fontWeight: '700' },
    flagDesc: { fontSize: 12, lineHeight: 16 },
    globalState: { fontSize: 11 },

    overriddenBadge: {
      borderRadius: 4, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2,
    },
    overriddenText: { fontSize: 9, fontWeight: '800', color: '#92400E', textTransform: 'uppercase', letterSpacing: 0.5 },

    flagActions: { alignItems: 'center', gap: 6, paddingTop: 2 },
    resetBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: '#FEE2E2' },
    resetText: { fontSize: 11, fontWeight: '700', color: '#EF4444' },

    footerNote: { ...Typography.caption, textAlign: 'center', lineHeight: 18, paddingHorizontal: Spacing.md },
  });
}
