import React, { useState, useMemo} from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { showAlert } from '../../utils/webAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { useAppDispatch, useAppSelector } from '../../store';
import { registerCustomer, registerWorkshop } from '../../store/authSlice';
import { Colors, Typography, Spacing, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  navigation: any;
  route: any;
}

export const RegisterScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const role = route.params?.role || 'customer';
  const dispatch = useAppDispatch();
  const { loading } = useAppSelector((s) => s.auth);

  const [form, setForm] = useState({
    name: '', email: '', password: '', confirmPassword: '', phone: '', address: '',
    workshop_name: '', workshop_address: '', latitude: '', longitude: '', description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: string, val: string) => setForm((f) => ({ ...f, [key]: val }));

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    if (!form.password || form.password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (!form.phone.trim()) errs.phone = 'Phone is required';
    if (role === 'workshop') {
      if (!form.workshop_name.trim()) errs.workshop_name = 'Workshop name is required';
      if (!form.workshop_address.trim()) errs.workshop_address = 'Address is required';
      if (!form.latitude || isNaN(parseFloat(form.latitude))) errs.latitude = 'Valid latitude required';
      if (!form.longitude || isNaN(parseFloat(form.longitude))) errs.longitude = 'Valid longitude required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    const data: any = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      password: form.password,
      phone: form.phone.trim(),
      ...(role === 'customer' && form.address.trim() ? { address: form.address.trim() } : {}),
    };
    if (role === 'workshop') {
      data.workshop_name = form.workshop_name.trim();
      data.workshop_address = form.workshop_address.trim();
      data.latitude = parseFloat(form.latitude);
      data.longitude = parseFloat(form.longitude);
      data.description = form.description.trim();
    }
    const action = role === 'workshop' ? registerWorkshop(data) : registerCustomer(data);
    const result = await dispatch(action);
    if (result.meta.requestStatus === 'rejected') {
      showAlert('Registration Failed', result.payload as string);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>
            {role === 'workshop' ? 'Register Workshop' : 'Create Account'}
          </Text>
          <Text style={styles.subtitle}>
            {role === 'workshop' ? 'Set up your workshop profile' : 'Join as a car owner'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Info</Text>
          <Input label="Full Name" value={form.name} onChangeText={(v) => set('name', v)}
            placeholder="John Smith" autoCapitalize="words" error={errors.name} leftIcon="person-outline" />
          <Input label="Email" value={form.email} onChangeText={(v) => set('email', v)}
            placeholder="your@email.com" keyboardType="email-address" error={errors.email} leftIcon="mail-outline" />
          <Input label="Phone Number" value={form.phone} onChangeText={(v) => set('phone', v)}
            placeholder="+60123456789" keyboardType="phone-pad" error={errors.phone} leftIcon="call-outline" />
          {role === 'customer' && (
            <Input label="Address (optional)" value={form.address} onChangeText={(v) => set('address', v)}
              placeholder="e.g. No. 12, Jalan Bukit, Kuala Lumpur" autoCapitalize="words"
              leftIcon="location-outline" multiline numberOfLines={2} />
          )}
          <Input label="Password" value={form.password} onChangeText={(v) => set('password', v)}
            placeholder="At least 6 characters" secureTextEntry error={errors.password} leftIcon="lock-closed-outline" />
          <Input label="Confirm Password" value={form.confirmPassword} onChangeText={(v) => set('confirmPassword', v)}
            placeholder="Repeat password" secureTextEntry error={errors.confirmPassword} leftIcon="lock-closed-outline" />
        </View>

        {role === 'workshop' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Workshop Info</Text>
            <Input label="Workshop Name" value={form.workshop_name} onChangeText={(v) => set('workshop_name', v)}
              placeholder="My Auto Workshop" autoCapitalize="words" error={errors.workshop_name} leftIcon="business-outline" />
            <Input label="Address" value={form.workshop_address} onChangeText={(v) => set('workshop_address', v)}
              placeholder="123 Main St, Kuala Lumpur" autoCapitalize="words" error={errors.workshop_address}
              leftIcon="location-outline" multiline numberOfLines={2} />
            <Input label="Description (optional)" value={form.description} onChangeText={(v) => set('description', v)}
              placeholder="Tell customers about your workshop..." autoCapitalize="sentences"
              multiline numberOfLines={3} />
            <View style={styles.row}>
              <View style={styles.half}>
                <Input label="Latitude" value={form.latitude} onChangeText={(v) => set('latitude', v)}
                  placeholder="3.1390" keyboardType="decimal-pad" error={errors.latitude} />
              </View>
              <View style={styles.half}>
                <Input label="Longitude" value={form.longitude} onChangeText={(v) => set('longitude', v)}
                  placeholder="101.6869" keyboardType="decimal-pad" error={errors.longitude} />
              </View>
            </View>
            <Text style={styles.coordHint}>
              Tip: Find your coordinates on Google Maps by long-pressing your workshop location.
            </Text>
          </View>
        )}

        <Button
          title={role === 'workshop' ? 'Register Workshop' : 'Create Account'}
          onPress={handleRegister}
          loading={loading}
          fullWidth
          size="lg"
          style={styles.registerBtn}
        />

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginLink}>
            Already have an account? <Text style={styles.loginLinkBold}>Log In</Text>
          </Text>
        </TouchableOpacity>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: Spacing.lg },
  back: { marginTop: Spacing.sm, marginBottom: Spacing.lg },
  header: { marginBottom: Spacing.xl },
  title: { ...Typography.h1, color: colors.text, marginBottom: 8 },
  subtitle: { ...Typography.body, color: colors.textSecondary },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.h3, color: colors.text, marginBottom: Spacing.md },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  coordHint: { ...Typography.caption, color: colors.textSecondary, marginTop: -8, marginBottom: 12, lineHeight: 18 },
  registerBtn: { marginBottom: 20 },
  loginLink: { ...Typography.body, color: colors.textSecondary, textAlign: 'center' },
  loginLinkBold: { color: colors.primary, fontWeight: '600' },
  });
}
