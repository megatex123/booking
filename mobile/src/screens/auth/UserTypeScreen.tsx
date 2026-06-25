import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { Colors, Typography, Spacing, BorderRadius } from '../../utils/theme';

interface Props {
  navigation: any;
}

export const UserTypeScreen: React.FC<Props> = ({ navigation }) => {
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
        <Ionicons name="arrow-back" size={24} color={Colors.text} />
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
                <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingHorizontal: Spacing.lg },
  back: { marginTop: Spacing.sm, marginBottom: Spacing.lg },
  title: { ...Typography.h2, color: Colors.text, marginBottom: 8 },
  subtitle: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.xl },
  options: { gap: 16, marginBottom: Spacing.xl },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    position: 'relative',
  },
  cardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },
  cardIcon: { fontSize: 36, marginBottom: 12 },
  cardTitle: { ...Typography.h3, color: Colors.text, marginBottom: 6 },
  selectedText: { color: Colors.primary },
  cardDesc: { ...Typography.body, color: Colors.textSecondary, lineHeight: 22 },
  checkmark: { position: 'absolute', top: 16, right: 16 },
  continueBtn: { marginBottom: 20 },
  loginLink: { ...Typography.body, color: Colors.textSecondary, textAlign: 'center' },
  loginLinkBold: { color: Colors.primary, fontWeight: '600' },
});
