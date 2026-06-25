import React, { useEffect, useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, RefreshControl, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Loading } from '../../components/common/Loading';
import { api } from '../../services/api';
import { showAlert } from '../../utils/webAlert';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';

interface Props { navigation: any }

interface Mechanic {
  _id: string;
  name: string;
  phone?: string;
  specialty?: string;
  is_active: boolean;
  created_at: string;
  bookings_count?: number;
  completed_count?: number;
}

interface FormState {
  name: string;
  phone: string;
  specialty: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  phone: '',
  specialty: '',
  is_active: true,
};

export const MechanicManagementScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Mechanic | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/workshops/my/mechanics');
      setMechanics(res.data || []);
    } catch {
      setMechanics([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEdit = (m: Mechanic) => {
    setEditing(m);
    setForm({
      name: m.name,
      phone: m.phone || '',
      specialty: m.specialty || '',
      is_active: m.is_active,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showAlert('Required', 'Mechanic name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        specialty: form.specialty.trim() || undefined,
        ...(editing ? { is_active: form.is_active } : {}),
      };
      if (editing) {
        const res = await api.patch(`/workshops/my/mechanics/${editing._id}`, payload);
        setMechanics((prev) =>
          prev.map((m) => (m._id === editing._id ? { ...m, ...res.data } : m))
        );
      } else {
        const res = await api.post('/workshops/my/mechanics', payload);
        setMechanics((prev) => [...prev, res.data]);
      }
      setModalVisible(false);
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
          ? detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ')
          : 'Failed to save mechanic';
      showAlert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (m: Mechanic) => {
    const next = !m.is_active;
    try {
      const res = await api.patch(`/workshops/my/mechanics/${m._id}`, { is_active: next });
      setMechanics((prev) =>
        prev.map((x) => (x._id === m._id ? { ...x, ...res.data } : x))
      );
    } catch {
      showAlert('Error', `Failed to ${next ? 'activate' : 'deactivate'} mechanic`);
    }
  };

  const activeCount = mechanics.filter((m) => m.is_active).length;

  const renderMechanic = ({ item }: { item: Mechanic }) => (
    <View style={[styles.card, !item.is_active && styles.cardInactive]}>
      <View style={[styles.iconWrap, !item.is_active && styles.iconWrapInactive]}>
        <Ionicons
          name="construct"
          size={22}
          color={item.is_active ? colors.primary : colors.textLight}
        />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.mechanicName, !item.is_active && styles.textFaded]} numberOfLines={1}>
              {item.name}
            </Text>
            {item.specialty ? (
              <Text style={[styles.specialty, !item.is_active && styles.textFaded]} numberOfLines={1}>
                {item.specialty}
              </Text>
            ) : null}
          </View>
          <View style={styles.cardActions}>
            <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
              <Ionicons name="pencil-outline" size={16} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleToggleActive(item)} style={styles.iconBtn}>
              <Ionicons
                name={item.is_active ? 'pause-circle-outline' : 'play-circle-outline'}
                size={18}
                color={item.is_active ? colors.warning : colors.success}
              />
            </TouchableOpacity>
          </View>
        </View>

        {(item.bookings_count !== undefined || item.completed_count !== undefined) && (
          <Text style={[styles.workload, !item.is_active && styles.textFaded]}>
            {item.bookings_count ?? 0} bookings total
            {' · '}
            {item.completed_count ?? 0} completed
          </Text>
        )}

        <View style={styles.metaRow}>
          {item.phone ? (
            <View style={styles.phonePill}>
              <Ionicons name="call-outline" size={11} color={colors.textSecondary} />
              <Text style={styles.phoneText}>{item.phone}</Text>
            </View>
          ) : null}
          <View style={[styles.activeBadge, !item.is_active && styles.inactiveBadge]}>
            <View style={[styles.activeDot, !item.is_active && styles.inactiveDot]} />
            <Text style={[styles.activeBadgeText, !item.is_active && styles.inactiveBadgeText]}>
              {item.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Mechanics</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{mechanics.length}</Text>
        </View>
      </View>

      {/* Sub-count */}
      {!loading && mechanics.length > 0 && (
        <Text style={styles.subCount}>
          {activeCount} active · {mechanics.length - activeCount} inactive
        </Text>
      )}

      {loading ? (
        <Loading message="Loading mechanics..." />
      ) : (
        <FlatList
          data={mechanics}
          keyExtractor={(i) => i._id}
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.list,
            mechanics.length === 0 && { flex: 1 },
          ]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="construct-outline" size={48} color={colors.textLight} />
              </View>
              <Text style={styles.emptyTitle}>No mechanics yet</Text>
              <Text style={styles.emptySubtitle}>Add your workshop staff to assign them to bookings</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.emptyBtnText}>Add Mechanic</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={renderMechanic}
        />
      )}

      {/* FAB */}
      {!loading && (
        <TouchableOpacity style={styles.fab} onPress={openAdd} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Add / Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editing ? 'Edit Mechanic' : 'Add Mechanic'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Field
                label="Name *"
                value={form.name}
                onChange={(v: string) => setForm({ ...form, name: v })}
                placeholder="e.g. Ahmad Farid"
              />
              <Field
                label="Phone"
                value={form.phone}
                onChange={(v: string) => setForm({ ...form, phone: v })}
                placeholder="e.g. 012-3456789"
                keyboardType="phone-pad"
              />
              <Field
                label="Specialty"
                value={form.specialty}
                onChange={(v: string) => setForm({ ...form, specialty: v })}
                placeholder="e.g. Engine, Brakes, Electrical"
              />

              {editing && (
                <View style={styles.toggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Is Active</Text>
                    <Text style={styles.toggleHint}>
                      Inactive mechanics won't appear for new assignments
                    </Text>
                  </View>
                  <Switch
                    value={form.is_active}
                    onValueChange={(v) => setForm({ ...form, is_active: v })}
                    trackColor={{ false: colors.border, true: colors.primary + '80' }}
                    thumbColor={form.is_active ? colors.primary : colors.textLight}
                  />
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Mechanic'}
                </Text>
              </TouchableOpacity>
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const Field = ({
  label, value, onChange, placeholder, keyboardType, multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: string;
  multiline?: boolean;
}) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.textLight}
      keyboardType={(keyboardType as any) || 'default'}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      style={[styles.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
    />
  </View>
);

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: Spacing.sm,
  },
  backBtn: { padding: 2 },
  title: { ...Typography.h3, color: colors.text, flex: 1 },
  countBadge: {
    backgroundColor: colors.primary,
    borderRadius: BorderRadius.full,
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countBadgeText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  subCount: {
    ...Typography.caption,
    color: colors.textSecondary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: 2,
  },

  // List
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 100, paddingTop: Spacing.md },
  separator: { height: 10 },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardInactive: { opacity: 0.65 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    backgroundColor: colors.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconWrapInactive: { backgroundColor: colors.border },
  cardBody: { flex: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  mechanicName: { ...Typography.body, fontWeight: '700', color: colors.text },
  specialty: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },
  textFaded: { color: colors.textLight },
  cardActions: { flexDirection: 'row', gap: 2, marginLeft: Spacing.sm },
  iconBtn: { padding: 4 },

  // Workload
  workload: {
    ...Typography.caption,
    color: colors.textSecondary,
    marginBottom: 8,
  },

  // Meta row (phone + badge)
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  phonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.background,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  phoneText: { ...Typography.caption, color: colors.textSecondary, fontWeight: '500' },

  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.success + '15',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  inactiveBadge: { backgroundColor: colors.border },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  inactiveDot: { backgroundColor: colors.textLight },
  activeBadgeText: { fontSize: 11, fontWeight: '600', color: colors.success },
  inactiveBadgeText: { color: colors.textLight },

  // Empty state
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { ...Typography.h3, color: colors.text },
  emptySubtitle: {
    ...Typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
    marginTop: 4,
  },
  emptyBtnText: { ...Typography.button, color: '#fff', fontSize: 14 },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: { ...Typography.h3, color: colors.text },
  fieldLabel: {
    ...Typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...Typography.body,
    color: colors.text,
  },

  // Toggle row (Is Active)
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: Spacing.md,
    marginBottom: 14,
    gap: Spacing.md,
  },
  toggleHint: {
    ...Typography.caption,
    color: colors.textLight,
    marginTop: 2,
  },

  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { ...Typography.button, color: '#fff' },
  });
}
