import React, { useEffect, useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { corporateAPI } from '../../services/api';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { showAlert, showConfirm } from '../../utils/webAlert';

interface Props { navigation: any }

interface Vehicle { _id: string; plate: string; make: string; model: string; year?: string }
interface Driver { id: string; name: string; email: string; phone: string }
interface Corporate {
  id: string; company_name: string; registration_no: string;
  contact_email: string; contact_phone: string; monthly_limit: number;
  is_admin: boolean; vehicles: Vehicle[]; drivers: Driver[];
}

const EMPTY_VEHICLE = { plate: '', make: '', model: '', year: '' };

export const CorporateManagementScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [corp, setCorp] = useState<Corporate | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'vehicles' | 'drivers' | 'billing'>('vehicles');

  // Vehicle modal
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editVehicleId, setEditVehicleId] = useState<string | null>(null);
  const [vehicleForm, setVehicleForm] = useState(EMPTY_VEHICLE);
  const [savingVehicle, setSavingVehicle] = useState(false);

  // Driver modal
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [driverEmail, setDriverEmail] = useState('');
  const [savingDriver, setSavingDriver] = useState(false);

  // Billing
  const [billing, setBilling] = useState<any>(null);
  const [billingMonth, setBillingMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loadingBilling, setLoadingBilling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await corporateAPI.getMy();
      setCorp(r.data);
    } catch {
      // no corporate account — redirect to registration
      navigation.replace('CorporateRegistration');
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  useEffect(() => { load(); }, [load]);

  const loadBilling = useCallback(async () => {
    setLoadingBilling(true);
    try {
      const r = await corporateAPI.getBilling(billingMonth);
      setBilling(r.data);
    } catch {
      showAlert('Error', 'Could not load billing data.');
    } finally {
      setLoadingBilling(false);
    }
  }, [billingMonth]);

  useEffect(() => { if (tab === 'billing') loadBilling(); }, [tab, loadBilling]);

  // ── Vehicle CRUD ─────────────────────────────────────────────────────────
  const openAddVehicle = () => { setEditVehicleId(null); setVehicleForm(EMPTY_VEHICLE); setShowVehicleModal(true); };
  const openEditVehicle = (v: Vehicle) => { setEditVehicleId(v._id); setVehicleForm({ plate: v.plate, make: v.make, model: v.model, year: v.year || '' }); setShowVehicleModal(true); };

  const saveVehicle = async () => {
    if (!vehicleForm.plate.trim() || !vehicleForm.make.trim() || !vehicleForm.model.trim()) {
      showAlert('Missing Fields', 'Plate, make, and model are required.');
      return;
    }
    setSavingVehicle(true);
    try {
      if (editVehicleId) {
        await corporateAPI.updateVehicle(editVehicleId, vehicleForm);
      } else {
        await corporateAPI.addVehicle(vehicleForm);
      }
      setShowVehicleModal(false);
      load();
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Could not save vehicle.');
    } finally {
      setSavingVehicle(false);
    }
  };

  const deleteVehicle = (id: string) => {
    showConfirm('Remove Vehicle', 'Remove this vehicle from the fleet?', async () => {
      try { await corporateAPI.deleteVehicle(id); load(); } catch { showAlert('Error', 'Could not remove vehicle.'); }
    });
  };

  // ── Driver CRUD ──────────────────────────────────────────────────────────
  const inviteDriver = async () => {
    if (!driverEmail.trim()) return;
    setSavingDriver(true);
    try {
      await corporateAPI.inviteDriver(driverEmail.trim());
      setShowDriverModal(false);
      setDriverEmail('');
      load();
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Could not add driver.');
    } finally {
      setSavingDriver(false);
    }
  };

  const removeDriver = (driverId: string, name: string) => {
    showConfirm('Remove Driver', `Remove ${name} from the fleet?`, async () => {
      try { await corporateAPI.removeDriver(driverId); load(); } catch { showAlert('Error', 'Could not remove driver.'); }
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!corp) return null;

  const prevMonth = () => {
    const [y, m] = billingMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setBillingMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const [y, m] = billingMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setBillingMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Corporate Account</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Company Info */}
      <View style={styles.companyCard}>
        <View style={styles.companyIcon}>
          <Ionicons name="business" size={24} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.companyName}>{corp.company_name}</Text>
          <Text style={styles.companyReg}>Reg: {corp.registration_no}</Text>
          {corp.monthly_limit > 0 && (
            <Text style={styles.companyLimit}>Monthly limit: RM{corp.monthly_limit.toFixed(0)}</Text>
          )}
        </View>
        <View style={[styles.roleBadge, { backgroundColor: corp.is_admin ? colors.primary : colors.textLight }]}>
          <Text style={styles.roleText}>{corp.is_admin ? 'Admin' : 'Driver'}</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['vehicles', 'drivers', 'billing'] as const).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

        {/* Vehicles Tab */}
        {tab === 'vehicles' && (
          <View style={styles.tabContent}>
            {corp.is_admin && (
              <TouchableOpacity style={styles.addBtn} onPress={openAddVehicle}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.addBtnText}>Add Fleet Vehicle</Text>
              </TouchableOpacity>
            )}
            {corp.vehicles.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="car-outline" size={48} color={colors.textLight} />
                <Text style={styles.emptyText}>No vehicles added yet</Text>
              </View>
            ) : (
              corp.vehicles.map((v) => (
                <View key={v._id} style={styles.card}>
                  <View style={styles.cardIcon}>
                    <Ionicons name="car" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{v.plate}</Text>
                    <Text style={styles.cardSub}>{v.make} {v.model}{v.year ? ` · ${v.year}` : ''}</Text>
                  </View>
                  {corp.is_admin && (
                    <View style={styles.cardActions}>
                      <TouchableOpacity onPress={() => openEditVehicle(v)} style={styles.cardActionBtn}>
                        <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteVehicle(v._id)} style={styles.cardActionBtn}>
                        <Ionicons name="trash-outline" size={18} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* Drivers Tab */}
        {tab === 'drivers' && (
          <View style={styles.tabContent}>
            {corp.is_admin && (
              <TouchableOpacity style={styles.addBtn} onPress={() => setShowDriverModal(true)}>
                <Ionicons name="person-add" size={20} color="#fff" />
                <Text style={styles.addBtnText}>Add Driver by Email</Text>
              </TouchableOpacity>
            )}
            {corp.drivers.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={48} color={colors.textLight} />
                <Text style={styles.emptyText}>No drivers added yet</Text>
              </View>
            ) : (
              corp.drivers.map((d) => (
                <View key={d.id} style={styles.card}>
                  <View style={[styles.cardIcon, { backgroundColor: '#0EA5E9' + '20' }]}>
                    <Ionicons name="person" size={20} color="#0EA5E9" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{d.name}</Text>
                    <Text style={styles.cardSub}>{d.email}{d.phone ? ` · ${d.phone}` : ''}</Text>
                  </View>
                  {corp.is_admin && (
                    <TouchableOpacity onPress={() => removeDriver(d.id, d.name)} style={styles.cardActionBtn}>
                      <Ionicons name="close-circle-outline" size={22} color={colors.danger} />
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* Billing Tab */}
        {tab === 'billing' && (
          <View style={styles.tabContent}>
            <View style={styles.monthNav}>
              <TouchableOpacity onPress={prevMonth} style={styles.monthBtn}>
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{billingMonth}</Text>
              <TouchableOpacity onPress={nextMonth} style={styles.monthBtn}>
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {loadingBilling ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
            ) : billing ? (
              <>
                <View style={styles.billingStats}>
                  {[
                    { label: 'Bookings', value: billing.total_bookings },
                    { label: 'Total (RM)', value: `${billing.total_amount?.toFixed(2)}` },
                    { label: 'Unpaid (RM)', value: `${billing.pending_amount?.toFixed(2)}` },
                  ].map((s, i) => (
                    <View key={i} style={[styles.billingStatCell, i < 2 && styles.billingStatBorder]}>
                      <Text style={styles.billingStatValue}>{s.value}</Text>
                      <Text style={styles.billingStatLabel}>{s.label}</Text>
                    </View>
                  ))}
                </View>
                {billing.bookings.length === 0 ? (
                  <View style={styles.empty}>
                    <Text style={styles.emptyText}>No bookings this month</Text>
                  </View>
                ) : (
                  billing.bookings.map((b: any) => (
                    <View key={b.id} style={styles.billingRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{b.workshop_name}</Text>
                        <Text style={styles.cardSub}>{b.vehicle_plate} · {b.scheduled_date}</Text>
                        <Text style={styles.cardSub}>{b.services?.join(', ')}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.billingAmount}>RM{b.total_price?.toFixed(2)}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: b.payment_status === 'paid' ? colors.success + '20' : colors.warning + '20' }]}>
                          <Text style={[styles.statusText, { color: b.payment_status === 'paid' ? colors.success : colors.warning }]}>{b.payment_status}</Text>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </>
            ) : null}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Vehicle Modal */}
      <Modal visible={showVehicleModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editVehicleId ? 'Edit Vehicle' : 'Add Vehicle'}</Text>
              <TouchableOpacity onPress={() => setShowVehicleModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            {(['plate', 'make', 'model', 'year'] as const).map((f) => (
              <TextInput
                key={f}
                style={styles.modalInput}
                value={vehicleForm[f]}
                onChangeText={(v) => setVehicleForm((prev) => ({ ...prev, [f]: v }))}
                placeholder={f === 'plate' ? 'Plate (e.g. WXY1234)' : f === 'make' ? 'Make (e.g. Perodua)' : f === 'model' ? 'Model (e.g. Myvi)' : 'Year (optional)'}
                placeholderTextColor={colors.textLight}
                autoCapitalize={f === 'year' ? 'none' : 'characters'}
              />
            ))}
            <TouchableOpacity style={styles.modalSaveBtn} onPress={saveVehicle} disabled={savingVehicle}>
              {savingVehicle ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSaveBtnText}>Save Vehicle</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Driver Invite Modal */}
      <Modal visible={showDriverModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Driver</Text>
              <TouchableOpacity onPress={() => setShowDriverModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>Enter the email address of an existing Bengkil Lah customer account.</Text>
            <TextInput
              style={styles.modalInput}
              value={driverEmail}
              onChangeText={setDriverEmail}
              placeholder="driver@email.com"
              placeholderTextColor={colors.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.modalSaveBtn} onPress={inviteDriver} disabled={savingDriver}>
              {savingDriver ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalSaveBtnText}>Add Driver</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.h3, color: colors.text },
  companyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.surface, padding: Spacing.lg,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  companyIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  companyName: { ...Typography.h3, color: colors.text },
  companyReg: { ...Typography.caption, color: colors.textSecondary },
  companyLimit: { ...Typography.caption, color: colors.warning, marginTop: 2 },
  roleBadge: { borderRadius: BorderRadius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  roleText: { ...Typography.caption, color: '#fff', fontWeight: '700' },
  tabs: { flexDirection: 'row', backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { ...Typography.bodySmall, color: colors.textSecondary },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  tabContent: { padding: Spacing.lg },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 12, marginBottom: Spacing.md,
  },
  addBtnText: { ...Typography.button, color: '#fff' },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  cardIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center',
  },
  cardTitle: { ...Typography.body, color: colors.text, fontWeight: '600' },
  cardSub: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 4 },
  cardActionBtn: { padding: 6 },
  empty: { alignItems: 'center', paddingVertical: Spacing.xl },
  emptyText: { ...Typography.body, color: colors.textSecondary, marginTop: 12 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: Spacing.md },
  monthBtn: { padding: 8 },
  monthLabel: { ...Typography.h3, color: colors.text },
  billingStats: {
    flexDirection: 'row', backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  billingStatCell: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md },
  billingStatBorder: { borderRightWidth: 1, borderRightColor: colors.border },
  billingStatValue: { ...Typography.h3, color: colors.primary },
  billingStatLabel: { ...Typography.caption, color: colors.textSecondary },
  billingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: 10, gap: 12,
  },
  billingAmount: { ...Typography.body, fontWeight: '700', color: colors.text },
  statusBadge: { borderRadius: BorderRadius.sm, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4 },
  statusText: { ...Typography.caption, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.lg, paddingBottom: 40,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { ...Typography.h3, color: colors.text },
  modalHint: { ...Typography.bodySmall, color: colors.textSecondary, marginBottom: 12 },
  modalInput: {
    backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: BorderRadius.sm, paddingHorizontal: 12, paddingVertical: 11,
    ...Typography.body, color: colors.text, marginBottom: 12,
  },
  modalSaveBtn: {
    backgroundColor: colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  modalSaveBtnText: { ...Typography.button, color: '#fff' },
  });
}
