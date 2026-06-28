import React, { useState, useMemo} from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { authAPI } from '../../services/api';
import { showAlert } from '../../utils/webAlert';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';

interface Props { navigation: any }

export const ChangePasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!currentPassword) errs.currentPassword = 'Current password is required';
    if (newPassword.length < 6) errs.newPassword = 'Password must be at least 6 characters';
    if (newPassword === currentPassword) errs.newPassword = 'New password must differ from current';
    if (confirmPassword !== newPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleChange = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      setDone(true);
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      showAlert('Error', typeof detail === 'string' ? detail : 'Failed to change password.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="shield-checkmark" size={72} color={colors.success} />
          </View>
          <Text style={styles.successTitle}>Password Changed!</Text>
          <Text style={styles.successText}>
            Your password has been updated. Keep it safe and don't share it with anyone.
          </Text>
          <Button
            title="Done"
            onPress={() => navigation.goBack()}
            fullWidth
            size="lg"
            style={{ marginTop: Spacing.xl }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
      >
        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed-outline" size={32} color={colors.primary} />
          </View>
          <Text style={styles.subtitle}>Enter your current password, then choose a new one.</Text>
        </View>

        <View style={styles.section}>
          <Input
            label="Current Password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Your current password"
            secureTextEntry
            error={errors.currentPassword}
            leftIcon="lock-closed-outline"
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Input
            label="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="At least 6 characters"
            secureTextEntry
            error={errors.newPassword}
            leftIcon="lock-open-outline"
          />
          <Input
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repeat new password"
            secureTextEntry
            error={errors.confirmPassword}
            leftIcon="lock-open-outline"
          />

          {/* Strength hints */}
          {newPassword.length > 0 && (
            <View style={styles.hints}>
              {[
                { ok: newPassword.length >= 6, label: 'At least 6 characters' },
                { ok: /[A-Z]/.test(newPassword), label: 'Uppercase letter' },
                { ok: /[0-9]/.test(newPassword), label: 'Contains a number' },
                { ok: newPassword !== currentPassword, label: 'Different from current' },
              ].map((h) => (
                <View key={h.label} style={styles.hintRow}>
                  <Ionicons
                    name={h.ok ? 'checkmark-circle' : 'ellipse-outline'}
                    size={14}
                    color={h.ok ? colors.success : colors.textLight}
                  />
                  <Text style={[styles.hintText, h.ok && styles.hintOk]}>{h.label}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Button
          title="Update Password"
          onPress={handleChange}
          loading={loading}
          fullWidth
          size="lg"
          style={styles.updateBtn}
        />
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
  body: { padding: Spacing.lg },

  iconWrap: { alignItems: 'center', marginBottom: Spacing.xl, gap: 12 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  subtitle: { ...Typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  section: { marginBottom: Spacing.md },
  divider: {
    height: 1, backgroundColor: colors.border,
    marginHorizontal: -Spacing.lg, marginBottom: Spacing.lg,
  },

  hints: { gap: 6, marginBottom: Spacing.sm, paddingHorizontal: 4 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  hintText: { ...Typography.caption, color: colors.textLight },
  hintOk: { color: colors.success },

  updateBtn: { marginTop: Spacing.md },

  successWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.xl, gap: 16,
  },
  successIcon: { marginBottom: 8 },
  successTitle: { ...Typography.h1, color: colors.text, textAlign: 'center' },
  successText: { ...Typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  });
}
