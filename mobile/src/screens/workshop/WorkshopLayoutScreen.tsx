import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, RefreshControl, Platform, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { workshopAPI, bookingAPI, userAPI } from '../../services/api';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchMyBookings } from '../../store/bookingSlice';
import { fetchMyWorkshop } from '../../store/workshopSlice';
import { showAlert } from '../../utils/webAlert';
import { Colors, StatusColors, Typography, Spacing, BorderRadius } from '../../utils/theme';
import { formatTime, formatDate } from '../../utils/helpers';
import { Booking } from '../../types';

interface Props { navigation: any }

interface Station {
  _id: string;
  name: string;
  description: string;
  is_active: boolean;
}

const ACTIVE_STATUSES = ['confirmed', 'in_progress'];

export const WorkshopLayoutScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useAppDispatch();
  const { bookings } = useAppSelector((s) => s.bookings);
  const { myWorkshop } = useAppSelector((s) => s.workshops);
  const isOnline = myWorkshop?.is_open ?? false;

  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});

  // Add station modal
  const [addModal, setAddModal] = useState(false);
  const [stationName, setStationName] = useState('');
  const [stationDesc, setStationDesc] = useState('');
  const [savingStation, setSavingStation] = useState(false);

  // Assign booking modal
  const [assignModal, setAssignModal] = useState(false);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await workshopAPI.getStations();
      setStations(res.data || []);
    } catch { setStations([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    dispatch(fetchMyBookings(undefined));
    dispatch(fetchMyWorkshop());
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), dispatch(fetchMyBookings(undefined))]);
    setRefreshing(false);
  };

  const activeBookings = bookings.filter((b) => ACTIVE_STATUSES.includes(b.status));

  // Poll customer online status every 10s
  useEffect(() => {
    const customerIds = [...new Set(activeBookings.map(b => b.customer_id))];
    if (customerIds.length === 0) return;
    const fetch = async () => {
      try {
        const res = await userAPI.getOnlineStatus(customerIds);
        setOnlineMap(res.data);
      } catch {}
    };
    fetch();
    const timer = setInterval(fetch, 10000);
    return () => clearInterval(timer);
  }, [activeBookings.map(b => b.customer_id).join(',')]);

  const bookingForStation = (stationId: string): Booking | undefined =>
    activeBookings.find((b) => b.station_id === stationId);

  const unassignedBookings = activeBookings.filter((b) => !b.station_id);

  const handleAddStation = async () => {
    if (!stationName.trim()) { showAlert('Required', 'Station name is required'); return; }
    setSavingStation(true);
    try {
      const res = await workshopAPI.addStation({ name: stationName.trim(), description: stationDesc.trim() });
      setStations((prev) => [...prev, res.data]);
      setStationName(''); setStationDesc(''); setAddModal(false);
    } catch (e: any) {
      showAlert('Error', e.response?.data?.detail || 'Failed to add station');
    } finally { setSavingStation(false); }
  };

  const handleDeleteStation = (s: Station) => {
    const booked = bookingForStation(s._id);
    if (booked) { showAlert('Cannot Delete', 'This station has an active booking assigned. Unassign it first.'); return; }
    const doDelete = async () => {
      try {
        await workshopAPI.deleteStation(s._id);
        setStations((prev) => prev.filter((x) => x._id !== s._id));
      } catch { showAlert('Error', 'Failed to delete station'); }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete station "${s.name}"?`)) doDelete();
    } else {
      Alert.alert('Delete Station', `Delete "${s.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleAssign = async (booking: Booking) => {
    if (!selectedStation) return;
    try {
      await bookingAPI.assignStation(booking.id, selectedStation._id);
      dispatch(fetchMyBookings(undefined));
      setAssignModal(false);
    } catch (e: any) {
      showAlert('Error', e.response?.data?.detail || 'Failed to assign');
    }
  };

  const handleUnassign = async (booking: Booking) => {
    const doUnassign = async () => {
      try {
        await bookingAPI.assignStation(booking.id, null);
        dispatch(fetchMyBookings(undefined));
      } catch { showAlert('Error', 'Failed to unassign'); }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Remove "${booking.customer_name}" from this station?`)) doUnassign();
    } else {
      Alert.alert('Unassign', `Remove "${booking.customer_name}" from this station?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unassign', style: 'destructive', onPress: doUnassign },
      ]);
    }
  };

  const openAssign = (s: Station) => { setSelectedStation(s); setAssignModal(true); };

  const occupiedCount = stations.filter((s) => !!bookingForStation(s._id)).length;
  const freeCount = stations.filter((s) => !bookingForStation(s._id)).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Workshop Layout</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAddModal(true)}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Summary bar */}
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <View style={[styles.dot, { backgroundColor: Colors.success }]} />
            <Text style={styles.summaryText}>{freeCount} Free</Text>
          </View>
          <View style={styles.summaryItem}>
            <View style={[styles.dot, { backgroundColor: Colors.warning }]} />
            <Text style={styles.summaryText}>{occupiedCount} Occupied</Text>
          </View>
          <View style={styles.summaryItem}>
            <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.summaryText}>{unassignedBookings.length} unassigned</Text>
          </View>
          <View style={styles.summaryItemRight}>
            <View style={[styles.onlineDot, { backgroundColor: isOnline ? Colors.success : Colors.danger }]} />
            <Text style={[styles.summaryText, { color: isOnline ? Colors.success : Colors.danger }]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </View>

        {/* Unassigned bookings */}
        {unassignedBookings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Waiting for Bay Assignment</Text>
            {unassignedBookings.map((b) => {
              const isOnlineCustomer = !!onlineMap[b.customer_id];
              return (
                <View key={b.id} style={styles.unassignedCard}>
                  <View style={[styles.statusDot, { backgroundColor: StatusColors[b.status] || Colors.textLight }]} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.unassignedNameRow}>
                      <Text style={styles.unassignedName}>{b.customer_name}</Text>
                      <View style={styles.presenceBadge}>
                        <View style={[styles.presenceDot, { backgroundColor: isOnlineCustomer ? Colors.success : Colors.textLight }]} />
                        <Text style={[styles.presenceText, { color: isOnlineCustomer ? Colors.success : Colors.textLight }]}>
                          {isOnlineCustomer ? 'Online' : 'Offline'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.unassignedMeta}>{b.services.map((s: any) => s.name).join(', ')} · {b.vehicle_plate}</Text>
                  </View>
                  <Text style={styles.unassignedTime}>{formatTime(b.scheduled_time)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Station grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Repair Bays ({stations.length})</Text>

          {loading ? (
            <Text style={styles.loadingText}>Loading stations…</Text>
          ) : stations.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="grid-outline" size={48} color={Colors.textLight} />
              <Text style={styles.emptyText}>No repair bays yet</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={() => setAddModal(true)}>
                <Text style={styles.emptyBtnText}>Add First Bay</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.grid}>
              {stations.map((s) => {
                const booking = bookingForStation(s._id);
                const occupied = !!booking;
                const accent = occupied
                  ? (booking.status === 'in_progress' ? Colors.primary : Colors.warning)
                  : Colors.success;

                return (
                  <View key={s._id} style={[styles.stationCard, { borderColor: accent + '60' }]}>
                    {/* Top bar */}
                    <View style={[styles.stationBar, { backgroundColor: accent }]} />

                    <View style={styles.stationContent}>
                      <View style={styles.stationHeaderRow}>
                        <Text style={styles.stationName}>{s.name}</Text>
                        <TouchableOpacity onPress={() => handleDeleteStation(s)}>
                          <Ionicons name="trash-outline" size={14} color={Colors.textLight} />
                        </TouchableOpacity>
                      </View>

                      {/* Status chip */}
                      <View style={[styles.stationStatusChip, { backgroundColor: accent + '18' }]}>
                        <View style={[styles.dot, { backgroundColor: accent }]} />
                        <Text style={[styles.stationStatusText, { color: accent }]}>
                          {occupied ? (booking.status === 'in_progress' ? 'In Service' : 'Confirmed') : 'Free'}
                        </Text>
                      </View>

                      {occupied && booking ? (
                        <View style={styles.bookingInfo}>
                          <Text style={styles.bookingCustomer} numberOfLines={1}>{booking.customer_name}</Text>
                          <Text style={styles.bookingMeta} numberOfLines={1}>
                            {booking.services.map((sv: any) => sv.name).join(', ')}
                          </Text>
                          <View style={styles.bookingMetaRow}>
                            <Ionicons name="car-outline" size={11} color={Colors.textSecondary} />
                            <Text style={styles.bookingMeta}>{booking.vehicle_plate}</Text>
                            <Ionicons name="time-outline" size={11} color={Colors.textSecondary} />
                            <Text style={styles.bookingMeta}>{formatTime(booking.scheduled_time)}</Text>
                          </View>
                          <TouchableOpacity style={styles.unassignBtn} onPress={() => handleUnassign(booking)}>
                            <Text style={styles.unassignBtnText}>Unassign</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.assignBtn, unassignedBookings.length === 0 && styles.assignBtnDisabled]}
                          onPress={() => unassignedBookings.length > 0 ? openAssign(s) : showAlert('No Bookings', 'No active bookings waiting for assignment')}
                        >
                          <Ionicons name="add-circle-outline" size={14} color={unassignedBookings.length > 0 ? Colors.primary : Colors.textLight} />
                          <Text style={[styles.assignBtnText, unassignedBookings.length === 0 && { color: Colors.textLight }]}>
                            Assign Booking
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Add Station Modal */}
      <Modal visible={addModal} animationType="slide" transparent onRequestClose={() => setAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Repair Bay</Text>
              <TouchableOpacity onPress={() => setAddModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Bay Name *</Text>
            <TextInput
              value={stationName} onChangeText={setStationName}
              placeholder="e.g. Bay 1, Lift A, Alignment Station"
              placeholderTextColor={Colors.textLight}
              style={styles.input}
            />
            <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Description (optional)</Text>
            <TextInput
              value={stationDesc} onChangeText={setStationDesc}
              placeholder="What work is this bay for?"
              placeholderTextColor={Colors.textLight}
              style={styles.input}
            />
            <TouchableOpacity style={[styles.saveBtn, savingStation && { opacity: 0.6 }]} onPress={handleAddStation} disabled={savingStation}>
              <Text style={styles.saveBtnText}>{savingStation ? 'Adding…' : 'Add Bay'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Assign Booking Modal */}
      <Modal visible={assignModal} animationType="slide" transparent onRequestClose={() => setAssignModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign to {selectedStation?.name}</Text>
              <TouchableOpacity onPress={() => setAssignModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.assignPickLabel}>Choose a booking to assign:</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 400 }}>
              {unassignedBookings.map((b) => (
                <TouchableOpacity key={b.id} style={styles.pickCard} onPress={() => handleAssign(b)}>
                  <View style={[styles.dot, { backgroundColor: StatusColors[b.status] || Colors.textLight, marginTop: 2 }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickName}>{b.customer_name}</Text>
                    <Text style={styles.pickMeta}>{b.services.map((s: any) => s.name).join(', ')}</Text>
                    <Text style={styles.pickMeta}>{b.vehicle_brand} {b.vehicle_name} · {b.vehicle_plate}</Text>
                    <Text style={styles.pickMeta}>{formatDate(b.scheduled_date)} {formatTime(b.scheduled_time)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textLight} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  title: { ...Typography.h3, color: Colors.text },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },

  summaryBar: { flexDirection: 'row', gap: 20, paddingHorizontal: Spacing.lg, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border, alignItems: 'center' },
  summaryItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryItemRight: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 'auto' },
  summaryText: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },

  section: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  sectionTitle: { ...Typography.h3, color: Colors.text, marginBottom: 12 },
  loadingText: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 20 },

  unassignedCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.surface, borderRadius: BorderRadius.sm, padding: 12, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: Colors.warning },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  unassignedNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  unassignedName: { ...Typography.bodySmall, fontWeight: '600', color: Colors.text },
  presenceBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  presenceDot: { width: 6, height: 6, borderRadius: 3 },
  presenceText: { fontSize: 10, fontWeight: '600' },
  unassignedMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  unassignedTime: { ...Typography.caption, fontWeight: '600', color: Colors.textSecondary },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 8 },
  stationCard: { width: '47%', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, overflow: 'hidden', borderWidth: 1.5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  stationBar: { height: 5 },
  stationContent: { padding: 12, gap: 8 },
  stationHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stationName: { ...Typography.body, fontWeight: '700', color: Colors.text },
  stationStatusChip: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  stationStatusText: { fontSize: 11, fontWeight: '600' },

  bookingInfo: { gap: 3 },
  bookingCustomer: { ...Typography.bodySmall, fontWeight: '600', color: Colors.text },
  bookingMeta: { fontSize: 11, color: Colors.textSecondary },
  bookingMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  unassignBtn: { marginTop: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: BorderRadius.full, backgroundColor: Colors.danger + '15', alignSelf: 'flex-start' },
  unassignBtnText: { fontSize: 11, fontWeight: '600', color: Colors.danger },

  assignBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: BorderRadius.full, backgroundColor: Colors.primary + '12', alignSelf: 'flex-start' },
  assignBtnDisabled: { backgroundColor: Colors.border },
  assignBtnText: { fontSize: 11, fontWeight: '600', color: Colors.primary },

  empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { ...Typography.body, color: Colors.textSecondary },
  emptyBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: BorderRadius.full },
  emptyBtnText: { ...Typography.button, color: '#fff' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { ...Typography.h3, color: Colors.text },
  fieldLabel: { ...Typography.caption, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: Colors.surface, borderRadius: BorderRadius.sm, borderWidth: 1.5, borderColor: Colors.border, paddingHorizontal: 12, paddingVertical: 10, ...Typography.body, color: Colors.text },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { ...Typography.button, color: '#fff' },
  assignPickLabel: { ...Typography.bodySmall, color: Colors.textSecondary, marginBottom: 12 },
  pickCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, backgroundColor: Colors.surface, borderRadius: BorderRadius.sm, marginBottom: 8 },
  pickName: { ...Typography.body, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  pickMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 1 },
});
