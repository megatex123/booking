import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../utils/theme';

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
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.contactCard}>
          <Ionicons name="mail-outline" size={28} color={Colors.primary} />
          <View style={styles.contactInfo}>
            <Text style={styles.contactTitle}>Email Support</Text>
            <Text style={styles.contactSub}>support@bengkillah.com</Text>
          </View>
        </View>

        <View style={styles.contactCard}>
          <Ionicons name="logo-whatsapp" size={28} color={Colors.success} />
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
                color={Colors.textSecondary}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { ...Typography.h3, color: Colors.text },
  body: { padding: Spacing.lg },
  contactCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  contactInfo: { marginLeft: Spacing.md },
  contactTitle: { ...Typography.body, fontWeight: '600', color: Colors.text },
  contactSub: { ...Typography.bodySmall, color: Colors.textSecondary, marginTop: 2 },
  sectionTitle: { ...Typography.h3, color: Colors.text, marginTop: Spacing.lg, marginBottom: Spacing.md },
  faqItem: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  faqRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  faqQ: { ...Typography.body, fontWeight: '600', color: Colors.text, flex: 1, marginRight: 8 },
  faqA: { ...Typography.body, color: Colors.textSecondary, marginTop: Spacing.sm, lineHeight: 22 },
  footer: { alignItems: 'center', marginTop: Spacing.xxl, gap: 4 },
  footerText: { ...Typography.caption, color: Colors.textLight },
});
