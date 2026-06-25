import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Typography, Spacing, BorderRadius } from '../../utils/theme';

interface Vehicle { id: string; plate: string; model: string; year: string; color: string }
interface Props { navigation: any }

const STORAGE_KEY = 'my_vehicles';

export const MyVehiclesScreen: React.FC<Props> = ({ navigation }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [loaded, setLoaded] = useState(false);

  React.useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setVehicles(JSON.parse(raw));
      setLoaded(true);
    });
  }, []);

  const save = async (list: Vehicle[]) => {
    setVehicles(list);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  const addVehicle = () => {
    if (!plate.trim() || !model.trim()) return;
    const v: Vehicle = {
      id: Date.now().toString(),
      plate: plate.trim().toUpperCase(),
      model: model.trim(),
      year: year.trim(),
      color: color.trim(),
    };
    save([...vehicles, v]);
    setPlate(''); setModel(''); setYear(''); setColor('');
    setShowForm(false);
  };

  const removeVehicle = (id: string) => {
    const doRemove = () => save(vehicles.filter((v) => v.id !== id));
    if (Platform.OS === 'web') {
      if (window.confirm('Remove this vehicle?')) doRemove();
    } else {
      Alert.alert('Remove Vehicle', 'Remove this vehicle?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: doRemove },
      ]);
    }
  };

  if (!loaded) return null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>My Vehicles</Text>
        <TouchableOpacity onPress={() => setShowForm(true)} style={styles.addBtn}>
          <Ionicons name="add" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {vehicles.length === 0 && !showForm && (
          <View style={styles.empty}>
            <Ionicons name="car-outline" size={64} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>No vehicles added</Text>
            <Text style={styles.emptyText}>Add your car details so workshops know what to service</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowForm(true)}>
              <Text style={styles.emptyBtnText}>Add Vehicle</Text>
            </TouchableOpacity>
          </View>
        )}

        {vehicles.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={styles.card}
            onPress={() => navigation.navigate('VehicleServiceHistory', { vehicle: v })}
            activeOpacity={0.75}
          >
            <View style={styles.cardIcon}>
              <Ionicons name="car" size={28} color={Colors.primary} />
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardPlate}>{v.plate}</Text>
              <Text style={styles.cardModel}>{v.model}{v.year ? ` • ${v.year}` : ''}{v.color ? ` • ${v.color}` : ''}</Text>
              <Text style={styles.cardHint}>Tap to view service history</Text>
            </View>
            <View style={styles.cardRight}>
              <Ionicons name="chevron-forward" size={16} color={Colors.textLight} />
              <TouchableOpacity onPress={() => removeVehicle(v.id)} style={styles.removeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}

        {showForm && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>Add Vehicle</Text>
            <TextInput style={styles.input} value={plate} onChangeText={setPlate}
              placeholder="Plate number (e.g. WXX1234)" placeholderTextColor={Colors.textLight} />
            <TextInput style={styles.input} value={model} onChangeText={setModel}
              placeholder="Make & Model (e.g. Proton Saga)" placeholderTextColor={Colors.textLight} />
            <TextInput style={styles.input} value={year} onChangeText={setYear}
              placeholder="Year (e.g. 2020)" placeholderTextColor={Colors.textLight} keyboardType="numeric" />
            <TextInput style={styles.input} value={color} onChangeText={setColor}
              placeholder="Color (e.g. White)" placeholderTextColor={Colors.textLight} />
            <View style={styles.formBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, (!plate || !model) && styles.saveBtnDisabled]}
                onPress={addVehicle} disabled={!plate || !model}>
                <Text style={styles.saveBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.h3, color: Colors.text },
  body: { padding: Spacing.lg, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyTitle: { ...Typography.h3, color: Colors.text, marginTop: Spacing.lg, marginBottom: 8 },
  emptyText: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.xl },
  emptyBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl, paddingVertical: 12,
  },
  emptyBtnText: { ...Typography.button, color: '#fff' },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardIcon: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: Colors.primary + '15', alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.md,
  },
  cardInfo: { flex: 1 },
  cardPlate: { ...Typography.h3, color: Colors.text },
  cardModel: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },
  cardHint: { ...Typography.caption, color: Colors.primary, marginTop: 4 },
  cardRight: { alignItems: 'center', gap: 6 },
  removeBtn: { padding: 4 },
  form: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.lg, marginTop: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  formTitle: { ...Typography.h3, color: Colors.text, marginBottom: Spacing.md },
  input: {
    backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.md, paddingVertical: 10,
    ...Typography.body, color: Colors.text, marginBottom: Spacing.sm,
  },
  formBtns: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: Colors.border,
    borderRadius: BorderRadius.sm, paddingVertical: 12, alignItems: 'center',
  },
  cancelBtnText: { ...Typography.button, color: Colors.textSecondary },
  saveBtn: {
    flex: 1, backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm, paddingVertical: 12, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { ...Typography.button, color: '#fff' },
});
