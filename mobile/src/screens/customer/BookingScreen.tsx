import React, { useState, useEffect, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { showAlert } from '../../utils/webAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { useAppDispatch, useAppSelector } from '../../store';
import { updateUser } from '../../store/authSlice';
import { createBooking } from '../../store/bookingSlice';
import { userAPI, referralAPI, corporateAPI, loyaltyAPI } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { formatPrice, getAvailableDates, generateTimeSlots, formatDate, formatTime } from '../../utils/helpers';
import { Workshop, WorkshopService } from '../../types';

const INSURANCE_PROVIDERS = [
  { value: 'takaful', label: 'Takaful Malaysia' },
  { value: 'etiqa', label: 'Etiqa Insurance' },
  { value: 'allianz', label: 'Allianz' },
  { value: 'axa', label: 'AXA Affin' },
  { value: 'msig', label: 'MSIG' },
  { value: 'berjaya_sompo', label: 'Berjaya Sompo' },
  { value: 'zurich', label: 'Zurich' },
  { value: 'lonpac', label: 'Lonpac' },
];

interface Props { navigation: any; route: any }

interface VehicleOption {
  plate: string;
  name: string;   // model name e.g. "Myvi"
  brand: string;  // e.g. "Perodua"
  year?: string;
  color?: string;
}

const LOCAL_STORAGE_KEY = 'my_vehicles';

// Infer brand/name from a combined "Make Model" string (e.g. "Proton Saga" → brand=Proton, name=Saga)
function splitMakeModel(model: string): { brand: string; name: string } {
  const parts = model.trim().split(/\s+/);
  if (parts.length === 1) return { brand: parts[0], name: parts[0] };
  return { brand: parts[0], name: parts.slice(1).join(' ') };
}

export const BookingScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const workshop: Workshop = route.params?.workshop;
  const services: WorkshopService[] = route.params?.services || [];
  const dispatch = useAppDispatch();
  const { loading } = useAppSelector((s) => s.bookings);
  const { user } = useAppSelector((s) => s.auth);

  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState(false);

  // Add vehicle form fields
  const [newPlate, setNewPlate] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newName, setNewName] = useState('');
  const [newYear, setNewYear] = useState('');
  const [newColor, setNewColor] = useState('');
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Referral
  const [referralCode, setReferralCode] = useState('');
  const [referralValidating, setReferralValidating] = useState(false);
  const [referralInfo, setReferralInfo] = useState<{ discount_pct: number; discount_cap: number; referrer_name: string } | null>(null);
  const [referralError, setReferralError] = useState('');

  // Payment type
  const [loyaltyBalance, setLoyaltyBalance] = useState<{ points: number; rm_value: number; min_redeem: number } | null>(null);
  const [useLoyaltyPoints, setUseLoyaltyPoints] = useState(false);

  // Book for someone else
  const [bookedForOther, setBookedForOther] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestPlate, setGuestPlate] = useState('');
  const [guestMake, setGuestMake] = useState('');
  const [guestModel, setGuestModel] = useState('');

  const [paymentType, setPaymentType] = useState<'self_pay' | 'insurance' | 'corporate'>('self_pay');
  const [hasCorporate, setHasCorporate] = useState(false);

  // Insurance
  const [insProvider, setInsProvider] = useState('');
  const [insPolicyNo, setInsPolicyNo] = useState('');
  const [insIncidentDate, setInsIncidentDate] = useState('');
  const [showProviderPicker, setShowProviderPicker] = useState(false);

  const dates = getAvailableDates(14);
  const timeSlots = generateTimeSlots();
  const totalPrice = services.reduce((sum, s) => sum + s.price, 0);
  const totalDuration = services.reduce((sum, s) => sum + s.duration_minutes, 0);

  // Load and merge vehicles from Redux (backend) and AsyncStorage (local)
  useEffect(() => {
    const mergeVehicles = async () => {
      const seen = new Set<string>();
      const merged: VehicleOption[] = [];

      // 1. Backend vehicles (from user profile)
      for (const v of user?.vehicles || []) {
        const plate = (v.plate || '').toUpperCase();
        if (!plate || seen.has(plate)) continue;
        seen.add(plate);
        merged.push({ plate, name: v.name || '', brand: v.brand || '', year: v.year?.toString(), color: v.color });
      }

      // 2. Local AsyncStorage vehicles
      try {
        const raw = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
          const local = JSON.parse(raw) as Array<{ plate: string; model: string; year?: string; color?: string; brand?: string }>;
          for (const v of local) {
            const plate = (v.plate || '').toUpperCase();
            if (!plate || seen.has(plate)) continue;
            seen.add(plate);
            const { brand, name } = v.brand ? { brand: v.brand, name: v.model } : splitMakeModel(v.model || '');
            merged.push({ plate, name, brand, year: v.year, color: v.color });
          }
        }
      } catch {}

      setVehicles(merged);
      if (merged.length === 0) setShowAddForm(true);
    };

    mergeVehicles();
  }, [user?.vehicles]);

  useEffect(() => {
    corporateAPI.getMy().then(() => setHasCorporate(true)).catch(() => setHasCorporate(false));
    loyaltyAPI.getBalance().then((r) => setLoyaltyBalance(r.data)).catch(() => {});
  }, []);

  const handleValidateReferral = async () => {
    if (!referralCode.trim()) return;
    setReferralValidating(true);
    setReferralError('');
    setReferralInfo(null);
    try {
      const r = await referralAPI.validate(referralCode.trim().toUpperCase());
      setReferralInfo(r.data);
    } catch (e: any) {
      setReferralError(e?.response?.data?.detail || 'Invalid referral code');
    } finally {
      setReferralValidating(false);
    }
  };

  const validateAdd = () => {
    const errs: Record<string, string> = {};
    if (!newPlate.trim()) errs.plate = 'Plate number is required';
    if (!newName.trim()) errs.name = 'Vehicle model is required';
    if (!newBrand.trim()) errs.brand = 'Brand is required';
    setAddErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddVehicle = async () => {
    if (!validateAdd()) return;
    setSavingVehicle(true);
    const plate = newPlate.trim().toUpperCase();

    const newV: VehicleOption = {
      plate,
      name: newName.trim(),
      brand: newBrand.trim(),
      year: newYear.trim() || undefined,
      color: newColor.trim() || undefined,
    };

    try {
      // Save to backend
      const updatedVehicles = [
        ...(user?.vehicles || []),
        { plate, name: newV.name, brand: newV.brand, year: newV.year ? parseInt(newV.year) : undefined, color: newV.color },
      ];
      const res = await userAPI.updateProfile({ vehicles: updatedVehicles });
      dispatch(updateUser({ vehicles: res.data?.vehicles || updatedVehicles }));

      // Save to local AsyncStorage too
      const raw = await AsyncStorage.getItem(LOCAL_STORAGE_KEY);
      const local = raw ? JSON.parse(raw) : [];
      await AsyncStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([
        ...local,
        { id: Date.now().toString(), plate, model: `${newV.brand} ${newV.name}`, brand: newV.brand, year: newV.year || '', color: newV.color || '' },
      ]));
    } catch {}

    const updated = [...vehicles, newV];
    setVehicles(updated);
    setSelectedVehicle(newV);
    setShowAddForm(false);
    setNewPlate(''); setNewBrand(''); setNewName(''); setNewYear(''); setNewColor('');
    setAddErrors({});
    setSavingVehicle(false);
  };

  // Loyalty points computation
  const referralDiscount = referralInfo ? Math.min(totalPrice * referralInfo.discount_pct / 100, referralInfo.discount_cap) : 0;
  const priceAfterReferral = Math.max(totalPrice - referralDiscount, 0);
  const maxLoyaltyPts = loyaltyBalance ? Math.min(Math.floor(loyaltyBalance.points / 100) * 100, Math.floor(priceAfterReferral / 0.01 / 100) * 100) : 0;
  const loyaltyPtsToUse = useLoyaltyPoints ? maxLoyaltyPts : 0;
  const loyaltyDiscount = loyaltyPtsToUse * 0.01;

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!selectedVehicle) errs.vehicle = 'Please select or register a vehicle';
    if (!selectedDate) errs.date = 'Please select a date';
    if (!selectedTime) errs.time = 'Please select a time';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleBook = async () => {
    if (!validate()) return;
    if (paymentType === 'insurance' && (!insProvider || !insPolicyNo || !insIncidentDate)) {
      showAlert('Missing Info', 'Please fill in all insurance claim fields.');
      return;
    }
    const payload: any = {
      workshop_id: workshop.id,
      service_ids: services.map((s) => s._id),
      vehicle_plate: selectedVehicle!.plate,
      vehicle_name: selectedVehicle!.name,
      vehicle_brand: selectedVehicle!.brand,
      scheduled_date: selectedDate,
      scheduled_time: selectedTime,
      notes: notes.trim(),
      payment_type: paymentType,
    };
    if (referralInfo && referralCode) payload.referral_code = referralCode.trim().toUpperCase();
    if (loyaltyPtsToUse >= 100) payload.loyalty_points_used = loyaltyPtsToUse;
    if (bookedForOther) {
      payload.booked_for_other = true;
      payload.guest_contact_name = guestName.trim();
      payload.guest_contact_phone = guestPhone.trim();
      if (guestPlate.trim()) {
        payload.guest_vehicle = { plate: guestPlate.trim().toUpperCase(), make: guestMake.trim(), model: guestModel.trim() };
        payload.vehicle_plate = guestPlate.trim().toUpperCase();
        payload.vehicle_name = guestModel.trim();
        payload.vehicle_brand = guestMake.trim();
      }
    }
    if (paymentType === 'insurance') {
      payload.insurance_details = { provider: insProvider, policy_number: insPolicyNo, incident_date: insIncidentDate };
    }
    const result = await dispatch(createBooking(payload));
    if (result.meta.requestStatus === 'fulfilled') {
      navigation.navigate('BookingSuccess', { booking: result.payload });
    } else {
      showAlert('Booking Failed', result.payload as string);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Book Service</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Workshop & Services Summary */}
        <Card style={styles.summaryCard}>
          <Text style={styles.workshopName}>{workshop.workshop_name}</Text>
          <Text style={styles.workshopAddress}>{workshop.address}</Text>
          <View style={styles.divider} />
          {services.map((svc) => (
            <View key={svc._id} style={styles.serviceRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceName}>{svc.name}</Text>
                {svc.duration_minutes > 0 && (
                  <Text style={styles.serviceDuration}>~{svc.duration_minutes} min</Text>
                )}
              </View>
              <Text style={styles.servicePrice}>{formatPrice(svc.price)}</Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total ({totalDuration} min est.)</Text>
            <Text style={styles.totalAmount}>{formatPrice(totalPrice)}</Text>
          </View>
        </Card>

        {/* Vehicle Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Vehicle</Text>
          {errors.vehicle && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
              <Text style={styles.errorText}>{errors.vehicle}</Text>
            </View>
          )}

          {vehicles.length === 0 && !showAddForm && (
            <View style={styles.noVehicleCard}>
              <Ionicons name="car-outline" size={40} color={colors.textLight} />
              <Text style={styles.noVehicleTitle}>No vehicles registered</Text>
              <Text style={styles.noVehicleText}>Register your vehicle to continue with the booking.</Text>
            </View>
          )}

          {vehicles.map((v) => {
            const selected = selectedVehicle?.plate === v.plate;
            return (
              <TouchableOpacity
                key={v.plate}
                style={[styles.vehicleCard, selected && styles.vehicleCardSelected]}
                onPress={() => { setSelectedVehicle(v); setShowAddForm(false); }}
                activeOpacity={0.8}
              >
                <View style={[styles.vehicleRadio, selected && styles.vehicleRadioSelected]}>
                  {selected && <View style={styles.vehicleRadioDot} />}
                </View>
                <View style={[styles.vehicleIconCircle, selected && styles.vehicleIconCircleSelected]}>
                  <Ionicons name="car" size={20} color={selected ? '#fff' : colors.primary} />
                </View>
                <View style={styles.vehicleDetails}>
                  <Text style={[styles.vehiclePlate, selected && styles.vehicleTextSelected]}>{v.plate}</Text>
                  <Text style={[styles.vehicleModel, selected && { color: colors.primary + 'CC' }]}>
                    {v.brand} {v.name}{v.year ? ` · ${v.year}` : ''}{v.color ? ` · ${v.color}` : ''}
                  </Text>
                </View>
                {selected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}

          {/* Add Vehicle toggle */}
          {!showAddForm && (
            <TouchableOpacity style={styles.addVehicleBtn} onPress={() => setShowAddForm(true)}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.addVehicleBtnText}>
                {vehicles.length === 0 ? 'Register a Vehicle' : '+ Add Another Vehicle'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Inline Add Vehicle Form */}
          {showAddForm && (
            <View style={styles.addForm}>
              <View style={styles.addFormHeader}>
                <Text style={styles.addFormTitle}>Register Vehicle</Text>
                {vehicles.length > 0 && (
                  <TouchableOpacity onPress={() => { setShowAddForm(false); setAddErrors({}); }}>
                    <Ionicons name="close" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.fieldLabel}>License Plate *</Text>
              <TextInput
                style={[styles.fieldInput, addErrors.plate && styles.fieldInputError]}
                value={newPlate}
                onChangeText={setNewPlate}
                placeholder="e.g. WXY 1234"
                placeholderTextColor={colors.textLight}
                autoCapitalize="characters"
              />
              {addErrors.plate && <Text style={styles.fieldError}>{addErrors.plate}</Text>}

              <View style={styles.row2}>
                <View style={styles.col2}>
                  <Text style={styles.fieldLabel}>Brand *</Text>
                  <TextInput
                    style={[styles.fieldInput, addErrors.brand && styles.fieldInputError]}
                    value={newBrand}
                    onChangeText={setNewBrand}
                    placeholder="e.g. Perodua"
                    placeholderTextColor={colors.textLight}
                    autoCapitalize="words"
                  />
                  {addErrors.brand && <Text style={styles.fieldError}>{addErrors.brand}</Text>}
                </View>
                <View style={styles.col2}>
                  <Text style={styles.fieldLabel}>Model *</Text>
                  <TextInput
                    style={[styles.fieldInput, addErrors.name && styles.fieldInputError]}
                    value={newName}
                    onChangeText={setNewName}
                    placeholder="e.g. Myvi"
                    placeholderTextColor={colors.textLight}
                    autoCapitalize="words"
                  />
                  {addErrors.name && <Text style={styles.fieldError}>{addErrors.name}</Text>}
                </View>
              </View>

              <View style={styles.row2}>
                <View style={styles.col2}>
                  <Text style={styles.fieldLabel}>Year</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={newYear}
                    onChangeText={setNewYear}
                    placeholder="e.g. 2021"
                    placeholderTextColor={colors.textLight}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
                <View style={styles.col2}>
                  <Text style={styles.fieldLabel}>Color</Text>
                  <TextInput
                    style={styles.fieldInput}
                    value={newColor}
                    onChangeText={setNewColor}
                    placeholder="e.g. Silver"
                    placeholderTextColor={colors.textLight}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveVehicleBtn, savingVehicle && { opacity: 0.6 }]}
                onPress={handleAddVehicle}
                disabled={savingVehicle}
              >
                {savingVehicle
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.saveVehicleBtnText}>Save & Select Vehicle</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          {errors.date && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
              <Text style={styles.errorText}>{errors.date}</Text>
            </View>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateList}>
            {dates.map((date) => {
              const d = new Date(date);
              const day = d.toLocaleDateString('en-MY', { weekday: 'short' });
              const num = d.getDate();
              const month = d.toLocaleDateString('en-MY', { month: 'short' });
              const selected = selectedDate === date;
              return (
                <TouchableOpacity
                  key={date}
                  style={[styles.dateChip, selected && styles.dateChipSelected]}
                  onPress={() => setSelectedDate(date)}
                >
                  <Text style={[styles.dateDay, selected && styles.dateTextSelected]}>{day}</Text>
                  <Text style={[styles.dateNum, selected && styles.dateTextSelected]}>{num}</Text>
                  <Text style={[styles.dateMonth, selected && styles.dateTextSelected]}>{month}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Time Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Time</Text>
          {errors.time && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
              <Text style={styles.errorText}>{errors.time}</Text>
            </View>
          )}
          <View style={styles.timeGrid}>
            {timeSlots.map((time) => (
              <TouchableOpacity
                key={time}
                style={[styles.timeChip, selectedTime === time && styles.timeChipSelected]}
                onPress={() => setSelectedTime(time)}
              >
                <Text style={[styles.timeText, selectedTime === time && styles.timeTextSelected]}>
                  {formatTime(time)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Notes <Text style={styles.optional}>(optional)</Text></Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Describe the problem or any special requests..."
            placeholderTextColor={colors.textLight}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Book for Someone Else */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.forOtherToggle}
            onPress={() => setBookedForOther((v) => !v)}
            activeOpacity={0.8}
          >
            <View style={styles.forOtherLeft}>
              <Ionicons name="people-outline" size={20} color={bookedForOther ? colors.primary : colors.textSecondary} />
              <View>
                <Text style={[styles.forOtherTitle, bookedForOther && { color: colors.primary }]}>
                  Booking for someone else?
                </Text>
                <Text style={styles.forOtherSub}>Family member, spouse, friend</Text>
              </View>
            </View>
            <Ionicons
              name={bookedForOther ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={bookedForOther ? colors.primary : colors.textLight}
            />
          </TouchableOpacity>

          {bookedForOther && (
            <View style={styles.forOtherForm}>
              <Text style={styles.fieldLabel}>Their Name *</Text>
              <TextInput
                style={styles.fieldInput}
                value={guestName}
                onChangeText={setGuestName}
                placeholder="e.g. Ayah, Ibu, Ahmad"
                placeholderTextColor={colors.textLight}
                autoCapitalize="words"
              />
              <Text style={styles.fieldLabel}>Their Phone</Text>
              <TextInput
                style={styles.fieldInput}
                value={guestPhone}
                onChangeText={setGuestPhone}
                placeholder="e.g. 012-3456789"
                placeholderTextColor={colors.textLight}
                keyboardType="phone-pad"
              />
              <Text style={styles.fieldLabel}>Their Car Plate</Text>
              <View style={styles.row2}>
                <View style={styles.col2}>
                  <TextInput
                    style={styles.fieldInput}
                    value={guestPlate}
                    onChangeText={setGuestPlate}
                    placeholder="e.g. WXY 1234"
                    placeholderTextColor={colors.textLight}
                    autoCapitalize="characters"
                  />
                </View>
                <View style={styles.col2}>
                  <TextInput
                    style={styles.fieldInput}
                    value={guestMake}
                    onChangeText={setGuestMake}
                    placeholder="Brand e.g. Perodua"
                    placeholderTextColor={colors.textLight}
                    autoCapitalize="words"
                  />
                </View>
              </View>
              <TextInput
                style={styles.fieldInput}
                value={guestModel}
                onChangeText={setGuestModel}
                placeholder="Model e.g. Myvi"
                placeholderTextColor={colors.textLight}
                autoCapitalize="words"
              />
            </View>
          )}
        </View>

        {/* Payment Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          {(['self_pay', 'insurance', ...(hasCorporate ? ['corporate'] : [])] as const).map((pt) => {
            const labels: Record<string, string> = { self_pay: 'Self Pay', insurance: 'Insurance Claim', corporate: 'Corporate Billing' };
            const icons: Record<string, string> = { self_pay: 'card-outline', insurance: 'shield-checkmark-outline', corporate: 'business-outline' };
            const active = paymentType === pt;
            return (
              <TouchableOpacity
                key={pt}
                style={[styles.payTypeCard, active && styles.payTypeCardActive]}
                onPress={() => setPaymentType(pt as any)}
                activeOpacity={0.8}
              >
                <View style={[styles.payTypeRadio, active && styles.payTypeRadioActive]}>
                  {active && <View style={styles.payTypeRadioDot} />}
                </View>
                <Ionicons name={icons[pt] as any} size={20} color={active ? colors.primary : colors.textSecondary} />
                <Text style={[styles.payTypeLabel, active && styles.payTypeLabelActive]}>{labels[pt]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Insurance Form */}
        {paymentType === 'insurance' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Insurance Details</Text>
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowProviderPicker(true)}>
              <Text style={insProvider ? styles.pickerValue : styles.pickerPlaceholder}>
                {insProvider ? INSURANCE_PROVIDERS.find(p => p.value === insProvider)?.label : 'Select insurance provider'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.textLight} />
            </TouchableOpacity>
            <TextInput
              style={styles.fieldInput}
              value={insPolicyNo}
              onChangeText={setInsPolicyNo}
              placeholder="Policy number"
              placeholderTextColor={colors.textLight}
            />
            <TextInput
              style={styles.fieldInput}
              value={insIncidentDate}
              onChangeText={setInsIncidentDate}
              placeholder="Incident date (YYYY-MM-DD)"
              placeholderTextColor={colors.textLight}
            />
          </View>
        )}

        {/* Referral Code */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Referral Code <Text style={styles.optional}>(optional)</Text></Text>
          <View style={styles.referralRow}>
            <TextInput
              style={[styles.referralInput, referralInfo && styles.referralInputValid, !!referralError && styles.referralInputError]}
              value={referralCode}
              onChangeText={(t) => { setReferralCode(t.toUpperCase()); setReferralInfo(null); setReferralError(''); }}
              placeholder="e.g. ABC123"
              placeholderTextColor={colors.textLight}
              autoCapitalize="characters"
              maxLength={6}
            />
            <TouchableOpacity style={styles.referralApplyBtn} onPress={handleValidateReferral} disabled={referralValidating || !referralCode.trim()}>
              {referralValidating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.referralApplyText}>Apply</Text>}
            </TouchableOpacity>
          </View>
          {referralInfo && (
            <View style={styles.referralSuccess}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={styles.referralSuccessText}>
                {referralInfo.referrer_name}'s code! You save {referralInfo.discount_pct}% (up to RM{referralInfo.discount_cap.toFixed(0)})
              </Text>
            </View>
          )}
          {!!referralError && <Text style={styles.referralErrorText}>{referralError}</Text>}
        </View>

        {/* Loyalty Points */}
        {loyaltyBalance && loyaltyBalance.points >= 100 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Loyalty Points <Text style={styles.optional}>(optional)</Text></Text>
            <View style={styles.loyaltyCard}>
              <View style={styles.loyaltyTop}>
                <View style={styles.loyaltyLeft}>
                  <Ionicons name="star" size={18} color="#F59E0B" />
                  <View>
                    <Text style={styles.loyaltyPts}>{loyaltyBalance.points} pts</Text>
                    <Text style={styles.loyaltyRm}>≈ RM{loyaltyBalance.rm_value.toFixed(2)} available</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.loyaltyToggle, useLoyaltyPoints && styles.loyaltyToggleActive]}
                  onPress={() => setUseLoyaltyPoints((v) => !v)}
                >
                  <Ionicons name={useLoyaltyPoints ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={useLoyaltyPoints ? colors.success : colors.textLight} />
                  <Text style={[styles.loyaltyToggleText, useLoyaltyPoints && { color: colors.success }]}>
                    {useLoyaltyPoints ? 'Applied' : 'Use points'}
                  </Text>
                </TouchableOpacity>
              </View>
              {useLoyaltyPoints && loyaltyPtsToUse >= 100 && (
                <View style={styles.loyaltyBadge}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={styles.loyaltyBadgeText}>{loyaltyPtsToUse} pts → RM{loyaltyDiscount.toFixed(2)} off your booking</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.paymentNote}>
            {`💳 Payment (${formatPrice(Math.max(totalPrice - referralDiscount - loyaltyDiscount, 0))}${referralInfo ? ` · ${referralInfo.discount_pct}% referral discount` : ''}${loyaltyPtsToUse >= 100 ? ` · ${loyaltyPtsToUse} pts off` : ''}) will be collected after the workshop confirms your booking.`}
          </Text>
          <Button
            title="Confirm Booking"
            onPress={handleBook}
            loading={loading}
            fullWidth
            size="lg"
          />
        </View>

        {/* Insurance Provider Picker Modal */}
        <Modal visible={showProviderPicker} transparent animationType="slide">
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowProviderPicker(false)}>
            <View style={styles.providerSheet}>
              <Text style={styles.providerSheetTitle}>Select Provider</Text>
              {INSURANCE_PROVIDERS.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  style={[styles.providerOption, insProvider === p.value && styles.providerOptionActive]}
                  onPress={() => { setInsProvider(p.value); setShowProviderPicker(false); }}
                >
                  <Text style={[styles.providerOptionText, insProvider === p.value && { color: colors.primary, fontWeight: '700' }]}>{p.label}</Text>
                  {insProvider === p.value && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
        <View style={{ height: 32 }} />
      </ScrollView>
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
  summaryCard: { margin: Spacing.lg, marginBottom: 8 },
  workshopName: { ...Typography.h3, color: colors.text, marginBottom: 4 },
  workshopAddress: { ...Typography.caption, color: colors.textSecondary, marginBottom: 12 },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: 12 },
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  serviceName: { ...Typography.bodySmall, color: colors.text },
  servicePrice: { ...Typography.bodySmall, color: colors.text, fontWeight: '600' },
  serviceDuration: { ...Typography.caption, color: colors.textLight, marginTop: 2 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { ...Typography.body, color: colors.textSecondary },
  totalAmount: { ...Typography.h3, color: colors.primary },

  section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.h3, color: colors.text, marginBottom: Spacing.md },
  optional: { ...Typography.body, color: colors.textSecondary, fontWeight: '400' },

  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10, marginTop: -4 },
  errorText: { ...Typography.caption, color: colors.danger },

  noVehicleCard: {
    alignItems: 'center', paddingVertical: 32, gap: 8,
    backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
    marginBottom: 12,
  },
  noVehicleTitle: { ...Typography.h3, color: colors.text },
  noVehicleText: { ...Typography.bodySmall, color: colors.textSecondary, textAlign: 'center', maxWidth: 260 },

  vehicleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: 10,
    borderWidth: 1.5, borderColor: colors.border,
  },
  vehicleCardSelected: {
    borderColor: colors.primary, backgroundColor: colors.primary + '06',
  },
  vehicleRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  vehicleRadioSelected: { borderColor: colors.primary },
  vehicleRadioDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary,
  },
  vehicleIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center',
  },
  vehicleIconCircleSelected: { backgroundColor: colors.primary },
  vehicleDetails: { flex: 1 },
  vehiclePlate: { ...Typography.bodySmall, fontWeight: '700', color: colors.text },
  vehicleTextSelected: { color: colors.primary },
  vehicleModel: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },

  addVehicleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 16,
    borderRadius: BorderRadius.md, borderWidth: 1.5,
    borderColor: colors.primary, borderStyle: 'dashed',
    justifyContent: 'center', backgroundColor: colors.primary + '05',
  },
  addVehicleBtnText: { ...Typography.bodySmall, color: colors.primary, fontWeight: '600' },

  addForm: {
    backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: colors.border, marginTop: 4,
  },
  addFormHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  addFormTitle: { ...Typography.h3, color: colors.text },
  fieldLabel: { ...Typography.caption, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  fieldInput: {
    backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: BorderRadius.sm, paddingHorizontal: 12, paddingVertical: 10,
    ...Typography.body, color: colors.text, marginBottom: 12,
  },
  fieldInputError: { borderColor: colors.danger },
  fieldError: { ...Typography.caption, color: colors.danger, marginTop: -8, marginBottom: 10 },
  row2: { flexDirection: 'row', gap: 10 },
  col2: { flex: 1 },
  saveVehicleBtn: {
    backgroundColor: colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 13, alignItems: 'center', marginTop: 4,
  },
  saveVehicleBtnText: { ...Typography.button, color: '#fff' },

  dateList: { marginHorizontal: -4 },
  dateChip: {
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: BorderRadius.md, backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.border, marginHorizontal: 4, minWidth: 60,
  },
  dateChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  dateDay: { ...Typography.caption, color: colors.textSecondary, marginBottom: 2 },
  dateNum: { ...Typography.h3, color: colors.text },
  dateMonth: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },
  dateTextSelected: { color: '#fff' },

  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: BorderRadius.sm, backgroundColor: colors.surface,
    borderWidth: 1.5, borderColor: colors.border,
  },
  timeChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  timeText: { ...Typography.bodySmall, color: colors.text, fontWeight: '500' },
  timeTextSelected: { color: '#fff' },

  notesInput: {
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 12,
    ...Typography.body, color: colors.text, minHeight: 90,
  },
  paymentNote: {
    ...Typography.bodySmall, color: colors.textSecondary,
    backgroundColor: colors.primary + '10', borderRadius: BorderRadius.sm,
    padding: 12, marginBottom: 16, lineHeight: 20,
  },

  // Book for others
  forOtherToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1.5, borderColor: colors.border,
  },
  forOtherLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  forOtherTitle: { ...Typography.body, color: colors.text, fontWeight: '600' },
  forOtherSub: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },
  forOtherForm: {
    backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: colors.border, marginTop: 10,
  },

  // Payment type
  payTypeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: 10,
    borderWidth: 1.5, borderColor: colors.border,
  },
  payTypeCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + '06' },
  payTypeRadio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  payTypeRadioActive: { borderColor: colors.primary },
  payTypeRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  payTypeLabel: { ...Typography.body, color: colors.textSecondary, flex: 1 },
  payTypeLabelActive: { color: colors.primary, fontWeight: '600' },

  // Referral
  referralRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  referralInput: {
    flex: 1, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: BorderRadius.sm, paddingHorizontal: 12, paddingVertical: 10,
    ...Typography.body, color: colors.text, letterSpacing: 3,
  },
  referralInputValid: { borderColor: colors.success },
  referralInputError: { borderColor: colors.danger },
  referralApplyBtn: {
    backgroundColor: colors.primary, borderRadius: BorderRadius.sm,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  referralApplyText: { ...Typography.button, color: '#fff' },
  referralSuccess: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  referralSuccessText: { ...Typography.bodySmall, color: colors.success, flex: 1 },
  referralErrorText: { ...Typography.caption, color: colors.danger, marginTop: 6 },

  loyaltyCard: {
    backgroundColor: '#F59E0B08', borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: '#F59E0B30', padding: Spacing.md,
  },
  loyaltyTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  loyaltyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loyaltyPts: { ...Typography.body, fontWeight: '700', color: colors.text },
  loyaltyRm: { ...Typography.caption, color: colors.textSecondary, marginTop: 1 },
  loyaltyToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.border + '60', borderRadius: BorderRadius.full,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  loyaltyToggleActive: { backgroundColor: colors.success + '15' },
  loyaltyToggleText: { ...Typography.caption, color: colors.textSecondary, fontWeight: '600' },
  loyaltyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.success + '15', borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 5, marginTop: 10, alignSelf: 'flex-start',
  },
  loyaltyBadgeText: { ...Typography.caption, color: colors.success, fontWeight: '600' },

  // Insurance provider picker
  pickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
    borderRadius: BorderRadius.sm, paddingHorizontal: 12, paddingVertical: 12,
    marginBottom: 12,
  },
  pickerValue: { ...Typography.body, color: colors.text },
  pickerPlaceholder: { ...Typography.body, color: colors.textLight },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  providerSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 20, paddingBottom: 40,
  },
  providerSheetTitle: { ...Typography.h3, color: colors.text, textAlign: 'center', marginBottom: 12 },
  providerOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  providerOptionActive: { backgroundColor: colors.primary + '08' },
  providerOptionText: { ...Typography.body, color: colors.text },
  });
}
