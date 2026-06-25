import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { authAPI } from '../../services/api';
import { showAlert } from '../../utils/webAlert';
import { Colors, Typography, Spacing, BorderRadius } from '../../utils/theme';

interface Props { navigation: any; route: any }

const OTP_LENGTH = 6;

export const VerifyOTPScreen: React.FC<Props> = ({ navigation, route }) => {
  const { email, demoOtp } = route.params as { email: string; demoOtp: string | null };
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRef = useRef<TextInput>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleVerify = async () => {
    if (otp.length < OTP_LENGTH) { shake(); return; }
    setLoading(true);
    try {
      // Verify by attempting reset with a placeholder — actual reset happens on next screen
      // We just check if OTP is correct here by passing it forward
      navigation.navigate('ResetPassword', { email, otp });
    } catch {
      shake();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      const res = await authAPI.forgotPassword(email);
      setOtp('');
      setCountdown(60);
      if (res.data.demo_otp) {
        navigation.setParams({ demoOtp: res.data.demo_otp });
      }
    } catch (e: any) {
      showAlert('Error', 'Failed to resend OTP');
    } finally {
      setResending(false);
    }
  };

  const digits = otp.split('').concat(Array(OTP_LENGTH - otp.length).fill(''));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail-unread-outline" size={38} color={Colors.primary} />
          </View>
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.subtitle}>
            We sent a 6-digit code to{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>
        </View>

        {/* Demo OTP banner */}
        {demoOtp && (
          <View style={styles.demoBanner}>
            <Ionicons name="information-circle-outline" size={16} color="#1565C0" />
            <Text style={styles.demoText}>
              Demo mode — your OTP is: <Text style={styles.demoOtp}>{demoOtp}</Text>
            </Text>
          </View>
        )}

        {/* OTP digit display */}
        <Animated.View style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
          {digits.map((d, i) => (
            <View
              key={i}
              style={[
                styles.otpBox,
                i === otp.length && styles.otpBoxActive,
                d !== '' && styles.otpBoxFilled,
              ]}
            >
              <Text style={styles.otpDigit}>{d}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Hidden real input */}
        <TextInput
          ref={inputRef}
          value={otp}
          onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, OTP_LENGTH))}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          style={styles.hiddenInput}
          caretHidden
        />

        <TouchableOpacity style={styles.otpTapTarget} onPress={() => inputRef.current?.focus()} />

        <Button
          title="Verify OTP"
          onPress={handleVerify}
          loading={loading}
          disabled={otp.length < OTP_LENGTH}
          fullWidth
          size="lg"
          style={styles.verifyBtn}
        />

        <View style={styles.resendRow}>
          <Text style={styles.resendLabel}>Didn't receive the code? </Text>
          {countdown > 0 ? (
            <Text style={styles.countdown}>Resend in {countdown}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={resending}>
              <Text style={styles.resendLink}>{resending ? 'Sending…' : 'Resend OTP'}</Text>
            </TouchableOpacity>
          )}
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
  header: { marginBottom: Spacing.lg, alignItems: 'center' },
  title: { ...Typography.h1, color: Colors.text, marginBottom: 10, textAlign: 'center' },
  subtitle: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  emailHighlight: { color: Colors.text, fontWeight: '600' },

  demoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#E3F2FD', borderRadius: BorderRadius.md,
    padding: 12, marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: '#90CAF9',
  },
  demoText: { ...Typography.caption, color: '#1565C0', flex: 1 },
  demoOtp: { fontWeight: '800', letterSpacing: 2 },

  otpRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 10,
    marginBottom: Spacing.md,
  },
  otpBox: {
    width: 46, height: 56, borderRadius: BorderRadius.md,
    borderWidth: 2, borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  otpBoxActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },
  otpBoxFilled: { borderColor: Colors.primary },
  otpDigit: { ...Typography.h2, color: Colors.text },

  hiddenInput: { position: 'absolute', opacity: 0, height: 1 },
  otpTapTarget: { height: 56, marginBottom: Spacing.lg },

  verifyBtn: { marginBottom: Spacing.lg },
  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  resendLabel: { ...Typography.body, color: Colors.textSecondary },
  countdown: { ...Typography.body, color: Colors.textLight },
  resendLink: { ...Typography.body, color: Colors.primary, fontWeight: '600' },
});
