import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';

interface Props { navigation: any }

const SECTIONS = [
  {
    title: '1. Information We Collect',
    body: 'We collect information you provide when registering (name, email, phone number) and information generated through app use (booking history, location data, chat messages, reviews).',
  },
  {
    title: '2. How We Use Your Information',
    body: 'We use your information to provide and improve our services, match you with nearby workshops, process payments, send booking notifications, and respond to support requests.',
  },
  {
    title: '3. Location Data',
    body: 'We access your device location only when the app is open and only to show nearby workshops. We do not track your location in the background.',
  },
  {
    title: '4. Data Sharing',
    body: 'We share your name, phone number, and vehicle details with the workshop you book with. We do not sell your personal data to third parties.',
  },
  {
    title: '5. Data Security',
    body: 'Your password is encrypted using industry-standard bcrypt hashing. All data is transmitted over HTTPS. We retain your data for as long as your account is active.',
  },
  {
    title: '6. Your Rights',
    body: 'You may request to access, correct, or delete your personal data at any time by contacting us at privacy@bengkillah.com. Account deletion removes all personal data within 30 days.',
  },
  {
    title: '7. Cookies & Analytics',
    body: 'We use local storage for session management. We do not use third-party analytics or advertising cookies.',
  },
  {
    title: '8. Changes to This Policy',
    body: 'We may update this policy from time to time. You will be notified of significant changes via the app. Continued use after changes constitutes acceptance.',
  },
  {
    title: '9. Contact Us',
    body: 'For privacy-related questions, email privacy@bengkillah.com or write to Bengkil Lah Sdn Bhd, Kuala Lumpur, Malaysia.',
  },
];

export const PrivacyPolicyScreen: React.FC<Props> = ({ navigation }) => () => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
  <SafeAreaView style={styles.container}>
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={24} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.title}>Privacy Policy</Text>
      <View style={{ width: 40 }} />
    </View>

    <ScrollView contentContainerStyle={styles.body}>
      <Text style={styles.updated}>Last updated: 1 June 2026</Text>
      <Text style={styles.intro}>
        Bengkil Lah ("we", "our", "us") is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your information when you use our car service booking platform.
      </Text>

      {SECTIONS.map((s) => (
        <View key={s.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{s.title}</Text>
          <Text style={styles.sectionBody}>{s.body}</Text>
        </View>
      ))}

      <View style={{ height: 32 }} />
    </ScrollView>
  </SafeAreaView>
  );
}

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
  updated: { ...Typography.caption, color: colors.textLight, marginBottom: Spacing.md },
  intro: { ...Typography.body, color: colors.textSecondary, lineHeight: 24, marginBottom: Spacing.lg },
  section: { marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.body, fontWeight: '700', color: colors.text, marginBottom: 6 },
  sectionBody: { ...Typography.body, color: colors.textSecondary, lineHeight: 24 },
  });
}
