import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { queueAPI } from '../../services/api';
import { Typography, Spacing, BorderRadius, AppTheme } from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { showAlert, showConfirm } from '../../utils/webAlert';
import { getSocket } from '../../services/socket';

interface QueueEntry {
  id: string; workshop_id: string; workshop_name: string;
  customer_name: string; vehicle_plate: string; vehicle_name?: string;
  service_note?: string; queue_number: number; position: number | null;
  status: string; joined_at: string;
}

interface Props { navigation: any; route: any }

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  waiting:  { label: 'Waiting',  color: '#3B82F6', icon: 'time-outline' },
  called:   { label: "It's your turn!", color: '#10B981', icon: 'notifications' },
  serving:  { label: 'Being Served', color: '#8B5CF6', icon: 'checkmark-circle-outline' },
  done:     { label: 'Done', color: '#6B7280', icon: 'checkmark-done-outline' },
  left:     { label: 'Left Queue', color: '#6B7280', icon: 'exit-outline' },
};

function elapsed(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export const QueueStatusScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { entryId, workshopId, workshopName } = route.params as {
    entryId: string; workshopId: string; workshopName: string;
  };

  const [entry, setEntry] = useState<QueueEntry | null>(null);
  const [allEntries, setAllEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [called, setCalled] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const [myRes, queueRes] = await Promise.all([
        queueAPI.myEntries(),
        queueAPI.getEntries(workshopId),
      ]);
      const mine = (myRes.data as QueueEntry[]).find((e) => e.id === entryId);
      if (mine) setEntry(mine);
      setAllEntries(queueRes.data);
    } catch {}
    setLoading(false);
  }, [entryId, workshopId]);

  useEffect(() => {
    load();
    // Poll every 20 s
    pollRef.current = setInterval(load, 20000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  // Socket.IO — listen for queue_updated and queue_called
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('join_queue_room', { workshop_id: workshopId });

    socket.on('queue_updated', (data: { entries: QueueEntry[] }) => {
      setAllEntries(data.entries);
      const mine = data.entries.find((e) => e.id === entryId);
      if (mine) setEntry(mine);
    });

    socket.on('queue_called', (data: { entry_id: string }) => {
      if (data.entry_id === entryId) {
        setCalled(true);
        setEntry((prev) => prev ? { ...prev, status: 'called' } : prev);
      }
    });

    return () => {
      socket.emit('leave_queue_room', { workshop_id: workshopId });
      socket.off('queue_updated');
      socket.off('queue_called');
    };
  }, [workshopId, entryId]);

  const leaveQueue = async () => {
    const ok = await showConfirm('Leave Queue', 'Are you sure you want to leave the queue?');
    if (!ok) return;
    setLeaving(true);
    try {
      await queueAPI.leave(entryId);
      navigation.goBack();
    } catch (e: any) {
      showAlert(e?.response?.data?.detail ?? 'Failed to leave queue.');
    }
    setLeaving(false);
  };

  const waitingAhead = entry?.position != null ? entry.position - 1 : null;
  const estWait = waitingAhead != null ? waitingAhead * 30 : null; // ~30 min per car default
  const meta = STATUS_META[entry?.status ?? 'waiting'];
  const isActive = entry && ['waiting', 'called', 'serving'].includes(entry.status);
  const isCalled = entry?.status === 'called' || called;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Queue Status</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>

          {/* Called banner */}
          {isCalled && (
            <View style={[styles.calledBanner, { backgroundColor: '#10B98115', borderColor: '#10B98140' }]}>
              <Text style={{ fontSize: 36 }}>🔔</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.calledTitle, { color: '#10B981' }]}>It's your turn!</Text>
                <Text style={[styles.calledSub, { color: colors.textSecondary }]}>
                  Head to {workshopName} — they're ready for you now.
                </Text>
              </View>
            </View>
          )}

          {/* Ticket card */}
          <View style={[styles.ticketCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.ticketTop, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.ticketLabel, { color: colors.textSecondary }]}>Queue Ticket</Text>
                <Text style={[styles.ticketNumber, { color: colors.primary }]}>
                  #{String(entry?.queue_number ?? '–').padStart(3, '0')}
                </Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: meta.color + '15', borderColor: meta.color + '40' }]}>
                <Ionicons name={meta.icon as any} size={14} color={meta.color} />
                <Text style={[styles.statusPillTxt, { color: meta.color }]}>{meta.label}</Text>
              </View>
            </View>

            <View style={styles.ticketBody}>
              <View style={styles.infoRow}>
                <Ionicons name="storefront-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.infoTxt, { color: colors.text }]}>{workshopName}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="car-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.infoTxt, { color: colors.text }]}>
                  {entry?.vehicle_plate}{entry?.vehicle_name ? ` · ${entry.vehicle_name}` : ''}
                </Text>
              </View>
              {entry?.service_note && (
                <View style={styles.infoRow}>
                  <Ionicons name="document-text-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.infoTxt, { color: colors.textSecondary }]} numberOfLines={2}>{entry.service_note}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.infoTxt, { color: colors.textSecondary }]}>
                  Joined {elapsed(entry?.joined_at ?? '')}
                </Text>
              </View>
            </View>
          </View>

          {/* Position tracker — only while waiting */}
          {entry?.status === 'waiting' && (
            <View style={[styles.posCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.posRow}>
                <View style={styles.posStat}>
                  <Text style={[styles.posNum, { color: colors.primary }]}>{entry.position ?? '–'}</Text>
                  <Text style={[styles.posLbl, { color: colors.textSecondary }]}>Your position</Text>
                </View>
                <View style={[styles.posDivider, { backgroundColor: colors.border }]} />
                <View style={styles.posStat}>
                  <Text style={[styles.posNum, { color: '#F59E0B' }]}>
                    {waitingAhead !== null && waitingAhead > 0 ? waitingAhead : '0'}
                  </Text>
                  <Text style={[styles.posLbl, { color: colors.textSecondary }]}>Ahead of you</Text>
                </View>
                <View style={[styles.posDivider, { backgroundColor: colors.border }]} />
                <View style={styles.posStat}>
                  <Text style={[styles.posNum, { color: '#10B981' }]}>
                    {estWait != null ? (estWait > 0 ? `~${estWait}m` : 'Soon') : '–'}
                  </Text>
                  <Text style={[styles.posLbl, { color: colors.textSecondary }]}>Est. wait</Text>
                </View>
              </View>

              {/* Queue visual */}
              <View style={[styles.queueViz, { borderTopColor: colors.border }]}>
                {allEntries.filter((e) => e.status === 'waiting').map((e, idx) => {
                  const isMe = e.id === entryId;
                  return (
                    <View key={e.id} style={[
                      styles.queueDot,
                      { backgroundColor: isMe ? colors.primary : colors.border,
                        borderColor: isMe ? colors.primary : 'transparent' }
                    ]}>
                      {isMe && <Ionicons name="person" size={12} color="#fff" />}
                    </View>
                  );
                })}
              </View>
              <Text style={[styles.queueVizLbl, { color: colors.textSecondary }]}>
                {allEntries.filter((e) => e.status === 'waiting').length} in queue
                {allEntries.filter((e) => e.status === 'serving').length > 0
                  ? ` · ${allEntries.filter((e) => e.status === 'serving').length} being served`
                  : ''}
              </Text>
            </View>
          )}

          {/* Serving / Done states */}
          {entry?.status === 'serving' && (
            <View style={[styles.servingCard, { backgroundColor: '#8B5CF615', borderColor: '#8B5CF640' }]}>
              <Ionicons name="construct-outline" size={28} color="#8B5CF6" />
              <Text style={[styles.servingTxt, { color: '#8B5CF6' }]}>Your car is being serviced</Text>
              <Text style={[styles.servingSub, { color: colors.textSecondary }]}>The workshop team is working on it now.</Text>
            </View>
          )}

          {(entry?.status === 'done' || entry?.status === 'left') && (
            <View style={[styles.doneCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.doneTxt, { color: colors.text }]}>
                {entry.status === 'done' ? 'All done!' : 'You left the queue'}
              </Text>
              <TouchableOpacity
                style={[styles.bookNowBtn, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate('HomeTab')}
              >
                <Text style={styles.bookNowBtnTxt}>Browse Workshops</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Leave button */}
          {isActive && entry?.status !== 'serving' && (
            <TouchableOpacity
              style={[styles.leaveBtn, { borderColor: '#EF444440', backgroundColor: '#EF444408' }]}
              onPress={leaveQueue}
              disabled={leaving}
            >
              {leaving ? <ActivityIndicator color="#EF4444" size="small" /> : (
                <>
                  <Ionicons name="exit-outline" size={16} color="#EF4444" />
                  <Text style={styles.leaveTxt}>Leave Queue</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <Text style={[styles.refreshNote, { color: colors.textSecondary }]}>
            Updates automatically every 20 seconds
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
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { ...Typography.h3, color: colors.text },
    body: { padding: Spacing.lg, gap: Spacing.md },

    calledBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      borderRadius: BorderRadius.lg, borderWidth: 1.5, padding: Spacing.lg,
    },
    calledTitle: { fontSize: 18, fontWeight: '800', marginBottom: 2 },
    calledSub: { fontSize: 13, lineHeight: 18 },

    ticketCard: { borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden' },
    ticketTop: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      padding: Spacing.lg, borderBottomWidth: 1,
    },
    ticketLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
    ticketNumber: { fontSize: 40, fontWeight: '900', letterSpacing: -1 },
    statusPill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderRadius: BorderRadius.full, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6,
    },
    statusPillTxt: { fontSize: 12, fontWeight: '700' },
    ticketBody: { padding: Spacing.lg, gap: 10 },
    infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    infoTxt: { fontSize: 14, flex: 1, lineHeight: 20 },

    posCard: { borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden' },
    posRow: { flexDirection: 'row', padding: Spacing.lg },
    posStat: { flex: 1, alignItems: 'center' },
    posNum: { fontSize: 30, fontWeight: '900', letterSpacing: -1 },
    posLbl: { fontSize: 11, marginTop: 2, textAlign: 'center' },
    posDivider: { width: 1, marginHorizontal: 4, alignSelf: 'stretch' },
    queueViz: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 6,
      borderTopWidth: 1, padding: Spacing.md, paddingBottom: 4,
    },
    queueDot: {
      width: 28, height: 28, borderRadius: 14, borderWidth: 2,
      alignItems: 'center', justifyContent: 'center',
    },
    queueVizLbl: { fontSize: 11, textAlign: 'center', paddingBottom: Spacing.md },

    servingCard: {
      borderRadius: BorderRadius.lg, borderWidth: 1,
      alignItems: 'center', padding: Spacing.xl, gap: 8,
    },
    servingTxt: { fontSize: 16, fontWeight: '700' },
    servingSub: { fontSize: 13, textAlign: 'center' },

    doneCard: {
      borderRadius: BorderRadius.lg, borderWidth: 1,
      alignItems: 'center', padding: Spacing.xl, gap: 12,
    },
    doneTxt: { fontSize: 18, fontWeight: '700' },
    bookNowBtn: { borderRadius: BorderRadius.lg, paddingHorizontal: 24, paddingVertical: 12, marginTop: 4 },
    bookNowBtnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },

    leaveBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, borderRadius: BorderRadius.lg, borderWidth: 1, padding: 14,
    },
    leaveTxt: { color: '#EF4444', fontWeight: '700', fontSize: 14 },
    refreshNote: { fontSize: 11, textAlign: 'center' },
  });
}
