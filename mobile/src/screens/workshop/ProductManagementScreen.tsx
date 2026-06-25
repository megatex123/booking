import React, { useEffect, useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Modal, ScrollView, RefreshControl, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Loading } from '../../components/common/Loading';
import { workshopAPI } from '../../services/api';
import { showAlert } from '../../utils/webAlert';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { formatPrice } from '../../utils/helpers';

interface Props { navigation: any }

interface Product {
  _id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  quantity: number;
  unit: string;
  description: string;
  service_tags?: string[];
  reorder_threshold?: number;
}

const CATEGORIES = [
  { key: 'all',        label: 'All',         icon: 'apps-outline' },
  { key: 'lubricant',  label: 'Lubricant',   icon: 'water-outline' },
  { key: 'filter',     label: 'Filter',      icon: 'funnel-outline' },
  { key: 'brake',      label: 'Brake',       icon: 'stop-circle-outline' },
  { key: 'tyre',       label: 'Tyre',        icon: 'ellipse-outline' },
  { key: 'electrical', label: 'Electrical',  icon: 'flash-outline' },
  { key: 'body',       label: 'Body',        icon: 'car-outline' },
  { key: 'other',      label: 'Other',       icon: 'cube-outline' },
];

const UNITS = ['pcs', 'litre', 'kg', 'set', 'bottle', 'box'];

const CAT_COLORS: Record<string, string> = {
  lubricant: '#1565C0', filter: '#6A1B9A', brake: '#B71C1C',
  tyre: '#E65100', electrical: '#F9A825', body: '#2E7D32', other: colors.textSecondary,
};

const EMPTY_FORM = { name: '', brand: '', category: 'lubricant', price: '', quantity: '', unit: 'pcs', description: '', service_tags: [] as string[], reorder_threshold: '' };

