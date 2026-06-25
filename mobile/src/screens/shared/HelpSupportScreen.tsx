import React, { useState, useMemo} from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';

interface Props { navigation: any }

const FAQS = [
  { q: 'How do I book a workshop?', a: 'Go to the Explore tab, browse nearby workshops, tap on one you like, select a service and choose your preferred date and time, then confirm your booking.' },
  { q: 'Can I cancel a booking?', a: 'Yes. Go to your Bookings tab, open the booking you want to cancel, and tap "Cancel Booking". Cancellations are free if done before the workshop confirms.' },
  { q: 'How does payment work?', a: 'You only pay after the workshop completes your service and marks it done. Payment is processed securely through the app.' },
  { q: 'What if the workshop rejects my booking?', a: 'You will be notified immediately. The slot is freed and you can book another workshop or time slot.' },
  { q: 'How do I chat with the workshop?', a: 'Once a booking is made, open the booking detail and tap the chat icon to message the workshop directly.' },
  { q: 'How are ratings calculated?', a: 'Workshop ratings are the average of all customer reviews. Each review is submitted after a completed and paid service.' },
];

export const HelpSupportScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.contactCard}>
          <Ionicons name="mail-outline" size={28} color={colors.primary} />
          <View style={styles.contactInfo}>
            <Text style={styles.contactTitle}>Email Support</Text>
            <Text style={styles.contactSub}>support@bengkillah.com</Text>
          </View>
        </View>

        <View style={styles.contactCard}>
          <Ionicons name="logo-whatsapp" size={28} color={colors.success} />
          <View style={styles.contactInfo}>
            <Text style={styles.contactTitle}>WhatsApp</Text>
            <Text style={styles.contactSub}>+60 12-345 6789 (Mon–Fri, 9AM–6PM)</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>

        {FAQS.map((faq, i) => (
          <TouchableOpacity
            key={i}
            style={styles.faqItem}
            onPress={() => setExpanded(expanded === i ? null : i)}
            activeOpacity={0.7}
          >
            <View style={styles.faqRow}>
              <Text style={styles.faqQ}>{faq.q}</Text>
              <Ionicons
                name={expanded === i ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textSecondary}
              />
            </View>
            {expanded === i && <Text style={styles.faqA}>{faq.a}</Text>}
          </TouchableOpacity>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Bengkil Lah v1.0.0</Text>
          <Text style={styles.footerText}>© 2026 Bengkil Lah. All rights reserved.</Text>
        </View>
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
  contactCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  contactInfo: { marginLeft: Spacing.md },
  contactTitle: { ...Typography.body, fontWeight: '600', color: colors.text },
  contactSub: { ...Typography.bodySmall, color: colors.textSecondary, marginTop: 2 },
  sectionTitle: { ...Typography.h3, color: colors.text, marginTop: Spacing.lg, marginBottom: Spacing.md },
  faqItem: {
    backgroundColor: colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  faqRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  faqQ: { ...Typography.body, fontWeight: '600', color: colors.text, flex: 1, marginRight: 8 },
  faqA: { ...Typography.body, color: colors.textSecondary, marginTop: Spacing.sm, lineHeight: 22 },
  footer: { alignItems: 'center', marginTop: Spacing.xxl, gap: 4 },
  footerText: { ...Typography.caption, color: colors.textLight },
  });
}
