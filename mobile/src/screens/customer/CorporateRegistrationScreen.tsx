import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { corporateAPI } from '../../services/api';
import { Colors, Typography, Spacing, BorderRadius } from '../../utils/theme';
import { showAlert } from '../../utils/webAlert';
import { Button } from '../../components/common/Button';

interface Props { navigation: any }

export const CorporateRegistrationScreen: React.FC<Props> = ({ navigation }) => {
  const [companyName, setCompanyName] = useState('');
  const [registrationNo, setRegistrationNo] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [monthlyLimit, setMonthlyLimit] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!companyName.trim()) errs.companyName = 'Company name is required';
    if (!registrationNo.trim()) errs.registrationNo = 'Registration number is required';
    if (!contactEmail.trim()) errs.contactEmail = 'Contact email is required';
    if (!contactPhone.trim()) errs.contactPhone = 'Contact phone is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await corporateAPI.register({
        company_name: companyName.trim(),
        registration_no: registrationNo.trim(),
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim(),
        monthly_limit: monthlyLimit ? parseFloat(monthlyLimit) : 0,
      });
      navigation.replace('CorporateManagement');
    } catch (e: any) {
      showAlert('Registration Failed', e?.response?.data?.detail || 'Could not register corporate account.');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { label: 'Company Name', value: companyName, onChange: setCompanyName, key: 'companyName', placeholder: 'e.g. Syarikat Maju Sdn Bhd' },
    { label: 'SSM Registration No.', value: registrationNo, onChange: setRegistrationNo, key: 'registrationNo', placeholder: 'e.g. 1234567-A' },
    { label: 'Contact Email', value: contactEmail, onChange: setContactEmail, key: 'contactEmail', placeholder: 'fleet@company.com', keyboard: 'email-address' as const, lower: true },
    { label: 'Contact Phone', value: contactPhone, onChange: setContactPhone, key: 'contactPhone', placeholder: '+60 12-345 6789', keyboard: 'phone-pad' as const },
    { label: 'Monthly Limit (RM) — optional', value: monthlyLimit, onChange: setMonthlyLimit, key: 'monthlyLimit', placeholder: 'Leave blank for unlimited', keyboard: 'numeric' as const },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Corporate Account</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="business" size={32} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Fleet & Corporate</Text>
          <Text style={styles.heroSub}>
            Register your company to manage a fleet of vehicles and drivers under one account.
            Monthly billing replaces per-booking payments.
          </Text>
        </View>

        <View style={styles.form}>
          {fields.map((f) => (
            <View key={f.key} style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{f.label}</Text>
              <TextInput
                style={[styles.fieldInput, errors[f.key] && styles.fieldInputError]}
                value={f.value}
                onChangeText={f.onChange}
                placeholder={f.placeholder}
                placeholderTextColor={Colors.textLight}
                keyboardType={f.keyboard}
                autoCapitalize={f.lower ? 'none' : 'words'}
              />
              {errors[f.key] && <Text style={styles.fieldError}>{errors[f.key]}</Text>}
            </View>
          ))}

          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.primary} />
            <Text style={styles.infoText}>
              You become the admin of this account. Add drivers and fleet vehicles after registration. Drivers are invited by their existing Bengkil Lah email.
            </Text>
          </View>

          <Button title="Register Corporate Account" onPress={handleRegister} loading={loading} fullWidth size="lg" />
        </View>
        <View style={{ height: 40 }} />
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
  title: { ...Typography.h3, color: Colors.text },
  hero: {
    alignItems: 'center', backgroundColor: '#0F172A',
    paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg,
  },
  heroIcon: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 8 },
  heroSub: { ...Typography.body, color: 'rgba(255,255,255,0.7)', textAlign: 'center', lineHeight: 22 },
  form: { padding: Spacing.lg },
  fieldGroup: { marginBottom: Spacing.md },
  fieldLabel: { ...Typography.caption, fontWeight: '600', color: Colors.textSecondary, marginBottom: 6 },
  fieldInput: {
    backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.sm, paddingHorizontal: 12, paddingVertical: 11,
    ...Typography.body, color: Colors.text,
  },
  fieldInputError: { borderColor: Colors.danger },
  fieldError: { ...Typography.caption, color: Colors.danger, marginTop: 4 },
  infoBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: Colors.primary + '10', borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.lg,
  },
  infoText: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1, lineHeight: 20 },
});
