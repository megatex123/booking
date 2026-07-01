import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Typography, Spacing, BorderRadius } from '../../utils/theme';
import { priceEstimatorAPI } from '../../services/api';
import { formatPrice } from '../../utils/helpers';
import { showAlert } from '../../utils/webAlert';

interface Props {
  navigation: any;
}

interface Symptom {
  id: string;
  label: string;
  icon: string;
  category: string;
}

interface SampleService {
  workshop_id: string;
  workshop_name: string;
  distance_km: number;
  service_name: string;
  price: number;
  duration_minutes: number;
}

interface Estimate {
  symptom_id: string;
  symptom_label: string;
  symptom_icon: string;
  category: string;
  min_price: number | null;
  max_price: number | null;
  avg_price: number | null;
  workshop_count: number;
  sample_services: SampleService[];
}

const CATEGORY_COLOR: Record<string, string> = {
  brake: '#EF4444',
  electrical: '#F59E0B',
  engine: '#8B5CF6',
  oil_change: '#10B981',
  tire: '#3B82F6',
  body: '#EC4899',
  other: '#6B7280',
};

// Default KL coords — used when location unavailable
const DEFAULT_LAT = 3.1390;
const DEFAULT_LNG = 101.6869;

export const PriceEstimatorScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [workshopsScanned, setWorkshopsScanned] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingSymptoms, setLoadingSymptoms] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    priceEstimatorAPI.getSymptoms()
      .then(r => setSymptoms(r.data))
      .catch(() => showAlert('Failed to load symptoms'))
      .finally(() => setLoadingSymptoms(false));
  }, []);

  const toggleSymptom = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    // Clear results when selection changes
    setEstimates([]);
  };

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const getEstimate = async () => {
    if (selected.size === 0) {
      showAlert('Please select at least one symptom.');
      return;
    }
    setLoading(true);
    setEstimates([]);
    try {
      const res = await priceEstimatorAPI.estimate(
        Array.from(selected),
        DEFAULT_LAT,
        DEFAULT_LNG,
        50,
      );
      setEstimates(res.data.estimates);
      setWorkshopsScanned(res.data.workshops_scanned);
    } catch {
      showAlert('Failed to get estimates. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const catColor = (cat: string) => CATEGORY_COLOR[cat] || '#6B7280';

  if (loadingSymptoms) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Price Estimator</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Intro */}
        <View style={styles.introBanner}>
          <Ionicons name="calculator-outline" size={22} color={colors.primary} />
          <Text style={styles.introText}>
            Select your car's symptoms and we'll estimate the repair cost from nearby workshops.
          </Text>
        </View>

        {/* Symptom picker */}
        <Text style={styles.sectionLabel}>What's wrong with your car?</Text>
        <View style={styles.chipGrid}>
          {symptoms.map(s => {
            const isSelected = selected.has(s.id);
            const color = catColor(s.category);
            return (
              <TouchableOpacity
                key={s.id}
                onPress={() => toggleSymptom(s.id)}
                style={[
                  styles.chip,
                  {
                    borderColor: isSelected ? color : colors.border,
                    backgroundColor: isSelected ? color + '18' : colors.surface,
                  },
                ]}
              >
                <Ionicons
                  name={s.icon as any}
                  size={14}
                  color={isSelected ? color : colors.textSecondary}
                />
                <Text style={[styles.chipText, { color: isSelected ? color : colors.text }]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected count + CTA */}
        {selected.size > 0 && (
          <View style={styles.ctaRow}>
            <Text style={styles.ctaCount}>{selected.size} symptom{selected.size > 1 ? 's' : ''} selected</Text>
            <TouchableOpacity
              style={[styles.estimateBtn, loading && { opacity: 0.6 }]}
              onPress={getEstimate}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Ionicons name="search" size={16} color="#fff" />
                    <Text style={styles.estimateBtnText}>Get Estimate</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Results */}
        {estimates.length > 0 && (
          <>
            <View style={styles.resultHeader}>
              <Text style={styles.sectionLabel}>Estimated Price Ranges</Text>
              <Text style={styles.scannedText}>
                Based on {workshopsScanned} nearby workshops
              </Text>
            </View>

            {estimates.map(est => {
              const color = catColor(est.category);
              const isExpanded = expanded.has(est.symptom_id);
              const hasData = est.min_price !== null;

              return (
                <View key={est.symptom_id} style={[styles.estimateCard, { borderLeftColor: color }]}>
                  <TouchableOpacity
                    style={styles.estimateCardHeader}
                    onPress={() => hasData && toggleExpanded(est.symptom_id)}
                    activeOpacity={hasData ? 0.7 : 1}
                  >
                    <View style={[styles.iconCircle, { backgroundColor: color + '18' }]}>
                      <Ionicons name={est.symptom_icon as any} size={18} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.estimateLabel}>{est.symptom_label}</Text>
                      {hasData ? (
                        <Text style={[styles.priceRange, { color }]}>
                          {formatPrice(est.min_price!)} – {formatPrice(est.max_price!)}
                          <Text style={styles.avgText}> · avg {formatPrice(est.avg_price!)}</Text>
                        </Text>
                      ) : (
                        <Text style={styles.noData}>No matching services found nearby</Text>
                      )}
                    </View>
                    {hasData && (
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={colors.textSecondary}
                      />
                    )}
                  </TouchableOpacity>

                  {hasData && (
                    <View style={styles.metaRow}>
                      <Ionicons name="business-outline" size={12} color={colors.textSecondary} />
                      <Text style={styles.metaText}>{est.workshop_count} workshop{est.workshop_count !== 1 ? 's' : ''} offer this service</Text>
                    </View>
                  )}

                  {/* Expanded sample services */}
                  {isExpanded && est.sample_services.length > 0 && (
                    <View style={styles.sampleList}>
                      <Text style={styles.sampleTitle}>Price breakdown by workshop</Text>
                      {est.sample_services.map((svc, i) => (
                        <View key={i} style={styles.sampleRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.sampleWorkshop} numberOfLines={1}>{svc.workshop_name}</Text>
                            <Text style={styles.sampleService} numberOfLines={1}>{svc.service_name}</Text>
                            <Text style={styles.sampleMeta}>~{svc.duration_minutes} min · {svc.distance_km} km away</Text>
                          </View>
                          <Text style={[styles.samplePrice, { color }]}>{formatPrice(svc.price)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Book Now CTA */}
            <TouchableOpacity
              style={styles.bookBtn}
              onPress={() => navigation.navigate('Home')}
            >
              <Ionicons name="calendar-outline" size={18} color="#fff" />
              <Text style={styles.bookBtnText}>Find & Book a Workshop</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { ...Typography.h3, color: colors.text },

    introBanner: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      margin: Spacing.lg, padding: Spacing.md,
      backgroundColor: colors.primary + '10', borderRadius: BorderRadius.md,
      borderWidth: 1, borderColor: colors.primary + '30',
    },
    introText: { ...Typography.bodySmall, color: colors.text, flex: 1, lineHeight: 20 },

    sectionLabel: { ...Typography.h3, color: colors.text, marginHorizontal: Spacing.lg, marginBottom: 12 },

    chipGrid: {
      flexDirection: 'row', flexWrap: 'wrap', gap: 8,
      paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg,
    },
    chip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: BorderRadius.full, borderWidth: 1.5,
    },
    chipText: { ...Typography.caption, fontWeight: '600' },

    ctaRow: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      marginHorizontal: Spacing.lg, marginBottom: Spacing.lg,
    },
    ctaCount: { ...Typography.bodySmall, color: colors.textSecondary },
    estimateBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.primary, borderRadius: BorderRadius.md,
      paddingHorizontal: 20, paddingVertical: 10,
    },
    estimateBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    resultHeader: { marginHorizontal: Spacing.lg, marginBottom: 4 },
    scannedText: { ...Typography.caption, color: colors.textSecondary, marginBottom: 12 },

    estimateCard: {
      marginHorizontal: Spacing.lg, marginBottom: 12,
      backgroundColor: colors.surface, borderRadius: BorderRadius.md,
      borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4,
      overflow: 'hidden',
    },
    estimateCardHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.md,
    },
    iconCircle: {
      width: 40, height: 40, borderRadius: 20,
      alignItems: 'center', justifyContent: 'center',
    },
    estimateLabel: { ...Typography.body, fontWeight: '700', color: colors.text, marginBottom: 2 },
    priceRange: { fontSize: 15, fontWeight: '800' },
    avgText: { fontSize: 12, fontWeight: '500', opacity: 0.8 },
    noData: { ...Typography.caption, color: colors.textSecondary, fontStyle: 'italic' },

    metaRow: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: Spacing.md, paddingBottom: 10,
    },
    metaText: { ...Typography.caption, color: colors.textSecondary },

    sampleList: {
      borderTopWidth: 1, borderTopColor: colors.border,
      paddingHorizontal: Spacing.md, paddingTop: 10, paddingBottom: 12,
      gap: 10,
    },
    sampleTitle: { ...Typography.caption, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 },
    sampleRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: colors.background, borderRadius: BorderRadius.sm,
      padding: 10, gap: 8,
    },
    sampleWorkshop: { ...Typography.bodySmall, fontWeight: '700', color: colors.text },
    sampleService: { ...Typography.caption, color: colors.textSecondary },
    sampleMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    samplePrice: { fontSize: 15, fontWeight: '800' },

    bookBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      marginHorizontal: Spacing.lg, marginTop: 8,
      backgroundColor: colors.primary, borderRadius: BorderRadius.md, paddingVertical: 14,
    },
    bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}
