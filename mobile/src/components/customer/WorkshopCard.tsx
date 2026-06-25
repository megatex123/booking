import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Workshop } from '../../types';
import { Colors, Typography, Spacing, BorderRadius } from '../../utils/theme';

interface Props {
  workshop: Workshop;
  onPress: () => void;
  onMapPress?: () => void;
  compact?: boolean;
}

export const WorkshopCard: React.FC<Props> = ({ workshop, onPress, onMapPress, compact }) => {
  if (compact) {
    return (
      <TouchableOpacity style={styles.compact} onPress={onPress} activeOpacity={0.85}>
        <View style={styles.compactIcon}>
          <Ionicons name="build" size={20} color={Colors.primary} />
        </View>
        <View style={styles.compactInfo}>
          <Text style={styles.compactName} numberOfLines={1}>{workshop.workshop_name}</Text>
          <Text style={styles.compactMeta}>
            ⭐ {workshop.rating.toFixed(1)} · {workshop.distance_km?.toFixed(1)} km
          </Text>
        </View>
        <View style={[styles.openBadge, !workshop.is_open && styles.closedBadge]}>
          <Text style={[styles.openText, !workshop.is_open && styles.closedText]}>
            {workshop.is_open ? 'Open' : 'Closed'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.imageContainer}>
        {workshop.images.length > 0 ? (
          <Image source={{ uri: workshop.images[0] }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="build-outline" size={36} color={Colors.textLight} />
          </View>
        )}
        <View style={[styles.statusChip, !workshop.is_open && styles.closedChip]}>
          <Text style={styles.statusChipText}>{workshop.is_open ? 'Open' : 'Closed'}</Text>
        </View>
      </View>

      <View style={styles.info}>
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>{workshop.workshop_name}</Text>
          {onMapPress && (
            <TouchableOpacity onPress={onMapPress} style={styles.mapBtn}>
              <Ionicons name="navigate-outline" size={16} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.meta}>
          <Ionicons name="location-outline" size={13} color={Colors.textSecondary} />
          <Text style={styles.address} numberOfLines={1}>{workshop.address}</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="star" size={13} color="#FBBC04" />
            <Text style={styles.statText}>{workshop.rating.toFixed(1)}</Text>
            <Text style={styles.statSub}>({workshop.total_reviews})</Text>
          </View>
          {workshop.distance_km != null && (
            <View style={styles.stat}>
              <Ionicons name="car-outline" size={13} color={Colors.textSecondary} />
              <Text style={styles.statText}>{workshop.distance_km.toFixed(1)} km</Text>
            </View>
          )}
          <View style={styles.stat}>
            <Ionicons name="construct-outline" size={13} color={Colors.textSecondary} />
            <Text style={styles.statText}>{workshop.services.length} services</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  imageContainer: { height: 140, position: 'relative' },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusChip: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  closedChip: { backgroundColor: Colors.danger },
  statusChipText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  info: { padding: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { ...Typography.h3, color: Colors.text, flex: 1 },
  mapBtn: { padding: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 10 },
  address: { ...Typography.caption, color: Colors.textSecondary, flex: 1 },
  statsRow: { flexDirection: 'row', gap: 14 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { ...Typography.caption, color: Colors.text, fontWeight: '500' },
  statSub: { ...Typography.caption, color: Colors.textSecondary },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: 12,
    width: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  compactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  compactInfo: { flex: 1 },
  compactName: { ...Typography.bodySmall, fontWeight: '600', color: Colors.text },
  compactMeta: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  openBadge: {
    backgroundColor: Colors.success + '20',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  closedBadge: { backgroundColor: Colors.danger + '20' },
  openText: { fontSize: 10, fontWeight: '600', color: Colors.success },
  closedText: { color: Colors.danger },
});
