import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../store';
import { removeFromCompare, clearCompare } from '../../store/compareSlice';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { Workshop } from '../../types';

interface Props { navigation: any }

const CATEGORIES: Record<string, string> = {
  oil_change:  'Oil Change',
  engine:      'Engine',
  mechanical:  'Mechanical',
  tire:        'Tyres',
  brake:       'Brakes',
  suspension:  'Suspension',
  body:        'Body Work',
  electrical:  'Electrical',
  performance: 'Performance',
  accessories: 'Accessories',
  detailing:   'Detailing',
  other:       'Other',
};

function minPrice(w: Workshop, category?: string): string {
  const svcs = category
    ? w.services.filter((s) => s.category === category && s.is_active !== false)
    : w.services.filter((s) => s.is_active !== false);
  if (svcs.length === 0) return '—';
  return `RM ${Math.min(...svcs.map((s) => s.price)).toFixed(0)}`;
}

function cheapestService(w: Workshop, category: string): string {
  const svcs = w.services.filter((s) => s.category === category && s.is_active !== false);
  if (svcs.length === 0) return '—';
  const best = svcs.reduce((a, b) => (a.price < b.price ? a : b));
  return `RM ${best.price.toFixed(0)}\n${best.name}`;
}

export const CompareScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const items = useAppSelector((s) => s.compare.items);

  if (items.length < 2) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Compare Workshops</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.emptyWrap}>
          <Ionicons name="git-compare-outline" size={64} color={colors.textLight} />
          <Text style={styles.emptyTitle}>Nothing to compare</Text>
          <Text style={styles.emptyBody}>Add 2–3 workshops from the Explore tab to compare them here.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // All service categories offered by at least one selected workshop
  const sharedCategories = [...new Set(
    items.flatMap((w) => w.services.filter((s) => s.is_active !== false).map((s) => s.category))
  )].sort();

  const N = items.length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Compare ({N})</Text>
        <TouchableOpacity onPress={() => { dispatch(clearCompare()); navigation.goBack(); }} style={styles.clearBtn}>
          <Text style={styles.clearBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Workshop name columns header */}
        <View style={[styles.row, styles.workshopRow]}>
          <View style={styles.labelCell} />
          {items.map((w) => (
            <View key={w.id} style={styles.wsHeader}>
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={() => dispatch(removeFromCompare(w.id))}
              >
                <Ionicons name="close-circle" size={16} color={colors.textLight} />
              </TouchableOpacity>
              <Text style={styles.wsName} numberOfLines={2}>{w.workshop_name}</Text>
              <View style={[styles.statusPill, !w.is_open && styles.statusPillClosed]}>
                <View style={[styles.statusDot, !w.is_open && styles.statusDotClosed]} />
                <Text style={[styles.statusPillText, !w.is_open && styles.statusPillTextClosed]}>
                  {w.is_open ? 'Open' : 'Closed'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Overview rows ── */}
        <SectionLabel label="OVERVIEW" />

        <DataRow
          label="Rating"
          cells={items.map((w) => (
            <View style={styles.ratingCell} key={w.id}>
              <Ionicons name="star" size={13} color="#FBBC04" />
              <Text style={styles.ratingVal}>{w.rating.toFixed(1)}</Text>
              <Text style={styles.ratingCount}>({w.total_reviews})</Text>
            </View>
          ))}
          alt
        />

        <DataRow
          label="Distance"
          cells={items.map((w) => (
            <Text key={w.id} style={styles.cellText}>
              {w.distance_km != null ? `${w.distance_km.toFixed(1)} km` : '—'}
            </Text>
          ))}
        />

        <DataRow
          label="Min. Price"
          cells={items.map((w) => (
            <Text key={w.id} style={[styles.cellText, styles.cellBold]}>
              {minPrice(w)}
            </Text>
          ))}
          alt
          highlight
        />

        <DataRow
          label="Services"
          cells={items.map((w) => (
            <Text key={w.id} style={styles.cellText}>
              {w.services.filter((s) => s.is_active !== false).length} offered
            </Text>
          ))}
        />

        {/* ── Per-category price rows ── */}
        {sharedCategories.length > 0 && (
          <>
            <SectionLabel label="SERVICES & PRICING" />
            {sharedCategories.map((cat, i) => (
              <DataRow
                key={cat}
                label={CATEGORIES[cat] ?? cat}
                cells={items.map((w) => {
                  const text = cheapestService(w, cat);
                  const has = text !== '—';
                  return (
                    <Text
                      key={w.id}
                      style={[styles.cellText, has ? styles.cellPrice : styles.cellNA]}
                      numberOfLines={3}
                    >
                      {text}
                    </Text>
                  );
                })}
                alt={i % 2 === 0}
              />
            ))}
          </>
        )}

        {/* ── Book buttons ── */}
        <View style={[styles.row, { paddingVertical: 16 }]}>
          <View style={styles.labelCell} />
          {items.map((w) => (
            <View key={w.id} style={styles.bookCell}>
              <TouchableOpacity
                style={styles.bookBtn}
                onPress={() => navigation.navigate('WorkshopDetail', { workshop: w })}
                activeOpacity={0.85}
              >
                <Text style={styles.bookBtnText}>Book</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

/* ── Small presenter components ────────────────────────────────────────── */

function SectionLabel({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.primary + '12', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.primary + '20' }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, letterSpacing: 0.8 }}>{label}</Text>
    </View>
  );
}

function DataRow({
  label, cells, alt = false, highlight = false,
}: {
  label: string;
  cells: React.ReactNode[];
  alt?: boolean;
  highlight?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.row, alt && styles.rowAlt]}>
      <Text style={[styles.labelCell, highlight && styles.labelHighlight]}>{label}</Text>
      {cells.map((cell, i) => (
        <View key={i} style={styles.dataCell}>
          {cell}
        </View>
      ))}
    </View>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { ...Typography.h3, color: colors.text },
  clearBtn: { paddingHorizontal: 8 },
  clearBtnText: { ...Typography.bodySmall, color: colors.danger, fontWeight: '600' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: 12 },
  emptyTitle: { ...Typography.h3, color: colors.text },
  emptyBody: { ...Typography.body, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  /* Table layout */
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 48,
    alignItems: 'center',
  },
  rowAlt: { backgroundColor: colors.surface },

  workshopRow: {
    alignItems: 'flex-start',
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary + '30',
  },

  labelCell: {
    width: 94,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...Typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    flexShrink: 0,
  },
  labelHighlight: { color: colors.primary, fontWeight: '700' },

  dataCell: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
  },

  cellText: { ...Typography.bodySmall, color: colors.text, textAlign: 'center' },
  cellBold: { fontWeight: '700', color: colors.primary, fontSize: 14 },
  cellPrice: { color: colors.primary, fontWeight: '600', textAlign: 'center' },
  cellNA: { color: colors.textLight, textAlign: 'center' },

  ratingCell: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingVal: { ...Typography.bodySmall, fontWeight: '700', color: colors.text },
  ratingCount: { ...Typography.caption, color: colors.textSecondary },

  wsHeader: {
    flex: 1,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.border,
    gap: 6,
  },
  removeBtn: { alignSelf: 'flex-end' },
  wsName: {
    ...Typography.bodySmall,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.success + '18',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  statusPillClosed: { backgroundColor: colors.danger + '15' },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  statusDotClosed: { backgroundColor: colors.danger },
  statusPillText: { fontSize: 10, fontWeight: '600', color: colors.success },
  statusPillTextClosed: { color: colors.danger },

  sectionBar: {
    backgroundColor: colors.primary + '12',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary + '20',
  },
  sectionBarText: {
    fontSize: 10, fontWeight: '700', color: colors.primary, letterSpacing: 0.8,
  },

  bookCell: { flex: 1, padding: 8, borderLeftWidth: 1, borderLeftColor: colors.border },
  bookBtn: {
    backgroundColor: colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  bookBtnText: { ...Typography.bodySmall, fontWeight: '700', color: '#fff' },
  });
}
