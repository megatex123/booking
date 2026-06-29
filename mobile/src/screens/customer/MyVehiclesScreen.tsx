import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, AppTheme } from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { userAPI } from '../../services/api';
import { showAlert, showConfirm } from '../../utils/webAlert';

interface Vehicle {
  name: string;    // model name e.g. "Bezza"
  plate: string;
  brand: string;   // manufacturer e.g. "Perodua"
  year?: number;
  color?: string;
}

interface Props { navigation: any }

export const MyVehiclesScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  // null = adding new, number = editing that index
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form fields
  const [plate, setPlate] = useState('');
  const [brand, setBrand] = useState('');
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await userAPI.getVehicles();
      setVehicles(res.data || []);
    } catch {
      showAlert('Failed to load vehicles.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const syncToAPI = async (list: Vehicle[]) => {
    setSaving(true);
    try {
      await userAPI.updateProfile({ vehicles: list } as any);
      setVehicles(list);
    } catch {
      showAlert('Failed to save. Please try again.');
    }
    setSaving(false);
  };

  const resetForm = () => {
    setPlate(''); setBrand(''); setName(''); setYear(''); setColor('');
    setShowForm(false);
    setEditingIndex(null);
  };

  const openAddForm = () => {
    setPlate(''); setBrand(''); setName(''); setYear(''); setColor('');
    setEditingIndex(null);
    setShowForm(true);
  };

  const openEditForm = (idx: number) => {
    const v = vehicles[idx];
    setPlate(v.plate);
    setBrand(v.brand);
    setName(v.name);
    setYear(v.year ? String(v.year) : '');
    setColor(v.color || '');
    setEditingIndex(idx);
    setShowForm(true);
  };

  const addVehicle = async () => {
    if (!plate.trim() || !brand.trim() || !name.trim()) {
      showAlert('Plate, brand, and model name are required.');
      return;
    }
    const v: Vehicle = {
      plate: plate.trim().toUpperCase(),
      brand: brand.trim(),
      name: name.trim(),
      year: year ? parseInt(year, 10) : undefined,
      color: color.trim() || undefined,
    };
    await syncToAPI([...vehicles, v]);
    resetForm();
  };

  const saveEdit = async () => {
    if (!plate.trim() || !brand.trim() || !name.trim()) {
      showAlert('Plate, brand, and model name are required.');
      return;
    }
    if (editingIndex === null) return;
    const updated: Vehicle = {
      plate: plate.trim().toUpperCase(),
      brand: brand.trim(),
      name: name.trim(),
      year: year ? parseInt(year, 10) : undefined,
      color: color.trim() || undefined,
    };
    const newList = vehicles.map((v, i) => (i === editingIndex ? updated : v));
    await syncToAPI(newList);
    resetForm();
  };

  const removeVehicle = async (idx: number) => {
    showConfirm('Remove this vehicle?', async () => {
      await syncToAPI(vehicles.filter((_, i) => i !== idx));
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>My Vehicles</Text>
          <View style={{ width: 40 }} />
        </View>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>My Vehicles</Text>
        <TouchableOpacity onPress={openAddForm} style={styles.addBtn} disabled={saving}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {vehicles.length === 0 && !showForm && (
          <View style={styles.empty}>
            <Ionicons name="car-outline" size={64} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>No vehicles added</Text>
            <Text style={styles.emptyText}>
              Register your car so workshops know what to service and to track your Car Health Score.
            </Text>
            <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={openAddForm}>
              <Text style={styles.emptyBtnText}>Add Vehicle</Text>
            </TouchableOpacity>
          </View>
        )}

        {vehicles.map((v, idx) => (
          <TouchableOpacity
            key={`${v.plate}-${idx}`}
            style={styles.card}
            onPress={() => navigation.navigate('VehicleServiceHistory', {
              vehicle: { id: v.plate, plate: v.plate, model: `${v.brand} ${v.name}`, year: String(v.year ?? ''), color: v.color ?? '' }
            })}
            activeOpacity={0.75}
          >
            <View style={[styles.cardIcon, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="car" size={28} color={colors.primary} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardPlate}>{v.plate}</Text>
              <Text style={styles.cardModel}>
                {v.brand} {v.name}{v.year ? ` • ${v.year}` : ''}{v.color ? ` • ${v.color}` : ''}
              </Text>
              <Text style={[styles.cardHint, { color: colors.primary }]}>Tap to view service history</Text>
            </View>
            <View style={styles.cardRight}>
              <TouchableOpacity
                onPress={() => openEditForm(idx)}
                style={styles.cardAction}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                disabled={saving}
              >
                <Ionicons name="pencil-outline" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => removeVehicle(idx)}
                style={styles.cardAction}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                disabled={saving}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}

        {showForm && (
          <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.formTitle, { color: colors.text }]}>
              {editingIndex !== null ? 'Edit Vehicle' : 'Add Vehicle'}
            </Text>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Plate Number *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={plate} onChangeText={setPlate}
              placeholder="e.g. WXX 1234" placeholderTextColor={colors.textSecondary}
              autoCapitalize="characters"
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Brand / Manufacturer *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={brand} onChangeText={setBrand}
              placeholder="e.g. Perodua, Proton, Toyota" placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Model Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={name} onChangeText={setName}
              placeholder="e.g. Bezza, Saga, Vios" placeholderTextColor={colors.textSecondary}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Year</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={year} onChangeText={setYear}
              placeholder="e.g. 2023" placeholderTextColor={colors.textSecondary}
              keyboardType="numeric" maxLength={4}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Color</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              value={color} onChangeText={setColor}
              placeholder="e.g. White, Red, Silver" placeholderTextColor={colors.textSecondary}
            />

            <View style={styles.formBtns}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={resetForm} disabled={saving}>
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary }, (!plate || !brand || !name) && styles.saveBtnDisabled]}
                onPress={editingIndex !== null ? saveEdit : addVehicle}
                disabled={!plate || !brand || !name || saving}
              >
                {saving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.saveBtnText}>{editingIndex !== null ? 'Save' : 'Add'}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
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
    addBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: { ...Typography.h3, color: colors.text },
    body: { padding: Spacing.lg, flexGrow: 1 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
    emptyTitle: { ...Typography.h3, color: colors.text, marginTop: Spacing.lg, marginBottom: 8 },
    emptyText: { ...Typography.body, color: colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl, paddingHorizontal: 16, lineHeight: 22 },
    emptyBtn: { borderRadius: BorderRadius.md, paddingHorizontal: Spacing.xl, paddingVertical: 12 },
    emptyBtnText: { ...Typography.button, color: '#fff' },
    card: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface,
      borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md,
      borderWidth: 1, borderColor: colors.border,
    },
    cardIcon: {
      width: 50, height: 50, borderRadius: 25,
      alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md,
    },
    cardInfo: { flex: 1 },
    cardPlate: { ...Typography.h3, color: colors.text },
    cardModel: { ...Typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
    cardHint: { ...Typography.caption, marginTop: 4 },
    cardRight: { alignItems: 'center', gap: 8 },
    cardAction: { padding: 4 },
    form: {
      borderRadius: BorderRadius.md, padding: Spacing.lg,
      marginTop: Spacing.md, borderWidth: 1,
    },
    formTitle: { ...Typography.h3, marginBottom: Spacing.md },
    fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
    input: {
      borderWidth: 1, borderRadius: BorderRadius.sm,
      paddingHorizontal: Spacing.md, paddingVertical: 10,
      ...Typography.body, marginBottom: Spacing.md,
    },
    formBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
    cancelBtn: {
      flex: 1, borderWidth: 1, borderRadius: BorderRadius.sm,
      paddingVertical: 12, alignItems: 'center',
    },
    cancelBtnText: { ...Typography.button },
    saveBtn: {
      flex: 1, borderRadius: BorderRadius.sm,
      paddingVertical: 12, alignItems: 'center',
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { ...Typography.button, color: '#fff' },
  });
}
