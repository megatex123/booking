import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { queueAPI } from '../../services/api';
import { Typography, Spacing, BorderRadius, AppTheme } from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { showConfirm } from '../../utils/webAlert';
import { getSocket } from '../../services/socket';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';

interface QueueEntry {
  id: string; customer_name: string; vehicle_plate: string; vehicle_name?: string;
  service_note?: string; queue_number: number; position: number | null;
  status: string; joined_at: string; called_at?: string; served_at?: string;
}

interface Props { navigation: any }

const STATUS_COLORS: Record<string, string> = {
  waiting:  '#3B82F6',
  called:   '#10B981',
  serving:  '#8B5CF6',
  done:     '#6B7280',
  left:     '#6B7280',
};

const STATUS_LABELS: Record<string, string> = {
  waiting: 'Waiting', called: 'Called', serving: 'Serving',
  done: 'Done', left: 'Left',
};

function elapsed(iso?: string): string {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export const QueueManagementScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const user = useSelector((s: RootState) => s.auth.user);

  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await queueAPI.manage();
      setEntries(res.data);
    } catch {}
    setLoading(false);
  }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  // Socket.IO — workshop joins the queue room for its own shop
  useEffect(() => {
    const socket = getSocket();
    if (!socket || !user) return;
    // We need the workshop_id — we'll get it from the entries once loaded
    // or just listen for queue_updated after the first load resolves it
    const handleUpdate = (data: { entries: QueueEntry[] }) => {
      setEntries(data.entries);
    };
    socket.on('queue_updated', handleUpdate);
    return () => { socket.off('queue_updated', handleUpdate); };
  }, [user]);

  // Join queue room once we know the workshop_id from the first entry
  useEffect(() => {
    if (entries.length === 0) return;
    const workshopId = (entries[0] as any).workshop_id;
    if (!workshopId) return;
    const socket = getSocket();
    if (socket) socket.emit('join_queue_room', { workshop_id: workshopId });
  }, [entries.length > 0]);

  const setStatus = async (entry: QueueEntry, status: string) => {
    try {
      const res = await queueAPI.updateStatus(entry.id, status);
      setEntries((prev) => prev.map((e) => e.id === entry.id ? res.data : e));
    } catch {}
  };

  const removeEntry = async (entry: QueueEntry) => {
    const ok = await showConfirm('Remove from Queue', `Remove ${entry.customer_name} from the queue?`);
    if (!ok) return;
    await queueAPI.remove(entry.id);
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
  };

  const waiting  = entries.filter((e) => e.status === 'waiting');
  const active   = entries.filter((e) => ['called', 'serving'].includes(e.status));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Walk-in Queue</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* Summary bar */}
          <View style={[styles.summaryBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.summStat}>
              <Text style={[styles.summNum, { color: '#3B82F6' }]}>{waiting.length}</Text>
              <Text style={[styles.summLbl, { color: colors.textSecondary }]}>Waiting</Text>
            </View>
            <View style={[styles.summDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summStat}>
              <Text style={[styles.summNum, { color: '#8B5CF6' }]}>{active.length}</Text>
              <Text style={[styles.summLbl, { color: colors.textSecondary }]}>Active</Text>
            </View>
            <View style={[styles.summDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summStat}>
              <Text style={[styles.summNum, { color: colors.textSecondary }]}>{entries.length}</Text>
              <Text style={[styles.summLbl, { color: colors.textSecondary }]}>Total Today</Text>
            </View>
          </View>

          {entries.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={52} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Queue is empty</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                Customers can join your queue remotely. Share your workshop link so they can join from the app.
              </Text>
            </View>
          ) : (
            <>
              {/* Currently active (called / serving) */}
              {active.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Now Serving / Called</Text>
                  {active.map((entry) => (
                    <EntryCard
                      key={entry.id} entry={entry} colors={colors} styles={styles}
                      onStatus={setStatus} onRemove={removeEntry}
                    />
                  ))}
                </>
              )}

              {/* Waiting queue */}
              {waiting.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Waiting</Text>
                  {waiting.map((entry) => (
                    <EntryCard
                      key={entry.id} entry={entry} colors={colors} styles={styles}
                      onStatus={setStatus} onRemove={removeEntry}
                    />
                  ))}
                </>
              )}
            </>
          )}

          <Text style={[styles.refreshNote, { color: colors.textSecondary }]}>
            Auto-refreshes every 15 seconds · Realtime via Socket.IO
          </Text>
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

