import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { authAPI } from '../../services/api';
import { showAlert } from '../../utils/webAlert';
import { Colors, Typography, Spacing, BorderRadius } from '../../utils/theme';

interface Props { navigation: any; route: any }

export const ResetPasswordScreen: React.FC<Props> = ({ navigation, route }) => {
  const { email, otp } = route.params as { email: string; otp: string };
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (newPassword.length < 6) errs.newPassword = 'Password must be at least 6 characters';
    if (confirmPassword !== newPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleReset = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await authAPI.resetPassword(email, otp, newPassword);
      setDone(true);
    } catch (e: any) {
      const detail = e.response?.data?.detail;
      showAlert('Error', typeof detail === 'string' ? detail : 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={72} color={Colors.success} />
          </View>
          <Text style={styles.successTitle}>Password Reset!</Text>
          <Text style={styles.successText}>
            Your password has been updated successfully. You can now sign in with your new password.
          </Text>
          <Button
            title="Back to Sign In"
            onPress={() => navigation.navigate('Login')}
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
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="key-outline" size={38} color={Colors.primary} />
          </View>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>New Password</Text>
          <Text style={styles.subtitle}>Choose a strong password for your account.</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="At least 6 characters"
            secureTextEntry
            error={errors.newPassword}
            leftIcon="lock-closed-outline"
          />
          <Input
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Repeat new password"
            secureTextEntry
            error={errors.confirmPassword}
            leftIcon="lock-closed-outline"
          />

          {/* Password strength hints */}
          <View style={styles.hints}>
            {[
              { ok: newPassword.length >= 6, label: 'At least 6 characters' },
              { ok: /[A-Z]/.test(newPassword), label: 'Uppercase letter' },
              { ok: /[0-9]/.test(newPassword), label: 'Number' },
            ].map((h) => (
              <View key={h.label} style={styles.hintRow}>
                <Ionicons
                  name={h.ok ? 'checkmark-circle' : 'ellipse-outline'}
                  size={14}
                  color={h.ok ? Colors.success : Colors.textLight}
                />
                <Text style={[styles.hintText, h.ok && styles.hintOk]}>{h.label}</Text>
              </View>
            ))}
          </View>

          <Button
            title="Reset Password"
            onPress={handleReset}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.resetBtn}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.lg },
  back: { marginTop: Spacing.sm, marginBottom: Spacing.lg },
  iconWrap: { alignItems: 'center', marginBottom: Spacing.lg },
  iconCircle: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  header: { marginBottom: Spacing.xl },
  title: { ...Typography.h1, color: Colors.text, marginBottom: 10 },
  subtitle: { ...Typography.body, color: Colors.textSecondary },
  form: { marginBottom: Spacing.xl },
  hints: { gap: 6, marginBottom: Spacing.lg, paddingHorizontal: 4 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  hintText: { ...Typography.caption, color: Colors.textLight },
  hintOk: { color: Colors.success },
  resetBtn: { marginTop: 4 },

  successWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.xl, gap: 16,
  },
  successIcon: { marginBottom: 8 },
  successTitle: { ...Typography.h1, color: Colors.text, textAlign: 'center' },
  successText: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
});
