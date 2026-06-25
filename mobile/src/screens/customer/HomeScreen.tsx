import React, { useEffect, useRef, useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Platform, ScrollView, FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { WorkshopsMap } from '../../components/common/WorkshopsMap';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../store';
import { fetchNearbyWorkshops } from '../../store/workshopSlice';
import { toggleFavourite, loadFavourites } from '../../store/favouriteSlice';
import { toggleCompare, removeFromCompare } from '../../store/compareSlice';
import { Colors, Spacing, BorderRadius, Typography, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { Workshop } from '../../types';
import { useTranslation } from 'react-i18next';

interface Props { navigation: any }

function formatWait(snap?: Workshop['queue_snapshot']): { label: string; color: string } | null {
  if (!snap || snap.total_stations === 0) return null;
  if (snap.est_wait_minutes === 0) return { label: 'Available now', color: '#10B981' };
  if (snap.est_wait_minutes === null) return null;
  const h = Math.floor(snap.est_wait_minutes / 60);
  const m = snap.est_wait_minutes % 60;
  const label = h > 0 ? `~${h}h ${m}m wait` : `~${m} min wait`;
  const color = snap.est_wait_minutes <= 30 ? '#F59E0B' : '#EF4444';
  return { label, color };
}

const CATEGORIES = [
  { key: 'all',         label: 'All',           icon: 'apps-outline' },
  { key: 'oil_change',  label: 'Oil Change',     icon: 'water-outline' },
  { key: 'engine',      label: 'Engine',         icon: 'settings-outline' },
  { key: 'mechanical',  label: 'Mechanical',     icon: 'build-outline' },
  { key: 'tire',        label: 'Tyres & Wheels', icon: 'ellipse-outline' },
  { key: 'brake',       label: 'Brakes',         icon: 'stop-circle-outline' },
  { key: 'suspension',  label: 'Suspension',     icon: 'car-sport-outline' },
  { key: 'body',        label: 'Body Work',      icon: 'car-outline' },
  { key: 'electrical',  label: 'Electrical',     icon: 'flash-outline' },
  { key: 'performance', label: 'Performance',    icon: 'speedometer-outline' },
  { key: 'accessories', label: 'Accessories',    icon: 'headset-outline' },
  { key: 'detailing',   label: 'Detailing',      icon: 'sparkles-outline' },
  { key: 'other',       label: 'Other',          icon: 'construct-outline' },
];

const SORTS = [
  { key: 'distance', label: 'Nearest',    icon: 'navigate-outline' },
  { key: 'rating',   label: 'Top Rated',  icon: 'star-outline' },
  { key: 'reviews',  label: 'Most Reviewed', icon: 'chatbubbles-outline' },
];

export const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { nearby, loading } = useAppSelector((s) => s.workshops);
  const { user } = useAppSelector((s) => s.auth);
  const favouriteIds = useAppSelector((s) => s.favourites.ids);
  const compareItems = useAppSelector((s) => s.compare.items);
  const mapRef = useRef<any>(null);

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('distance');
  const [mapMode, setMapMode] = useState(Platform.OS !== 'web');
  const [panelOnly, setPanelOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const loc = status === 'granted'
        ? await Location.getCurrentPositionAsync({})
        : { coords: { latitude: 3.1390, longitude: 101.6869 } };
      setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  const loadWorkshops = useCallback(() => {
    if (location) {
      dispatch(fetchNearbyWorkshops({
        lat: location.lat,
        lng: location.lng,
        radius: 100,
        category: category !== 'all' ? category : undefined,
      }));
    }
  }, [location, category]);

  useEffect(() => { loadWorkshops(); }, [loadWorkshops]);
  useEffect(() => { dispatch(loadFavourites()); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWorkshops();
    setRefreshing(false);
  };

  const countOf = (key: string) =>
    key === 'all' ? nearby.length : nearby.filter((w) =>
      w.services.some((s: any) => s.category === key)
    ).length;

  const sorted = [...nearby]
    .filter((w) =>
      w.workshop_name.toLowerCase().includes(search.toLowerCase()) ||
      w.address.toLowerCase().includes(search.toLowerCase())
    )
    .filter((w) => !panelOnly || (w as any).is_panel_workshop)
    .sort((a, b) => {
      if (sort === 'rating') return b.rating - a.rating;
      if (sort === 'reviews') return b.total_reviews - a.total_reviews;
      return (a.distance_km ?? 99) - (b.distance_km ?? 99);
    });

  const displayList = [
    ...sorted.filter((w) => favouriteIds.includes(w.id)),
    ...sorted.filter((w) => !favouriteIds.includes(w.id)),
  ];

  const openCount = sorted.filter((w) => w.is_open).length;

  const goToWorkshop = (w: Workshop) => navigation.navigate('WorkshopDetail', { workshop: w });

  const renderWorkshop = ({ item: w }: { item: Workshop }) => {
    const isFav = favouriteIds.includes(w.id);
    const isInCompare = compareItems.some((c) => c.id === w.id);
    const compareDisabled = compareItems.length >= 3 && !isInCompare;
    const waitInfo = formatWait(w.queue_snapshot);

    return (
    <TouchableOpacity style={styles.card} onPress={() => goToWorkshop(w)} activeOpacity={0.88}>
      {/* Color bar based on open status */}
      <View style={[styles.cardAccent, { backgroundColor: w.is_open ? colors.success : colors.textLight }]} />

      <View style={styles.cardBody}>
        {/* Top row */}
        <View style={styles.cardTop}>
          <View style={styles.workshopIcon}>
            <Ionicons name="build" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.workshopName} numberOfLines={1}>{w.workshop_name}</Text>
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
              <Text style={styles.addressText} numberOfLines={1}>{w.address}</Text>
            </View>
          </View>
          <View style={[styles.openBadge, !w.is_open && styles.closedBadge]}>
            <Text style={[styles.openText, !w.is_open && styles.closedText]}>
              {w.is_open ? t('home.openNow') : t('home.closed')}
            </Text>
          </View>
          {isFav && (
            <View style={styles.favPinBadge}>
              <Ionicons name="bookmark" size={10} color={colors.primary} />
            </View>
          )}
          <TouchableOpacity
            style={styles.heartBtn}
            onPress={() => dispatch(toggleFavourite(w.id))}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Ionicons
              name={isFav ? 'heart' : 'heart-outline'}
              size={20}
              color={isFav ? '#EF4444' : colors.textLight}
            />
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="star" size={13} color="#FBBC04" />
            <Text style={styles.statVal}>{w.rating.toFixed(1)}</Text>
            <Text style={styles.statSub}>({w.total_reviews})</Text>
          </View>
          {w.distance_km != null && (
            <View style={styles.statItem}>
              <Ionicons name="navigate-outline" size={13} color={colors.primary} />
              <Text style={styles.statVal}>{w.distance_km.toFixed(1)} km</Text>
            </View>
          )}
          <View style={styles.statItem}>
            <Ionicons name="construct-outline" size={13} color={colors.textSecondary} />
            <Text style={styles.statVal}>{w.services.length} services</Text>
          </View>
          {waitInfo && (
            <View style={[styles.statItem, styles.waitBadge, { backgroundColor: waitInfo.color + '18' }]}>
              <Ionicons name="time-outline" size={12} color={waitInfo.color} />
              <Text style={[styles.waitLabel, { color: waitInfo.color }]}>{waitInfo.label}</Text>
            </View>
          )}
        </View>

        {/* Active promotion badge */}
        {w.active_promotions && w.active_promotions.length > 0 && (
          <View style={styles.promoBadge}>
            <Ionicons name="flame" size={12} color="#F97316" />
            <Text style={styles.promoText} numberOfLines={1}>{w.active_promotions[0].title}</Text>
          </View>
        )}

        {/* Service category tags */}
        {w.services.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsScroll}>
            {[...new Set(w.services.map((s: any) => s.category))].slice(0, 4).map((cat: any) => {
              const c = CATEGORIES.find((x) => x.key === cat);
              return (
                <View key={cat} style={styles.tag}>
                  <Ionicons name={c?.icon as any ?? 'construct-outline'} size={11} color={colors.primary} />
                  <Text style={styles.tagText}>{c?.label ?? cat}</Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Footer */}
        <View style={styles.cardFooter}>
          <TouchableOpacity
            style={[
              styles.compareChip,
              isInCompare && styles.compareChipActive,
              compareDisabled && styles.compareChipDisabled,
            ]}
            onPress={() => !compareDisabled && dispatch(toggleCompare(w))}
            disabled={compareDisabled}
          >
            <Ionicons
              name={isInCompare ? 'checkmark-circle' : 'git-compare-outline'}
              size={12}
              color={isInCompare ? colors.success : compareDisabled ? colors.textLight : colors.primary}
            />
            <Text style={[styles.compareChipText, isInCompare && { color: colors.success }]}>
              {isInCompare ? 'Added' : 'Compare'}
            </Text>
          </TouchableOpacity>
          <Text style={styles.priceHint}>
            From RM {Math.min(...w.services.map((s: any) => s.price)).toFixed(0)}
          </Text>
          <TouchableOpacity
            style={styles.bookBtn}
            onPress={() => goToWorkshop(w)}
            activeOpacity={0.8}
          >
            <Text style={styles.bookBtnText}>{t('workshop.bookNow')}</Text>
            <Ionicons name="arrow-forward" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]}! 👋</Text>
          <Text style={styles.subGreeting}>
            {nearby.length > 0
              ? `${openCount} of ${nearby.length} workshops open`
              : 'Find a workshop near you'}
          </Text>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase()}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('home.searchPlaceholder')}
            placeholderTextColor={colors.textLight}
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textLight} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.toggleBtn} onPress={() => setMapMode(!mapMode)}>
          <Ionicons name={mapMode ? 'list-outline' : 'map-outline'} size={20} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.toggleBtn} onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categories}
        style={styles.categoriesScroll}
      >
        {/* Panel-only toggle chip */}
        <TouchableOpacity
          style={[styles.chip, panelOnly && styles.chipPanelActive]}
          onPress={() => setPanelOnly((v) => !v)}
        >
          <Ionicons name="shield-checkmark-outline" size={14} color={panelOnly ? '#fff' : '#0EA5E9'} />
          <Text style={[styles.chipText, panelOnly && styles.chipTextActive]}>Panel</Text>
        </TouchableOpacity>

        {CATEGORIES.map((cat) => {
          const count = countOf(cat.key);
          const active = category === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setCategory(cat.key)}
            >
              <Ionicons
                name={cat.icon as any}
                size={14}
                color={active ? '#fff' : colors.textSecondary}
              />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.label}</Text>
              {count > 0 && (
                <View style={[styles.chipBadge, active && styles.chipBadgeActive]}>
                  <Text style={[styles.chipBadgeText, active && styles.chipBadgeTextActive]}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Sort bar */}
      <View style={styles.sortRow}>
        <Text style={styles.resultCount} numberOfLines={1}>
          {sorted.length} {sorted.length === 1 ? 'workshop' : 'workshops'}
          {search ? ` for "${search}"` : ''}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortBtns}
          style={styles.sortBtnsScroll}
        >
          {SORTS.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.sortBtn, sort === s.key && styles.sortBtnActive]}
              onPress={() => setSort(s.key)}
            >
              <Ionicons name={s.icon as any} size={14} color={sort === s.key ? colors.primary : colors.textSecondary} />
              <Text style={[styles.sortText, sort === s.key && styles.sortTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Map or List */}
      {mapMode ? (
        <View style={styles.mapWrap}>
            {location ? (
              Platform.OS === 'web' ? (
                <WorkshopsMap
                  workshops={displayList}
                  userLocation={location}
                  onPress={goToWorkshop}
                />
              ) : (
                <MapView
                  ref={mapRef}
                  style={styles.map}
                  initialRegion={{
                    latitude: location.lat,
                    longitude: location.lng,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                  }}
                  showsUserLocation
                >
                  {displayList.map((w) => (
                    <Marker
                      key={w.id}
                      coordinate={{ latitude: w.latitude, longitude: w.longitude }}
                      title={w.workshop_name}
                      description={`⭐ ${w.rating.toFixed(1)} · ${w.distance_km?.toFixed(1)} km`}
                      onCalloutPress={() => goToWorkshop(w)}
                      pinColor={w.is_open ? colors.success : colors.danger}
                    />
                  ))}
                </MapView>
              )
            ) : (
              <View style={styles.mapLoader}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={styles.mapLoaderText}>Getting your location...</Text>
              </View>
            )}

            {/* Bottom sheet */}
            <View style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>{displayList.length} nearby workshops</Text>
              <FlatList
                data={displayList.slice(0, 6)}
                keyExtractor={(i) => i.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sheetList}
                renderItem={({ item: w }) => (
                  <TouchableOpacity style={styles.miniCard} onPress={() => goToWorkshop(w)} activeOpacity={0.85}>
                    <View style={styles.miniIconWrap}>
                      <Ionicons name="build" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.miniName} numberOfLines={1}>{w.workshop_name}</Text>
                      <Text style={styles.miniMeta}>⭐ {w.rating.toFixed(1)} · {w.distance_km?.toFixed(1)} km</Text>
                    </View>
                    <View style={[styles.miniStatus, !w.is_open && styles.miniStatusClosed]}>
                      <Text style={[styles.miniStatusText, !w.is_open && { color: colors.danger }]}>
                        {w.is_open ? t('home.openNow') : t('home.closed')}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        ) : (
          <FlatList
            data={displayList}
            keyExtractor={(i) => i.id}
            contentContainerStyle={[
              styles.list,
              displayList.length === 0 && { flex: 1 },
              compareItems.length > 0 && { paddingBottom: 80 },
            ]}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            ListEmptyComponent={
              loading ? (
                <View style={styles.emptyCenter}>
                  <ActivityIndicator color={colors.primary} size="large" />
                  <Text style={styles.emptyText}>Finding workshops near you...</Text>
                </View>
              ) : (
                <View style={styles.emptyCenter}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="search-outline" size={40} color={colors.textLight} />
                  </View>
                  <Text style={styles.emptyTitle}>{t('home.noWorkshopsFound')}</Text>
                  <Text style={styles.emptyText}>
                    {search ? `No results for "${search}"` : 'Try a different category or check back later'}
                  </Text>
                  {search ? (
                    <TouchableOpacity style={styles.clearBtn} onPress={() => setSearch('')}>
                      <Text style={styles.clearBtnText}>Clear search</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )
            }
            renderItem={renderWorkshop}
          />
        )}

        {/* Compare tray */}
        {compareItems.length > 0 && (
          <View style={styles.compareTray}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.compareTrayItems}
            >
              {compareItems.map((w) => (
                <View key={w.id} style={styles.compareTrayItem}>
                  <Text style={styles.compareTrayName} numberOfLines={1}>{w.workshop_name}</Text>
                  <TouchableOpacity onPress={() => dispatch(removeFromCompare(w.id))} hitSlop={{ top: 4, right: 4, bottom: 4, left: 4 }}>
                    <Ionicons name="close-circle" size={14} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
              {Array.from({ length: 3 - compareItems.length }).map((_, i) => (
                <View key={`slot-${i}`} style={styles.compareTraySlot}>
                  <Ionicons name="add-outline" size={12} color={colors.textLight} />
                  <Text style={styles.compareTraySlotText}>Add</Text>
                </View>
              ))}
            </ScrollView>
            {compareItems.length >= 2 ? (
              <TouchableOpacity
                style={styles.compareTrayBtn}
                onPress={() => navigation.navigate('Compare')}
                activeOpacity={0.85}
              >
                <Ionicons name="git-compare-outline" size={15} color="#fff" />
                <Text style={styles.compareTrayBtnText}>Compare {compareItems.length}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.compareTrayHint}>
                <Text style={styles.compareTrayHintText}>Add 1 more</Text>
              </View>
            )}
          </View>
        )}
    </SafeAreaView>
  );
};

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, position: 'relative' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  greeting: { ...Typography.h3, color: colors.text },
  subGreeting: { ...Typography.caption, color: colors.textSecondary, marginTop: 2 },
  profileBtn: {},
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    gap: 8,
    marginBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, ...Typography.body, color: colors.text },
  toggleBtn: {
    width: 44, height: 44,
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },

  categoriesScroll: { height: 44, marginBottom: 8 },
  categories: { paddingHorizontal: Spacing.lg, gap: 8, alignItems: 'flex-start', flexDirection: 'row' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    height: 36,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipPanelActive: { backgroundColor: '#0EA5E9', borderColor: '#0EA5E9' },
  chipText: { ...Typography.caption, color: colors.textSecondary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  chipBadge: {
    backgroundColor: colors.border,
    borderRadius: 8, minWidth: 18, height: 18,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  chipBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  chipBadgeText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
  chipBadgeTextActive: { color: '#fff' },

  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: 8,
    gap: 8,
  },
  resultCount: { ...Typography.caption, color: colors.textSecondary, flexShrink: 0 },
  sortBtnsScroll: { flexShrink: 1 },
  sortBtns: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sortBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  sortText: { fontSize: 11, fontWeight: '500', color: colors.textSecondary },
  sortTextActive: { color: colors.primary, fontWeight: '600' },

  list: { paddingHorizontal: Spacing.lg, paddingBottom: 32, gap: 12 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: Spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  workshopIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: colors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  workshopName: { ...Typography.body, fontWeight: '700', color: colors.text },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  addressText: { ...Typography.caption, color: colors.textSecondary, flex: 1 },
  openBadge: {
    backgroundColor: colors.success + '15',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  closedBadge: { backgroundColor: colors.danger + '15' },
  openText: { fontSize: 11, fontWeight: '600', color: colors.success },
  closedText: { color: colors.danger },

  statsRow: { flexDirection: 'row', gap: 14, marginBottom: 10 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statVal: { ...Typography.caption, color: colors.text, fontWeight: '600' },
  statSub: { ...Typography.caption, color: colors.textSecondary },
  waitBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start' },
  waitLabel: { ...Typography.caption, fontWeight: '700', fontSize: 11 },
  promoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F9731615', borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'flex-start', marginBottom: 8,
  },
  promoText: { ...Typography.caption, color: '#F97316', fontWeight: '600', flexShrink: 1 },

  tagsScroll: { marginBottom: 10 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary + '10',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
  },
  tagText: { fontSize: 10, fontWeight: '600', color: colors.primary },

  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  priceHint: { ...Typography.caption, color: colors.textSecondary },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
  },
  bookBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  mapWrap: { flex: 1, position: 'relative' },
  map: { flex: 1 },
  mapLoader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapLoaderText: { ...Typography.body, color: colors.textSecondary, marginTop: 12 },

  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1, shadowRadius: 12,
    elevation: 8,
  },
  sheetHandle: {
    width: 36, height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetTitle: { ...Typography.bodySmall, fontWeight: '600', color: colors.textSecondary, paddingHorizontal: Spacing.lg, marginBottom: 12 },
  sheetList: { paddingHorizontal: Spacing.lg, gap: 10 },
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: BorderRadius.md,
    padding: 10,
    width: 210,
    gap: 8,
  },
  miniIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  miniName: { ...Typography.caption, fontWeight: '600', color: colors.text },
  miniMeta: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  miniStatus: {
    backgroundColor: colors.success + '15',
    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  miniStatusClosed: { backgroundColor: colors.danger + '15' },
  miniStatusText: { fontSize: 10, fontWeight: '600', color: colors.success },

  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { ...Typography.h3, color: colors.text, marginBottom: 8 },
  emptyText: { ...Typography.body, color: colors.textSecondary, textAlign: 'center' },
  clearBtn: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  clearBtnText: { ...Typography.button, color: '#fff', fontSize: 14 },

  /* Favourite + compare */
  heartBtn: {
    marginLeft: 4,
    padding: 2,
  },
  favPinBadge: {
    position: 'absolute',
    top: -4,
    right: 30,
    backgroundColor: colors.primary + '18',
    borderRadius: 6,
    padding: 2,
  },
  compareChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary + '0A',
  },
  compareChipActive: {
    borderColor: colors.success,
    backgroundColor: colors.success + '0A',
  },
  compareChipDisabled: {
    borderColor: colors.border,
    backgroundColor: 'transparent',
    opacity: 0.5,
  },
  compareChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },

  /* Compare tray */
  compareTray: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 6,
  },
  compareTrayItems: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compareTrayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary + '10',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: 110,
  },
  compareTrayName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    flexShrink: 1,
  },
  compareTraySlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  compareTraySlotText: {
    fontSize: 11,
    color: colors.textLight,
  },
  compareTrayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginLeft: 'auto',
  },
  compareTrayBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  compareTrayHint: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
  },
  compareTrayHintText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  });
}
