import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image, Modal, TextInput,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { bookingAPI, uploadAPI, serviceLogAPI } from '../../services/api';
import { Typography, Spacing, BorderRadius, AppTheme } from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { formatPrice } from '../../utils/helpers';
import { showAlert, showConfirm } from '../../utils/webAlert';

/* ─── Types ─────────────────────────────────────────────────────────── */

interface ProductUsed {
  product_id: string; product_name: string; brand?: string;
  unit: string; quantity: number; unit_price: number;
}
interface ServiceReport {
  service_id: string; service_name: string; work_done: string;
  next_service_months?: number | null; media?: string[]; products_used?: ProductUsed[];
}
interface Booking {
  id: string; workshop_name: string; workshop_address: string;
  services: any[]; vehicle_plate: string; vehicle_name: string;
  vehicle_brand: string; scheduled_date: string; total_price: number;
  status: string; completion_notes?: string; next_service_months?: number | null;
  service_reports?: ServiceReport[]; updated_at: string;
}
interface ManualLog {
  id: string; vehicle_plate: string; service_date: string;
  location: string; services: string[]; notes?: string;
  mileage?: number; cost?: number; next_service_months?: number;
  source: 'manual';
}
type TimelineEntry =
  | { kind: 'booking'; date: Date; data: Booking }
  | { kind: 'manual'; date: Date; data: ManualLog };

interface Props { navigation: any; route: any }

/* ─── Helpers ───────────────────────────────────────────────────────── */

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
function formatMonths(months: number): string {
  if (months >= 12) { const y = months / 12; return `${y} year${y > 1 ? 's' : ''}`; }
  return `${months} month${months > 1 ? 's' : ''}`;
}
function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}
function urgencyColor(dueDate: Date, colors: AppTheme): string {
  const daysLeft = Math.floor((dueDate.getTime() - Date.now()) / 86400000);
  if (daysLeft < 0) return colors.danger;
  if (daysLeft < 30) return '#F59E0B';
  return colors.success;
}
function todayIso(): string { return new Date().toISOString().split('T')[0]; }

const SERVICE_SUGGESTIONS = [
  'Oil Change', 'Oil Filter', 'Air Filter', 'Cabin Filter', 'Tyre Rotation',
  'Brake Pads', 'Brake Fluid', 'Coolant Top-up', 'Battery Check', 'Spark Plugs',
  'Transmission Fluid', 'Wheel Alignment', 'AC Service', 'Timing Belt', 'Wiper Blades',
];

/* ─── Screen ─────────────────────────────────────────────────────────── */

