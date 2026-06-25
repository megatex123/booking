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

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  const handleSend = async () => {
    if (!email.trim()) { setEmailError('Email is required'); return; }
    if (!/\S+@\S+\.\S+/.test(email)) { setEmailError('Enter a valid email'); return; }
    setEmailError('');
    setLoading(true);
    try {
      const res = await authAPI.forgotPassword(email.trim().toLowerCase());
      navigation.navigate('VerifyOTP', {
        email: email.trim().toLowerCase(),
        demoOtp: res.data.demo_otp,
      });
    } catch (e: any) {
      showAlert('Error', e.response?.data?.detail || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-open-outline" size={38} color={colors.primary} />
          </View>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.subtitle}>
            Enter your registered email and we'll send you a one-time code to reset your password.
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            keyboardType="email-address"
            error={emailError}
            leftIcon="mail-outline"
          />

          <Button
            title="Send OTP"
            onPress={handleSend}
            loading={loading}
            fullWidth
            size="lg"
            style={styles.sendBtn}
          />
        </View>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backToLogin}>
            Remember your password? <Text style={styles.backToLoginBold}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: Spacing.lg },
  back: { marginTop: Spacing.sm, marginBottom: Spacing.lg },
  iconWrap: { alignItems: 'center', marginBottom: Spacing.lg },
  iconCircle: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: colors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  header: { marginBottom: Spacing.xl },
  title: { ...Typography.h1, color: colors.text, marginBottom: 10 },
  subtitle: { ...Typography.body, color: colors.textSecondary, lineHeight: 22 },
  form: { marginBottom: Spacing.xl },
  sendBtn: { marginTop: 8 },
  backToLogin: { ...Typography.body, color: colors.textSecondary, textAlign: 'center' },
  backToLoginBold: { color: colors.primary, fontWeight: '600' },
  });
}
