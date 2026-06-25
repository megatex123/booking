import React, { useState, useMemo} from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';

interface Props {
  navigation: any;
}

export const UserTypeScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [selected, setSelected] = useState<'customer' | 'workshop' | null>(null);

  const options = [
    {
      type: 'customer' as const,
      icon: '🚗',
      title: 'Car Owner',
      description: 'Find workshops, book services, and track repairs.',
    },
    {
      type: 'workshop' as const,
      icon: '🔧',
      title: 'Workshop Vendor',
      description: 'List your services, manage bookings, and grow your business.',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>

      <Text style={styles.title}>Who are you?</Text>
      <Text style={styles.subtitle}>Choose your account type to get started</Text>

      <View style={styles.options}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.type}
            style={[styles.card, selected === opt.type && styles.cardSelected]}
            onPress={() => setSelected(opt.type)}
            activeOpacity={0.8}
          >
            <Text style={styles.cardIcon}>{opt.icon}</Text>
            <Text style={[styles.cardTitle, selected === opt.type && styles.selectedText]}>
              {opt.title}
            </Text>
            <Text style={styles.cardDesc}>{opt.description}</Text>
            {selected === opt.type && (
              <View style={styles.checkmark}>
                <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <Button
        title="Continue"
        onPress={() => navigation.navigate('Register', { role: selected })}
        fullWidth
        size="lg"
        disabled={!selected}
        style={styles.continueBtn}
      />

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.loginLink}>
          Already have an account? <Text style={styles.loginLinkBold}>Log In</Text>
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: Spacing.lg },
  back: { marginTop: Spacing.sm, marginBottom: Spacing.lg },
  title: { ...Typography.h2, color: colors.text, marginBottom: 8 },
  subtitle: { ...Typography.body, color: colors.textSecondary, marginBottom: Spacing.xl },
  options: { gap: 16, marginBottom: Spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    position: 'relative',
  },
  cardSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '08' },
  cardIcon: { fontSize: 36, marginBottom: 12 },
  cardTitle: { ...Typography.h3, color: colors.text, marginBottom: 6 },
  selectedText: { color: colors.primary },
  cardDesc: { ...Typography.body, color: colors.textSecondary, lineHeight: 22 },
  checkmark: { position: 'absolute', top: 16, right: 16 },
  continueBtn: { marginBottom: 20 },
  loginLink: { ...Typography.body, color: colors.textSecondary, textAlign: 'center' },
  loginLinkBold: { color: colors.primary, fontWeight: '600' },
  });
}