export const ProductManagementScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [products, setProducts] = useState<Product[]>([]);
  const [workshopServices, setWorkshopServices] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    try {
      const [productsRes, workshopRes] = await Promise.all([
        workshopAPI.getProducts(),
        workshopAPI.getMyWorkshop(),
      ]);
      setProducts(productsRes.data || []);
      setWorkshopServices((workshopRes.data?.services || []).filter((s: any) => s.is_active !== false));
    } catch { setProducts([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setModalVisible(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, brand: p.brand, category: p.category, price: String(p.price), quantity: String(p.quantity), unit: p.unit, description: p.description, service_tags: p.service_tags || [], reorder_threshold: p.reorder_threshold ? String(p.reorder_threshold) : '' });
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { showAlert('Required', 'Product name is required'); return; }
    if (!form.price || isNaN(Number(form.price))) { showAlert('Required', 'Valid price is required'); return; }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), brand: form.brand.trim(), category: form.category, price: Number(form.price), quantity: Number(form.quantity) || 0, unit: form.unit, description: form.description.trim(), service_tags: form.service_tags, reorder_threshold: form.reorder_threshold ? Number(form.reorder_threshold) : 0 };
      if (editing) {
        const res = await workshopAPI.updateProduct(editing._id, payload);
        setProducts((prev) => prev.map((p) => p._id === editing._id ? { ...p, ...res.data } : p));
      } else {
        const res = await workshopAPI.addProduct(payload);
        setProducts((prev) => [...prev, res.data]);
      }
      setModalVisible(false);
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ') : 'Failed to save product';
      showAlert('Error', msg);
    } finally { setSaving(false); }
  };

  const handleDelete = (p: Product) => {
    const doDelete = async () => {
      try {
        await workshopAPI.deleteProduct(p._id);
        setProducts((prev) => prev.filter((x) => x._id !== p._id));
      } catch { showAlert('Error', 'Failed to delete product'); }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete "${p.name}"?`)) doDelete();
    } else {
      Alert.alert('Delete Product', `Delete "${p.name}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const filtered = filter === 'all' ? products : products.filter((p) => p.category === filter);

  const renderProduct = ({ item }: { item: Product }) => {
    const color = CAT_COLORS[item.category] || colors.textSecondary;
    const threshold = item.reorder_threshold ?? 0;
    const lowStock = threshold > 0 ? item.quantity <= threshold : item.quantity <= 5;
    return (
      <View style={styles.card}>
        <View style={[styles.catBar, { backgroundColor: color }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
              {item.brand ? <Text style={styles.brand}>{item.brand}</Text> : null}
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
                <Ionicons name="pencil-outline" size={16} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={[styles.catChip, { backgroundColor: color + '18' }]}>
              <Text style={[styles.catChipText, { color }]}>{item.category}</Text>
            </View>
            <View style={[styles.stockBadge, lowStock && styles.stockBadgeLow]}>
              <Ionicons name="cube-outline" size={11} color={lowStock ? colors.danger : colors.success} />
              <Text style={[styles.stockText, lowStock && styles.stockTextLow]}>
                {item.quantity} {item.unit}
              </Text>
            </View>
          </View>

          {item.service_tags && item.service_tags.length > 0 && (
            <View style={styles.serviceTagsRow}>
              <Ionicons name="construct-outline" size={10} color={colors.textLight} />
              <Text style={styles.serviceTagsText} numberOfLines={1}>
                {item.service_tags.join(' • ')}
              </Text>
            </View>
          )}

          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(item.price)}</Text>
            {item.description ? <Text style={styles.desc} numberOfLines={1}>{item.description}</Text> : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Product Inventory</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterList}>
        {CATEGORIES.map((c) => {
          const count = c.key === 'all' ? products.length : products.filter((p) => p.category === c.key).length;
          const active = filter === c.key;
          return (
            <TouchableOpacity key={c.key} style={[styles.chip, active && styles.chipActive]} onPress={() => setFilter(c.key)}>
              <Ionicons name={c.icon as any} size={13} color={active ? '#fff' : colors.textSecondary} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
              {count > 0 && (
                <View style={[styles.badge, active && styles.badgeActive]}>
                  <Text style={[styles.badgeText, active && styles.badgeTextActive]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.resultCount}>{filtered.length} product{filtered.length !== 1 ? 's' : ''}</Text>

      {loading ? <Loading message="Loading products..." /> : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => i._id}
          style={{ flex: 1 }}
          contentContainerStyle={[styles.list, filtered.length === 0 && { flex: 1 }]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>No products yet{filter !== 'all' ? ' in this category' : ''}</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openAdd}>
                <Text style={styles.emptyBtnText}>Add Product</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={renderProduct}
        />
      )}

      {/* Add / Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? 'Edit Product' : 'Add Product'}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Field label="Product Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Engine Oil 5W-30" />
              <Field label="Brand" value={form.brand} onChange={(v) => setForm({ ...form, brand: v })} placeholder="e.g. Castrol, Shell" />

              <Text style={styles.fieldLabel}>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 2 }}>
                  {CATEGORIES.filter((c) => c.key !== 'all').map((c) => (
                    <TouchableOpacity key={c.key} style={[styles.optChip, form.category === c.key && styles.optChipActive]} onPress={() => setForm({ ...form, category: c.key })}>
                      <Text style={[styles.optChipText, form.category === c.key && styles.optChipTextActive]}>{c.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Field label="Price (RM) *" value={form.price} onChange={(v) => setForm({ ...form, price: v })} placeholder="0.00" keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Quantity" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} placeholder="0" keyboardType="number-pad" />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Unit</Text>
              <View style={styles.unitRow}>
                {UNITS.map((u) => (
                  <TouchableOpacity key={u} style={[styles.optChip, form.unit === u && styles.optChipActive]} onPress={() => setForm({ ...form, unit: u })}>
                    <Text style={[styles.optChipText, form.unit === u && styles.optChipTextActive]}>{u}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {workshopServices.length > 0 && (
                <>
                  <Text style={styles.fieldLabel}>Applies to Services (optional)</Text>
                  <View style={styles.serviceTagsWrap}>
                    {workshopServices.map((svc) => {
                      const tagged = form.service_tags.includes(svc.name);
                      return (
                        <TouchableOpacity
                          key={svc._id}
                          style={[styles.svcTagChip, tagged && styles.svcTagChipActive]}
                          onPress={() => setForm((f) => ({
                            ...f,
                            service_tags: tagged
                              ? f.service_tags.filter((t) => t !== svc.name)
                              : [...f.service_tags, svc.name],
                          }))}
                        >
                          {tagged && <Ionicons name="checkmark" size={11} color="#fff" />}
                          <Text style={[styles.svcTagChipText, tagged && styles.svcTagChipTextActive]} numberOfLines={1}>
                            {svc.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={{ height: 6 }} />
                </>
              )}

              <Field label="Description (optional)" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Additional notes..." multiline />

              <Field label="Reorder Alert Threshold (0 = off)" value={form.reorder_threshold} onChange={(v) => setForm({ ...form, reorder_threshold: v })} placeholder="e.g. 5" keyboardType="number-pad" />

              <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Product'}</Text>
              </TouchableOpacity>
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const Field = ({ label, value, onChange, placeholder, keyboardType, multiline }: any) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      value={value} onChangeText={onChange} placeholder={placeholder}
      placeholderTextColor={colors.textLight}
      keyboardType={keyboardType || 'default'} multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      style={[styles.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
    />
  </View>
);

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { ...Typography.h3, color: colors.text },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },

  filterScroll: { maxHeight: 48, flexGrow: 0, flexShrink: 0, marginBottom: 4 },
  filterList: { paddingHorizontal: Spacing.lg, gap: 8, alignItems: 'center', paddingVertical: 4, flexDirection: 'row', flexWrap: 'nowrap' },
  chip: { flexDirection: 'row', alignItems: 'center', flexShrink: 0, gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: BorderRadius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...Typography.caption, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  badge: { backgroundColor: colors.border, borderRadius: 8, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
  badgeTextActive: { color: '#fff' },

  resultCount: { ...Typography.caption, color: colors.textSecondary, paddingHorizontal: Spacing.lg, marginVertical: 6, flexShrink: 0 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 32, paddingTop: 4 },
  separator: { height: 10 },

  card: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: BorderRadius.md, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  catBar: { width: 4 },
  cardBody: { flex: 1, padding: Spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  productName: { ...Typography.body, fontWeight: '700', color: colors.text },
  brand: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 4 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  catChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  catChipText: { fontSize: 11, fontWeight: '600' },
  stockBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.success + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  stockBadgeLow: { backgroundColor: colors.danger + '15' },
  stockText: { fontSize: 11, fontWeight: '600', color: colors.success },
  stockTextLow: { color: colors.danger },

  serviceTagsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  serviceTagsText: { ...Typography.caption, color: colors.textLight, fontSize: 10, flex: 1 },

  serviceTagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  svcTagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  svcTagChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  svcTagChipText: { ...Typography.caption, fontWeight: '600', color: colors.textSecondary, fontSize: 11 },
  svcTagChipTextActive: { color: '#fff' },

  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { ...Typography.body, fontWeight: '700', color: colors.primary },
  desc: { ...Typography.caption, color: colors.textSecondary, flex: 1, marginLeft: 8, textAlign: 'right' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { ...Typography.body, color: colors.textSecondary },
  emptyBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: BorderRadius.full },
  emptyBtnText: { ...Typography.button, color: '#fff' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { ...Typography.h3, color: colors.text },
  fieldLabel: { ...Typography.caption, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  input: { backgroundColor: colors.surface, borderRadius: BorderRadius.sm, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10, ...Typography.body, color: colors.text },
  row2: { flexDirection: 'row', gap: 10 },
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  optChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: BorderRadius.full, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  optChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optChipText: { ...Typography.caption, fontWeight: '600', color: colors.textSecondary },
  optChipTextActive: { color: '#fff' },
  saveBtn: { backgroundColor: colors.primary, borderRadius: BorderRadius.md, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  saveBtnText: { ...Typography.button, color: '#fff' },
  });
}