export const VehicleServiceHistoryScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { vehicle } = route.params as {
    vehicle: { plate: string; model: string; year?: string; color?: string }
  };

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [manualLogs, setManualLogs] = useState<ManualLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Log modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState<ManualLog | null>(null);
  const [logDate, setLogDate] = useState('');
  const [logLocation, setLogLocation] = useState('');
  const [logServices, setLogServices] = useState('');
  const [logNotes, setLogNotes] = useState('');
  const [logMileage, setLogMileage] = useState('');
  const [logCost, setLogCost] = useState('');
  const [logMonths, setLogMonths] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [bookRes, logRes] = await Promise.all([
        bookingAPI.getMyBookings('completed'),
        serviceLogAPI.list(vehicle.plate),
      ]);
      const all: Booking[] = bookRes.data;
      const forVehicle = all
        .filter((b) => b.vehicle_plate.toUpperCase() === vehicle.plate.toUpperCase())
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      setBookings(forVehicle);
      setManualLogs(logRes.data || []);
    } catch {}
    setLoading(false);
  }, [vehicle.plate]);

  useEffect(() => { load(); }, []);

  // Merged & sorted timeline
  const timeline: TimelineEntry[] = useMemo(() => {
    const entries: TimelineEntry[] = [
      ...bookings.map((b) => ({
        kind: 'booking' as const,
        date: new Date(b.updated_at),
        data: b,
      })),
      ...manualLogs.map((lg) => ({
        kind: 'manual' as const,
        date: new Date(lg.service_date),
        data: lg,
      })),
    ];
    return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [bookings, manualLogs]);

  // Next service due (from most recent entry)
  const nextServiceInfo = useMemo(() => {
    if (timeline.length === 0) return null;
    const latest = timeline[0];
    let months: number | null = null;
    let completedAt: Date | null = null;
    let workshopName = '';

    if (latest.kind === 'booking') {
      const b = latest.data;
      const candidates: number[] = [];
      b.service_reports?.forEach((r) => { if (r.next_service_months) candidates.push(r.next_service_months); });
      if (b.next_service_months) candidates.push(b.next_service_months);
      if (candidates.length === 0) return null;
      months = Math.min(...candidates);
      completedAt = new Date(b.updated_at);
      workshopName = b.workshop_name;
    } else {
      const lg = latest.data;
      if (!lg.next_service_months) return null;
      months = lg.next_service_months;
      completedAt = new Date(lg.service_date);
      workshopName = lg.location;
    }

    if (!months || !completedAt) return null;
    const dueDate = addMonths(completedAt, months);
    return { dueDate, soonestMonths: months, workshopName };
  }, [timeline]);

  /* ─── Modal ─── */
  const openCreate = () => {
    setEditingLog(null);
    setLogDate(todayIso()); setLogLocation(''); setLogServices('');
    setLogNotes(''); setLogMileage(''); setLogCost(''); setLogMonths('');
    setModalVisible(true);
  };
  const openEdit = (lg: ManualLog) => {
    setEditingLog(lg);
    setLogDate(lg.service_date);
    setLogLocation(lg.location);
    setLogServices(lg.services.join(', '));
    setLogNotes(lg.notes ?? '');
    setLogMileage(lg.mileage ? String(lg.mileage) : '');
    setLogCost(lg.cost ? String(lg.cost) : '');
    setLogMonths(lg.next_service_months ? String(lg.next_service_months) : '');
    setModalVisible(true);
  };
  const closeModal = () => { setModalVisible(false); setEditingLog(null); };

  const saveLog = async () => {
    if (!logDate || !logLocation.trim()) {
      showAlert('Date and location are required.');
      return;
    }
    const servicesList = logServices.split(',').map((s) => s.trim()).filter(Boolean);
    if (servicesList.length === 0) {
      showAlert('Enter at least one service performed.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        vehicle_plate: vehicle.plate,
        service_date: logDate,
        location: logLocation.trim(),
        services: servicesList,
        notes: logNotes.trim() || undefined,
        mileage: logMileage ? parseInt(logMileage, 10) : undefined,
        cost: logCost ? parseFloat(logCost) : undefined,
        next_service_months: logMonths ? parseInt(logMonths, 10) : undefined,
      };
      if (editingLog) {
        const res = await serviceLogAPI.update(editingLog.id, payload);
        setManualLogs((prev) => prev.map((l) => l.id === editingLog.id ? res.data : l));
      } else {
        const res = await serviceLogAPI.create(payload);
        setManualLogs((prev) => [res.data, ...prev]);
      }
      closeModal();
    } catch {
      showAlert('Failed to save. Please try again.');
    }
    setSaving(false);
  };

  const deleteLog = async (id: string) => {
    const confirmed = await showConfirm('Delete Entry', 'Remove this service record?');
    if (!confirmed) return;
    try {
      await serviceLogAPI.remove(id);
      setManualLogs((prev) => prev.filter((l) => l.id !== id));
    } catch {
      showAlert('Failed to delete.');
    }
  };

  /* ─── Render ─── */
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Service History</Text>
        <TouchableOpacity onPress={openCreate} style={styles.addBtn}>
          <Ionicons name="add-circle-outline" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Vehicle summary */}
        <View style={[styles.vehicleCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.vehicleIcon, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="car" size={30} color={colors.primary} />
          </View>
          <View style={styles.vehicleInfo}>
            <Text style={[styles.vehiclePlate, { color: colors.text }]}>{vehicle.plate}</Text>
            <Text style={[styles.vehicleMeta, { color: colors.textSecondary }]}>
              {vehicle.model}{vehicle.year ? ` • ${vehicle.year}` : ''}{vehicle.color ? ` • ${vehicle.color}` : ''}
            </Text>
            <Text style={[styles.serviceCount, { color: colors.primary }]}>
              {timeline.length} service record{timeline.length !== 1 ? 's' : ''}
              {manualLogs.length > 0 ? ` (${manualLogs.length} manual)` : ''}
            </Text>
          </View>
        </View>

        {/* Next service due card */}
        {nextServiceInfo && (
          <View style={[styles.nextServiceCard, { backgroundColor: colors.surface, borderColor: urgencyColor(nextServiceInfo.dueDate, colors) + '60' }]}>
            <View style={styles.nextServiceHeader}>
              <Ionicons name="alarm-outline" size={18} color={urgencyColor(nextServiceInfo.dueDate, colors)} />
              <Text style={[styles.nextServiceTitle, { color: urgencyColor(nextServiceInfo.dueDate, colors) }]}>Next Service Due</Text>
            </View>
            <Text style={[styles.nextServiceDate, { color: colors.text }]}>{formatShortDate(nextServiceInfo.dueDate.toISOString())}</Text>
            <Text style={[styles.nextServiceSub, { color: colors.textSecondary }]}>
              In {formatMonths(nextServiceInfo.soonestMonths)} from last service at {nextServiceInfo.workshopName}
            </Text>
            {nextServiceInfo.dueDate < new Date() && (
              <View style={[styles.overdueChip, { backgroundColor: colors.danger + '12', borderColor: colors.danger + '30' }]}>
                <Ionicons name="warning-outline" size={13} color={colors.danger} />
                <Text style={[styles.overdueText, { color: colors.danger }]}>Overdue — book a service now</Text>
              </View>
            )}
          </View>
        )}

        {/* Log Service banner (empty state) */}
        {!loading && timeline.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="clipboard-outline" size={56} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No service history</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Tap + to log a service — whether you did it yourself or went to any workshop.
            </Text>
            <TouchableOpacity
              style={[styles.logBannerBtn, { backgroundColor: colors.primary }]}
              onPress={openCreate}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.logBannerBtnText}>Log First Service</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />}

        {/* Timeline */}
        {!loading && timeline.length > 0 && (
          <View style={styles.timeline}>
            <Text style={[styles.timelineHeader, { color: colors.textSecondary }]}>Service History</Text>
            {timeline.map((entry, idx) => (
              <View key={entry.kind === 'booking' ? entry.data.id : entry.data.id} style={styles.timelineItem}>
                <View style={styles.timelineLeft}>
                  <View style={[
                    styles.dot,
                    idx === 0 && styles.dotFirst,
                    entry.kind === 'manual' && { backgroundColor: '#F59E0B', borderColor: '#F59E0B' },
                  ]} />
                  {idx < timeline.length - 1 && <View style={[styles.line, { backgroundColor: colors.border }]} />}
                </View>

                <View style={styles.timelineContent}>
                  <View style={styles.dateRow}>
                    <Text style={[styles.serviceDate, { color: colors.textSecondary }]}>
                      {entry.kind === 'booking'
                        ? formatShortDate(entry.data.updated_at)
                        : formatShortDate(entry.data.service_date)}
                    </Text>
                    {entry.kind === 'manual' && (
                      <View style={[styles.manualBadge, { backgroundColor: '#F59E0B18', borderColor: '#F59E0B40' }]}>
                        <Ionicons name="construct" size={10} color="#F59E0B" />
                        <Text style={[styles.manualBadgeText, { color: '#F59E0B' }]}>Self-logged</Text>
                      </View>
                    )}
                  </View>

                  {entry.kind === 'booking' ? (
                    <BookingCard b={entry.data} colors={colors} styles={styles} />
                  ) : (
                    <ManualLogCard
                      lg={entry.data} colors={colors} styles={styles}
                      onEdit={() => openEdit(entry.data)}
                      onDelete={() => deleteLog(entry.data.id)}
                    />
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Log Service Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView style={[styles.modalSheet, { backgroundColor: colors.surface }]}
              keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingLog ? 'Edit Service Record' : 'Log a Service'}
              </Text>
              <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
                Record a service done outside the app — DIY, local mechanic, or any workshop.
              </Text>

              <Field label="Service Date *" colors={colors}>
                {Platform.OS === 'web' ? (
                  // @ts-ignore
                  <input type="date" value={logDate} max={todayIso()}
                    onChange={(e: any) => setLogDate(e.target.value)}
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: `1px solid ${colors.border}`, backgroundColor: colors.background, color: colors.text, fontSize: 15, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' } as any}
                  />
                ) : (
                  <TInput value={logDate} onChangeText={setLogDate} placeholder="YYYY-MM-DD" colors={colors} styles={styles} keyboardType="numeric" />
                )}
              </Field>

              <Field label="Workshop / Location *" colors={colors}>
                <TInput value={logLocation} onChangeText={setLogLocation}
                  placeholder="e.g. Hafiz Workshop, DIY, Home Garage"
                  colors={colors} styles={styles} />
              </Field>

              <Field label="Services Performed * (comma-separated)" colors={colors}>
                <TInput value={logServices} onChangeText={setLogServices}
                  placeholder="e.g. Oil Change, Air Filter"
                  colors={colors} styles={styles} multiline />
              </Field>

              {/* Quick-pick suggestions */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 0 }}>
                  {SERVICE_SUGGESTIONS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.suggestionChip, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}
                      onPress={() => {
                        const parts = logServices.split(',').map((x) => x.trim()).filter(Boolean);
                        if (!parts.includes(s)) setLogServices([...parts, s].join(', '));
                      }}
                    >
                      <Text style={[styles.suggestionText, { color: colors.primary }]}>{s}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Field label="Notes / What was done" colors={colors}>
                <TInput value={logNotes} onChangeText={setLogNotes}
                  placeholder="e.g. Used Castrol 5W-30, replaced K&N filter"
                  colors={colors} styles={styles} multiline />
              </Field>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Mileage (km)" colors={colors}>
                    <TInput value={logMileage} onChangeText={setLogMileage}
                      placeholder="e.g. 45000"
                      colors={colors} styles={styles} keyboardType="numeric" />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Cost (RM)" colors={colors}>
                    <TInput value={logCost} onChangeText={setLogCost}
                      placeholder="e.g. 120"
                      colors={colors} styles={styles} keyboardType="numeric" />
                  </Field>
                </View>
              </View>

              <Field label="Next Service In (months)" colors={colors}>
                <TInput value={logMonths} onChangeText={setLogMonths}
                  placeholder="e.g. 3 — affects Car Health Score"
                  colors={colors} styles={styles} keyboardType="numeric" />
              </Field>

              <View style={[styles.modalActions, { marginBottom: 24 }]}>
                {editingLog && (
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: '#EF444415', borderWidth: 1, borderColor: '#EF444430', flex: 1 }]}
                    onPress={() => { closeModal(); deleteLog(editingLog.id); }}
                    disabled={saving}
                  >
                    <Ionicons name="trash-outline" size={15} color="#EF4444" />
                    <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>Delete</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.border, flex: 1 }]} onPress={closeModal} disabled={saving}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary, flex: 2 }]} onPress={saveLog} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <Ionicons name="checkmark" size={15} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                        {editingLog ? 'Update' : 'Save Record'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

/* ─── Sub-components ─────────────────────────────────────────────────── */

function Field({ label, children, colors }: { label: string; children: React.ReactNode; colors: AppTheme }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', color: colors.textSecondary, marginBottom: 6 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function TInput({ value, onChangeText, placeholder, colors, styles, multiline, keyboardType }: any) {
  return (
    <TextInput
      style={[styles.textInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
      value={value} onChangeText={onChangeText} placeholder={placeholder}
      placeholderTextColor={colors.textSecondary} multiline={multiline}
      keyboardType={keyboardType}
      numberOfLines={multiline ? 2 : 1}
    />
  );
}

function BookingCard({ b, colors, styles }: { b: Booking; colors: AppTheme; styles: any }) {
  return (
    <View style={[styles.serviceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.workshopRow}>
        <Ionicons name="storefront-outline" size={14} color={colors.primary} />
        <Text style={[styles.workshopName, { color: colors.text }]}>{b.workshop_name}</Text>
      </View>
      <View style={styles.servicesList}>
        {b.services.map((svc: any) => (
          <View key={svc._id} style={[styles.serviceChip, { backgroundColor: colors.primary + '10' }]}>
            <Ionicons name="construct-outline" size={11} color={colors.primary} />
            <Text style={[styles.serviceChipText, { color: colors.primary }]}>{svc.name}</Text>
          </View>
        ))}
      </View>
      {b.service_reports && b.service_reports.length > 0 && (
        <View style={[styles.reportsSection, { borderTopColor: colors.border }]}>
          {b.service_reports.map((sr, si) =>
            sr.work_done ? (
              <View key={sr.service_id || si} style={[styles.svcReport, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.svcReportName, { color: colors.text }]}>{sr.service_name}</Text>
                <Text style={[styles.svcReportWork, { color: colors.textSecondary }]}>{sr.work_done}</Text>
                {sr.media && sr.media.length > 0 && (
                  <View style={styles.mediaRow}>
                    {sr.media.map((url: string) =>
                      url.match(/\.(mp4|mov|webm|avi)$/i) ? (
                        <View key={url} style={styles.videoThumb}><Ionicons name="videocam" size={16} color="#fff" /></View>
                      ) : (
                        <Image key={url} source={{ uri: uploadAPI.mediaUrl(url) }} style={styles.mediaThumbnail} resizeMode="cover" />
                      )
                    )}
                  </View>
                )}
                {sr.products_used && sr.products_used.length > 0 && (
                  <View style={[styles.productsSection, { borderTopColor: colors.border + '80' }]}>
                    <Text style={[styles.productsLabel, { color: colors.textSecondary }]}>Products Used</Text>
                    {sr.products_used.map((p, pi) => (
                      <View key={p.product_id || pi} style={styles.productRow}>
                        <View style={[styles.productDot, { backgroundColor: colors.textSecondary }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.productName, { color: colors.text }]}>{p.product_name}</Text>
                          {p.brand ? <Text style={[styles.productBrand, { color: colors.textSecondary }]}>{p.brand}</Text> : null}
                        </View>
                        <Text style={[styles.productQty, { color: colors.textSecondary }]}>{p.quantity} {p.unit}</Text>
                        <Text style={[styles.productPrice, { color: colors.primary }]}>{formatPrice(p.unit_price * p.quantity)}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {sr.next_service_months ? (
                  <View style={[styles.nextChip, { backgroundColor: colors.primary + '12' }]}>
                    <Ionicons name="calendar-outline" size={11} color={colors.primary} />
                    <Text style={[styles.nextChipText, { color: colors.primary }]}>Next in {formatMonths(sr.next_service_months)}</Text>
                  </View>
                ) : null}
              </View>
            ) : null
          )}
        </View>
      )}
      {b.completion_notes ? (
        <View style={[styles.generalReport, { borderTopColor: colors.border }]}>
          <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>General Report</Text>
          <Text style={[styles.reportText, { color: colors.textSecondary }]}>{b.completion_notes}</Text>
        </View>
      ) : null}
      <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
        <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>Total paid</Text>
        <Text style={[styles.totalAmount, { color: colors.primary }]}>{formatPrice(b.total_price)}</Text>
      </View>
    </View>
  );
}

function ManualLogCard({ lg, colors, styles, onEdit, onDelete }: { lg: ManualLog; colors: AppTheme; styles: any; onEdit: () => void; onDelete: () => void }) {
  return (
    <View style={[styles.serviceCard, { backgroundColor: colors.surface, borderColor: '#F59E0B30', borderLeftWidth: 3, borderLeftColor: '#F59E0B' }]}>
      <View style={styles.workshopRow}>
        <Ionicons name="construct-outline" size={14} color="#F59E0B" />
        <Text style={[styles.workshopName, { color: colors.text }]}>{lg.location}</Text>
        <TouchableOpacity onPress={onEdit} style={{ marginLeft: 'auto' as any, padding: 2 }}>
          <Ionicons name="pencil-outline" size={14} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.servicesList}>
        {lg.services.map((s, i) => (
          <View key={i} style={[styles.serviceChip, { backgroundColor: '#F59E0B10' }]}>
            <Ionicons name="checkmark-circle-outline" size={11} color="#F59E0B" />
            <Text style={[styles.serviceChipText, { color: '#B45309' }]}>{s}</Text>
          </View>
        ))}
      </View>

      {lg.notes ? (
        <View style={[styles.generalReport, { borderTopColor: colors.border }]}>
          <Text style={[styles.reportLabel, { color: colors.textSecondary }]}>Notes</Text>
          <Text style={[styles.reportText, { color: colors.textSecondary }]}>{lg.notes}</Text>
        </View>
      ) : null}

      <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          {lg.mileage ? (
            <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>📍 {lg.mileage.toLocaleString()} km</Text>
          ) : null}
          {lg.next_service_months ? (
            <View style={[styles.nextChip, { backgroundColor: colors.primary + '12' }]}>
              <Ionicons name="calendar-outline" size={11} color={colors.primary} />
              <Text style={[styles.nextChipText, { color: colors.primary }]}>Next in {formatMonths(lg.next_service_months)}</Text>
            </View>
          ) : null}
        </View>
        {lg.cost ? (
          <Text style={[styles.totalAmount, { color: '#F59E0B' }]}>RM {lg.cost.toFixed(2)}</Text>
        ) : null}
      </View>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────── */

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { ...Typography.h3, color: colors.text },
    addBtn: { padding: 4 },
    body: { padding: Spacing.lg },

    vehicleCard: {
      flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.md,
      padding: Spacing.md, marginBottom: 14, borderWidth: 1,
    },
    vehicleIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md },
    vehicleInfo: { flex: 1 },
    vehiclePlate: { ...Typography.h2 },
    vehicleMeta: { ...Typography.bodySmall, marginTop: 2 },
    serviceCount: { ...Typography.caption, fontWeight: '600', marginTop: 4 },

    nextServiceCard: { borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: 14, borderWidth: 1.5 },
    nextServiceHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    nextServiceTitle: { ...Typography.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    nextServiceDate: { ...Typography.h2, marginBottom: 2 },
    nextServiceSub: { ...Typography.caption, lineHeight: 16 },
    overdueChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8, alignSelf: 'flex-start', borderWidth: 1 },
    overdueText: { ...Typography.caption, fontWeight: '600' },

    empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
    emptyTitle: { ...Typography.h3 },
    emptyText: { ...Typography.bodySmall, textAlign: 'center', maxWidth: 260, lineHeight: 20 },
    logBannerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: BorderRadius.md, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
    logBannerBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    timeline: { gap: 0 },
    timelineHeader: { ...Typography.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
    timelineItem: { flexDirection: 'row', gap: 12 },
    timelineLeft: { alignItems: 'center', width: 16 },
    dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.border, borderWidth: 2, borderColor: colors.border, marginTop: 4 },
    dotFirst: { backgroundColor: colors.primary, borderColor: colors.primary },
    line: { width: 2, flex: 1, marginTop: 4, minHeight: 24 },

    timelineContent: { flex: 1, paddingBottom: 20 },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    serviceDate: { ...Typography.caption, fontWeight: '600' },
    manualBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: BorderRadius.full, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1 },
    manualBadgeText: { fontSize: 10, fontWeight: '700' },

    serviceCard: { borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, gap: 10 },
    workshopRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    workshopName: { ...Typography.bodySmall, fontWeight: '600', flex: 1 },
    servicesList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    serviceChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: BorderRadius.full, paddingHorizontal: 9, paddingVertical: 4 },
    serviceChipText: { ...Typography.caption, fontWeight: '500' },

    reportsSection: { borderTopWidth: 1, paddingTop: 10, gap: 8 },
    svcReport: { borderRadius: BorderRadius.sm, padding: 10, borderWidth: 1, gap: 4 },
    svcReportName: { ...Typography.caption, fontWeight: '700' },
    svcReportWork: { ...Typography.caption, lineHeight: 16 },
    mediaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
    mediaThumbnail: { width: 56, height: 56, borderRadius: 6 },
    videoThumb: { width: 56, height: 56, borderRadius: 6, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
    productsSection: { borderTopWidth: 1, paddingTop: 6, gap: 5, marginTop: 2 },
    productsLabel: { ...Typography.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 9, marginBottom: 2 },
    productRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    productDot: { width: 4, height: 4, borderRadius: 2, marginTop: 1 },
    productName: { ...Typography.caption, fontWeight: '500', flex: 1 },
    productBrand: { fontSize: 10 },
    productQty: { ...Typography.caption, fontSize: 10 },
    productPrice: { ...Typography.caption, fontWeight: '600', fontSize: 10, minWidth: 50, textAlign: 'right' },
    nextChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginTop: 2 },
    nextChipText: { ...Typography.caption, fontWeight: '600', fontSize: 10 },

    generalReport: { borderTopWidth: 1, paddingTop: 8 },
    reportLabel: { ...Typography.caption, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
    reportText: { ...Typography.caption, lineHeight: 16 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, paddingTop: 8 },
    totalLabel: { ...Typography.caption },
    totalAmount: { ...Typography.bodySmall, fontWeight: '700' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.xl, maxHeight: '92%' as any },
    modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.lg },
    modalTitle: { ...Typography.h3, marginBottom: 4 },
    modalSub: { ...Typography.caption, lineHeight: 18, marginBottom: Spacing.xl },
    textInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: Spacing.sm },
    modalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: BorderRadius.lg },
    suggestionChip: { borderRadius: BorderRadius.full, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
    suggestionText: { fontSize: 12, fontWeight: '600' },
  });
}