function EntryCard({
  entry, colors, styles, onStatus, onRemove,
}: {
  entry: QueueEntry; colors: AppTheme; styles: any;
  onStatus: (e: QueueEntry, s: string) => void;
  onRemove: (e: QueueEntry) => void;
}) {
  const color = STATUS_COLORS[entry.status] ?? '#6B7280';
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: color }]}>
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={[styles.qNumBadge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
          <Text style={[styles.qNum, { color }]}>#{String(entry.queue_number).padStart(3, '0')}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.custName, { color: colors.text }]}>{entry.customer_name}</Text>
          <Text style={[styles.custPlate, { color: colors.textSecondary }]}>
            {entry.vehicle_plate}{entry.vehicle_name ? ` · ${entry.vehicle_name}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 2 }}>
          <View style={[styles.statusBadge, { backgroundColor: color + '15', borderColor: color + '35' }]}>
            <View style={[styles.statusDot, { backgroundColor: color }]} />
            <Text style={[styles.statusTxt, { color }]}>{STATUS_LABELS[entry.status]}</Text>
          </View>
          <Text style={[styles.waitTime, { color: colors.textSecondary }]}>{elapsed(entry.joined_at)}</Text>
        </View>
      </View>

      {/* Position + service note */}
      <View style={styles.cardMeta}>
        {entry.position != null && (
          <View style={[styles.posBadge, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Ionicons name="list-outline" size={11} color={colors.textSecondary} />
            <Text style={[styles.posLbl, { color: colors.textSecondary }]}>Position {entry.position}</Text>
          </View>
        )}
        {entry.service_note ? (
          <Text style={[styles.noteText, { color: colors.textSecondary }]} numberOfLines={1}>
            📝 {entry.service_note}
          </Text>
        ) : null}
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        {entry.status === 'waiting' && (
          <ActionBtn label="Call" icon="megaphone-outline" color="#10B981"
            onPress={() => onStatus(entry, 'called')} />
        )}
        {entry.status === 'called' && (
          <ActionBtn label="Serving" icon="construct-outline" color="#8B5CF6"
            onPress={() => onStatus(entry, 'serving')} />
        )}
        {entry.status === 'serving' && (
          <ActionBtn label="Done" icon="checkmark-circle-outline" color="#10B981"
            onPress={() => onStatus(entry, 'done')} />
        )}
        {['waiting', 'called'].includes(entry.status) && (
          <ActionBtn label="Skip" icon="arrow-forward-circle-outline" color="#F59E0B"
            onPress={() => onStatus(entry, 'waiting')} />
        )}
        <ActionBtn label="Remove" icon="trash-outline" color="#EF4444"
          onPress={() => onRemove(entry)} />
      </View>
    </View>
  );
}

function ActionBtn({ label, icon, color, onPress }: any) {
  return (
    <TouchableOpacity
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: color + '10', borderColor: color + '30' }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={12} color={color} />
      <Text style={{ fontSize: 11, fontWeight: '700', color }}>{label}</Text>
    </TouchableOpacity>
  );
}

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { ...Typography.h3, color: colors.text },
    body: { padding: Spacing.lg, gap: Spacing.sm },

    summaryBar: {
      flexDirection: 'row', borderRadius: BorderRadius.lg, borderWidth: 1,
      padding: Spacing.md, marginBottom: Spacing.sm,
    },
    summStat: { flex: 1, alignItems: 'center' },
    summNum: { fontSize: 26, fontWeight: '900', letterSpacing: -1 },
    summLbl: { fontSize: 11, marginTop: 2 },
    summDivider: { width: 1, marginHorizontal: 8, alignSelf: 'stretch' },

    sectionTitle: {
      fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5,
      marginTop: Spacing.sm, marginBottom: 4,
    },

    card: {
      borderRadius: BorderRadius.md, borderWidth: 1, borderLeftWidth: 4,
      padding: Spacing.md, gap: 8,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
    qNumBadge: {
      borderRadius: BorderRadius.sm, borderWidth: 1,
      paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start',
    },
    qNum: { fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
    custName: { fontSize: 14, fontWeight: '700' },
    custPlate: { fontSize: 12, marginTop: 1 },
    statusBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      borderRadius: BorderRadius.full, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3,
    },
    statusDot: { width: 5, height: 5, borderRadius: 2.5 },
    statusTxt: { fontSize: 10, fontWeight: '700' },
    waitTime: { fontSize: 10 },

    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    posBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      borderRadius: BorderRadius.full, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3,
    },
    posLbl: { fontSize: 10, fontWeight: '600' },
    noteText: { fontSize: 11, flex: 1 },

    actions: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', paddingTop: 4 },

    empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
    emptyTitle: { ...Typography.h3 },
    emptySub: { ...Typography.bodySmall, textAlign: 'center', maxWidth: 280, lineHeight: 20 },

    refreshNote: { fontSize: 10, textAlign: 'center', marginTop: Spacing.md },
  });
}
