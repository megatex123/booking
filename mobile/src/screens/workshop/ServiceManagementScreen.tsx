import React, { useEffect, useState, useMemo} from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal,
  ScrollView, TextInput,
} from 'react-native';
import { showAlert, showConfirm } from '../../utils/webAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Loading } from '../../components/common/Loading';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchMyWorkshop } from '../../store/workshopSlice';
import { workshopAPI } from '../../services/api';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { formatPrice, getCategoryLabel } from '../../utils/helpers';
import { WorkshopService } from '../../types';

const CATEGORIES = ['oil_change', 'tire', 'brake', 'engine', 'body', 'electrical', 'other'];

interface DefaultProductEntry {
  product_id: string;
  product_name: string;
  brand: string;
  unit: string;
  quantity: string; // string for input
}

interface Props {
  navigation: any;
}

export const ServiceManagementScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const { myWorkshop } = useAppSelector((s) => s.workshops);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<WorkshopService | null>(null);
  const [loading, setLoading] = useState(false);
  const [inventoryProducts, setInventoryProducts] = useState<any[]>([]);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productFilter, setProductFilter] = useState('all');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('60');
  const [category, setCategory] = useState('oil_change');
  const [defaultProducts, setDefaultProducts] = useState<DefaultProductEntry[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    dispatch(fetchMyWorkshop());
    workshopAPI.getProducts().then((r) => setInventoryProducts(r.data)).catch(() => {});
  }, []);

  const openAdd = () => {
    setEditingService(null);
    setName(''); setDescription(''); setPrice(''); setDuration('60');
    setCategory('oil_change'); setDefaultProducts([]);
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (svc: WorkshopService & { default_products?: any[] }) => {
    setEditingService(svc);
    setName(svc.name);
    setDescription(svc.description || '');
    setPrice(svc.price.toString());
    setDuration(svc.duration_minutes.toString());
    setCategory(svc.category);
    // Rehydrate default_products from saved data
    const saved = (svc.default_products || []).map((dp: any) => {
      const prod = inventoryProducts.find((p) => p._id === dp.product_id);
      return {
        product_id: dp.product_id,
        product_name: prod?.name || dp.product_id,
        brand: prod?.brand || '',
        unit: prod?.unit || 'pcs',
        quantity: String(dp.quantity),
      };
    });
    setDefaultProducts(saved);
    setErrors({});
    setShowModal(true);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Service name is required';
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) errs.price = 'Valid price is required';
    if (!duration || isNaN(parseInt(duration))) errs.duration = 'Valid duration is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const data = {
        name: name.trim(),
        description: description.trim(),
        price: parseFloat(price),
        duration_minutes: parseInt(duration),
        category,
        default_products: defaultProducts.map((dp) => ({
          product_id: dp.product_id,
          quantity: parseFloat(dp.quantity) || 1,
        })),
      };
      if (editingService) {
        await workshopAPI.updateService(editingService._id, data);
      } else {
        await workshopAPI.addService(data);
      }
      await dispatch(fetchMyWorkshop());
      setShowModal(false);
    } catch {
      showAlert('Error', 'Failed to save service');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (svc: WorkshopService) => {
    showConfirm(`Delete "${svc.name}"?`, async () => {
      await workshopAPI.deleteService(svc._id);
      dispatch(fetchMyWorkshop());
    });
  };

  const addDefaultProduct = (prod: any) => {
    if (defaultProducts.find((dp) => dp.product_id === prod._id)) return; // already added
    setDefaultProducts((prev) => [
      ...prev,
      { product_id: prod._id, product_name: prod.name, brand: prod.brand || '', unit: prod.unit, quantity: '1' },
    ]);
    setShowProductPicker(false);
    setProductSearch('');
  };

  const removeDefaultProduct = (productId: string) => {
    setDefaultProducts((prev) => prev.filter((dp) => dp.product_id !== productId));
  };

  const updateDefaultProductQty = (productId: string, qty: string) => {
    setDefaultProducts((prev) => prev.map((dp) => dp.product_id === productId ? { ...dp, quantity: qty } : dp));
  };

  const filteredInventory = inventoryProducts.filter((p) => {
    const matchesCat = productFilter === 'all' || p.category === productFilter;
    const matchesSearch = !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.brand || '').toLowerCase().includes(productSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const PICKER_CATS = [
    { key: 'all',        label: 'All',         icon: 'apps-outline' },
    { key: 'lubricant',  label: 'Lubricant',   icon: 'water-outline' },
    { key: 'filter',     label: 'Filter',      icon: 'funnel-outline' },
    { key: 'brake',      label: 'Brake',       icon: 'stop-circle-outline' },
    { key: 'tyre',       label: 'Tyre',        icon: 'ellipse-outline' },
    { key: 'electrical', label: 'Electrical',  icon: 'flash-outline' },
    { key: 'body',       label: 'Body',        icon: 'car-outline' },
    { key: 'other',      label: 'Other',       icon: 'cube-outline' },
  ] as const;

  const services = myWorkshop?.services || [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Services</Text>
        <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={services}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="construct-outline" size={56} color={colors.textLight} />
            <Text style={styles.emptyText}>No services yet</Text>
            <Button title="Add Your First Service" onPress={openAdd} style={{ marginTop: 16 }} />
          </View>
        }
        renderItem={({ item }) => {
          const svcProducts = (item.default_products || []).map((dp: any) => {
            const prod = inventoryProducts.find((p) => p._id === dp.product_id);
            return prod ? `${prod.name} ×${dp.quantity}${prod.unit !== 'pcs' ? ' ' + prod.unit : ''}` : null;
          }).filter(Boolean);

          return (
            <Card style={styles.serviceCard}>
              <View style={styles.serviceHeader}>
                <View style={styles.categoryTag}>
                  <Text style={styles.categoryText}>{getCategoryLabel(item.category)}</Text>
                </View>
                <View style={styles.serviceActions}>
                  <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
                    <Ionicons name="pencil-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}>
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.serviceName}>{item.name}</Text>
              {item.description ? <Text style={styles.serviceDesc} numberOfLines={2}>{item.description}</Text> : null}
              <View style={styles.serviceMeta}>
                <Text style={styles.servicePrice}>{formatPrice(item.price)}</Text>
                <Text style={styles.serviceDuration}>{item.duration_minutes} min</Text>
              </View>
              {svcProducts.length > 0 && (
                <View style={styles.productTagsRow}>
                  <Ionicons name="cube-outline" size={12} color={colors.textSecondary} />
                  <Text style={styles.productTagsText} numberOfLines={2}>{svcProducts.join(' · ')}</Text>
                </View>
              )}
            </Card>
          );
        }}
      />

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingService ? 'Edit Service' : 'Add Service'}</Text>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Input label="Service Name" value={name} onChangeText={setName}
              placeholder="e.g. Engine Oil Change" autoCapitalize="words" error={errors.name} />
            <Input label="Description (optional)" value={description} onChangeText={setDescription}
              placeholder="Describe the service..." multiline numberOfLines={2} autoCapitalize="sentences" />
            <View style={styles.row}>
              <View style={styles.half}>
                <Input label="Price (RM)" value={price} onChangeText={setPrice}
                  placeholder="0.00" keyboardType="decimal-pad" error={errors.price} />
              </View>
              <View style={styles.half}>
                <Input label="Duration (min)" value={duration} onChangeText={setDuration}
                  placeholder="60" keyboardType="number-pad" error={errors.duration} />
              </View>
            </View>

            <Text style={styles.categoryLabel}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, category === cat && styles.catChipSelected]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.catText, category === cat && styles.catTextSelected]}>
                    {getCategoryLabel(cat)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Default Products */}
            <View style={styles.defaultProductsSection}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="cube-outline" size={15} color={colors.textSecondary} />
                <Text style={styles.sectionLabel}>Default Products Used</Text>
              </View>
              <Text style={styles.sectionHint}>Products typically consumed for this service — pre-filled in completion reports</Text>

              {defaultProducts.map((dp) => (
                <View key={dp.product_id} style={styles.dpRow}>
                  <View style={styles.dpInfo}>
                    <Text style={styles.dpName}>{dp.product_name}</Text>
                    {dp.brand ? <Text style={styles.dpBrand}>{dp.brand}</Text> : null}
                  </View>
                  <View style={styles.dpQtyRow}>
                    <TextInput
                      style={styles.dpQtyInput}
                      value={dp.quantity}
                      onChangeText={(v) => updateDefaultProductQty(dp.product_id, v)}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                    />
                    <Text style={styles.dpUnit}>{dp.unit}</Text>
                  </View>
                  <TouchableOpacity onPress={() => removeDefaultProduct(dp.product_id)} style={styles.dpRemove}>
                    <Ionicons name="close-circle" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              ))}

              {inventoryProducts.length === 0 ? (
                <Text style={styles.noInventoryText}>No inventory items — add products in your workshop profile first.</Text>
              ) : (
                <TouchableOpacity style={styles.addProductBtn} onPress={() => setShowProductPicker(true)}>
                  <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                  <Text style={styles.addProductBtnText}>Add Product</Text>
                </TouchableOpacity>
              )}
            </View>

            <Button
              title={editingService ? 'Save Changes' : 'Add Service'}
              onPress={handleSave}
              loading={loading}
              fullWidth
              size="lg"
              style={{ marginTop: 24 }}
            />
            <View style={{ height: 32 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Product picker modal */}
      <Modal visible={showProductPicker} animationType="slide" presentationStyle="formSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Product</Text>
            <TouchableOpacity onPress={() => { setShowProductPicker(false); setProductSearch(''); setProductFilter('all'); }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={16} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              value={productSearch}
              onChangeText={setProductSearch}
              placeholder="Search products..."
              placeholderTextColor={colors.textLight}
              autoFocus
            />
          </View>
          {/* Category filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterList}
          >
            {PICKER_CATS.map((c) => {
              const count = c.key === 'all'
                ? inventoryProducts.length
                : inventoryProducts.filter((p) => p.category === c.key).length;
              if (count === 0 && c.key !== 'all') return null;
              const active = productFilter === c.key;
              return (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setProductFilter(c.key)}
                >
                  <Ionicons name={c.icon as any} size={13} color={active ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
                  <View style={[styles.badge, active && styles.badgeActive]}>
                    <Text style={[styles.badgeText, active && styles.badgeTextActive]}>{count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text style={styles.resultCount}>{filteredInventory.length} product{filteredInventory.length !== 1 ? 's' : ''}</Text>
          <FlatList
            data={filteredInventory}
            keyExtractor={(p) => p._id}
            style={{ flex: 1 }}
            contentContainerStyle={styles.pickerListContent}
            ItemSeparatorComponent={() => <View style={styles.pickerSeparator} />}
            renderItem={({ item: prod }) => {
              const already = defaultProducts.some((dp) => dp.product_id === prod._id);
              return (
                <TouchableOpacity
                  style={[styles.pickerRow, already && styles.pickerRowAdded]}
                  onPress={() => !already && addDefaultProduct(prod)}
                  disabled={already}
                >
                  <View style={styles.pickerInfo}>
                    <Text style={styles.pickerName}>{prod.name}</Text>
                    <Text style={styles.pickerMeta}>{prod.brand ? `${prod.brand} · ` : ''}{prod.unit} · {prod.quantity} in stock · {formatPrice(prod.price)}</Text>
                  </View>
                  {already ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  ) : (
                    <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingTop: 40 }}>
                <Text style={{ color: colors.textSecondary }}>No products found</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
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
  title: { ...Typography.h3, color: colors.text },
  addBtn: {},
  list: { padding: Spacing.lg, gap: 12 },
  serviceCard: {},
  serviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  categoryTag: {
    backgroundColor: colors.primary + '15', borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  categoryText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  serviceActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 6 },
  serviceName: { ...Typography.body, fontWeight: '600', color: colors.text, marginBottom: 4 },
  serviceDesc: { ...Typography.caption, color: colors.textSecondary, lineHeight: 18, marginBottom: 8 },
  serviceMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  servicePrice: { ...Typography.body, fontWeight: '700', color: colors.primary },
  serviceDuration: { ...Typography.caption, color: colors.textSecondary },
  productTagsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  productTagsText: { ...Typography.caption, color: colors.textSecondary, flex: 1, lineHeight: 16 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { ...Typography.body, color: colors.textSecondary, marginTop: 12 },
  modal: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  modalTitle: { ...Typography.h3, color: colors.text },
  modalContent: { padding: Spacing.lg },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  categoryLabel: { ...Typography.bodySmall, color: colors.text, fontWeight: '500', marginBottom: 10 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: BorderRadius.full,
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
  },
  catChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  catText: { ...Typography.caption, color: colors.textSecondary, fontWeight: '500' },
  catTextSelected: { color: '#fff' },

  // Default Products
  defaultProductsSection: {
    marginTop: 20, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, gap: 10,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionLabel: { ...Typography.bodySmall, fontWeight: '700', color: colors.text },
  sectionHint: { ...Typography.caption, color: colors.textSecondary, lineHeight: 16 },
  dpRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: colors.border, padding: 10,
  },
  dpInfo: { flex: 1 },
  dpName: { ...Typography.bodySmall, fontWeight: '600', color: colors.text },
  dpBrand: { ...Typography.caption, color: colors.textSecondary },
  dpQtyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dpQtyInput: {
    width: 50, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: BorderRadius.sm, paddingHorizontal: 8, paddingVertical: 5,
    ...Typography.bodySmall, color: colors.text, textAlign: 'center',
    backgroundColor: colors.background,
  },
  dpUnit: { ...Typography.caption, color: colors.textSecondary, minWidth: 28 },
  dpRemove: { padding: 2 },
  noInventoryText: { ...Typography.caption, color: colors.textSecondary, fontStyle: 'italic' },
  addProductBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: colors.primary + '50', borderStyle: 'dashed',
    borderRadius: BorderRadius.sm, padding: 12, backgroundColor: colors.primary + '05',
  },
  addProductBtnText: { ...Typography.bodySmall, color: colors.primary, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: Spacing.md, marginTop: Spacing.md, marginBottom: 6,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  searchInput: { flex: 1, ...Typography.bodySmall, color: colors.text },
  filterScroll: { maxHeight: 48, flexGrow: 0, flexShrink: 0 },
  filterList: { paddingHorizontal: Spacing.md, gap: 8, alignItems: 'center', paddingVertical: 4, flexDirection: 'row', flexWrap: 'nowrap' },
  chip: {
    flexDirection: 'row', alignItems: 'center', flexShrink: 0, gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: BorderRadius.full,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...Typography.caption, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  badge: {
    backgroundColor: colors.border, borderRadius: 8, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  badgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
  badgeTextActive: { color: '#fff' },
  resultCount: { ...Typography.caption, color: colors.textSecondary, paddingHorizontal: Spacing.lg, marginVertical: 6, flexShrink: 0 },
  pickerListContent: { paddingHorizontal: Spacing.md, paddingBottom: 32, paddingTop: 4 },
  pickerSeparator: { height: 8 },
  pickerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: BorderRadius.sm,
    borderWidth: 1, borderColor: colors.border, padding: 12, gap: 10,
  },
  pickerRowAdded: { opacity: 0.5 },
  pickerInfo: { flex: 1 },
  pickerName: { ...Typography.bodySmall, fontWeight: '600', color: colors.text },
  pickerMeta: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },
  });
}
