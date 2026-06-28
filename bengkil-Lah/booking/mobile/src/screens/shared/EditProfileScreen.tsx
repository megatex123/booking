import React, { useState, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../store';
import { updateUser } from '../../store/authSlice';
import { api } from '../../services/api';
import { saveUser } from '../../services/storage';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';

interface Props { navigation: any }

export const EditProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await api.patch('/users/me', { name: name.trim(), phone: phone.trim() });
      const updated = res.data;
      dispatch(updateUser(updated));
      await saveUser({ ...user!, ...updated });
      navigation.goBack();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name[0]?.toUpperCase() || '?'}</Text>
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
          placeholderTextColor={colors.textLight}
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholder="e.g. 0123456789"
          placeholderTextColor={colors.textLight}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, styles.inputDisabled]}
          value={user?.email || ''}
          editable={false}
          placeholderTextColor={colors.textLight}
        />
        <Text style={styles.hint}>Email cannot be changed</Text>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>
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
  title: { ...Typography.h3, color: colors.text },
  body: { padding: Spacing.lg },
  avatarWrap: { alignItems: 'center', marginBottom: Spacing.xl },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 36, fontWeight: '700', color: '#fff' },
  label: { ...Typography.bodySmall, color: colors.textSecondary, marginBottom: 6, marginTop: Spacing.md },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: 12,
    ...Typography.body, color: colors.text,
  },
  inputDisabled: { backgroundColor: colors.divider, color: colors.textLight },
  hint: { ...Typography.caption, color: colors.textLight, marginTop: 4 },
  errorText: {
    color: colors.danger, ...Typography.bodySmall,
    backgroundColor: colors.danger + '15', padding: Spacing.md,
    borderRadius: BorderRadius.sm, marginBottom: Spacing.md,
  },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: Spacing.xl,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { ...Typography.button, color: '#fff' },
  });
}
