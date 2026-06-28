import React, { useEffect, useState, useMemo} from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { workshopAPI } from '../../services/api';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { showAlert } from '../../utils/webAlert';
import { Button } from '../../components/common/Button';

interface Props { navigation: any }

const PROVIDERS = [
  { value: 'takaful', label: 'Takaful Malaysia' },
  { value: 'etiqa', label: 'Etiqa Insurance' },
  { value: 'allianz', label: 'Allianz' },
  { value: 'axa', label: 'AXA Affin' },
  { value: 'msig', label: 'MSIG' },
  { value: 'berjaya_sompo', label: 'Berjaya Sompo' },
  { value: 'zurich', label: 'Zurich' },
  { value: 'lonpac', label: 'Lonpac' },
];

export const WorkshopPanelSettingsScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [isPanel, setIsPanel] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    workshopAPI.getMyWorkshop().then((r) => {
      setIsPanel(r.data.is_panel_workshop || false);
      setSelectedProviders(r.data.panel_providers || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleProvider = (value: string) => {
    setSelectedProviders((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleSave = async () => {
    if (isPanel && selectedProviders.length === 0) {
      showAlert('No Providers', 'Please select at least one insurance provider.');
      return;
    }
    setSaving(true);
    try {
      await workshopAPI.updatePanel({ is_panel_workshop: isPanel, panel_providers: isPanel ? selectedProviders : [] });
      showAlert('Saved', 'Panel workshop settings updated.');
      navigation.goBack();
    } catch {
      showAlert('Error', 'Could not save panel settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Panel Workshop Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>Panel Workshop</Text>
              <Text style={styles.toggleSub}>Accept insurance claim bookings from panel insurance providers.</Text>
            </View>
            <Switch
              value={isPanel}
              onValueChange={setIsPanel}
              trackColor={{ true: colors.primary, false: colors.border }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {isPanel && (
          <>
            <Text style={styles.sectionTitle}>Accepted Providers</Text>
            {PROVIDERS.map((p) => {
              const active = selectedProviders.includes(p.value);
              return (
                <TouchableOpacity
                  key={p.value}
                  style={[styles.providerCard, active && styles.providerCardActive]}
                  onPress={() => toggleProvider(p.value)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.checkbox, active && styles.checkboxActive]}>
                    {active && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <View style={[styles.providerBadge, { backgroundColor: active ? colors.primary + '15' : colors.surface }]}>
                    <Ionicons name="shield-checkmark" size={18} color={active ? colors.primary : colors.textLight} />
                  </View>
                  <Text style={[styles.providerLabel, active && { color: colors.primary, fontWeight: '700' }]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.infoText}>
                Your workshop will appear in "Panel Workshop" filtered searches for the providers you select. Customers with those insurers can submit direct claim bookings to you.
              </Text>
            </View>
          </>
        )}

        <View style={styles.saveSection}>
          <Button title="Save Settings" onPress={handleSave} loading={saving} fullWidth />
        </View>
        <View style={{ height: 40 }} />
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
  card: {
    backgroundColor: colors.surface, margin: Spacing.lg,
    borderRadius: BorderRadius.md, padding: Spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  toggleTitle: { ...Typography.body, color: colors.text, fontWeight: '600' },
  toggleSub: { ...Typography.bodySmall, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
  sectionTitle: { ...Typography.h3, color: colors.text, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  providerCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, marginHorizontal: Spacing.lg, marginBottom: 10,
    borderRadius: BorderRadius.md, padding: Spacing.md,
    borderWidth: 1.5, borderColor: colors.border,
  },
  providerCardActive: { borderColor: colors.primary, backgroundColor: colors.primary + '05' },
  checkbox: {
    width: 22, height: 22, borderRadius: 4,
    borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  providerBadge: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  providerLabel: { ...Typography.body, color: colors.text, flex: 1 },
  infoBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: colors.primary + '10', borderRadius: BorderRadius.md,
    padding: Spacing.md, margin: Spacing.lg,
  },
  infoText: { ...Typography.bodySmall, color: colors.textSecondary, flex: 1, lineHeight: 20 },
  saveSection: { paddingHorizontal: Spacing.lg },
  });
}
