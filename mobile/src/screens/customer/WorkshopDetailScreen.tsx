import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, Image, Linking, Dimensions,
} from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Loading } from '../../components/common/Loading';
import { reviewAPI, workshopAPI, uploadAPI } from '../../services/api';
import { LocationMap } from '../../components/common/LocationMap';
import { Colors, Typography, Spacing, BorderRadius, StatusColors } from '../../utils/theme';
import { formatPrice, getCategoryLabel } from '../../utils/helpers';
import { Workshop, WorkshopService, Review, PHOTO_CATEGORY_LABELS } from '../../types';
import { useAppDispatch, useAppSelector } from '../../store';
import { toggleFavourite } from '../../store/favouriteSlice';
import { toggleCompare } from '../../store/compareSlice';
import { useTranslation } from 'react-i18next';

interface Props {
  navigation: any;
  route: any;
}

export const WorkshopDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const workshop: Workshop = route.params?.workshop;
  const dispatch = useAppDispatch();
  const favouriteIds = useAppSelector((s) => s.favourites.ids);
  const compareItems = useAppSelector((s) => s.compare.items);
  const isFav = favouriteIds.includes(workshop.id);
  const isInCompare = compareItems.some((c) => c.id === workshop.id);
  const compareDisabled = compareItems.length >= 3 && !isInCompare;
  const [selectedServices, setSelectedServices] = useState<WorkshopService[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [queueSnap, setQueueSnap] = useState(workshop.queue_snapshot ?? null);
  const [refreshingQueue, setRefreshingQueue] = useState(false);
  const [activePhotoCategory, setActivePhotoCategory] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  const allImages = workshop.images || [];
  const filteredImages = activePhotoCategory
    ? allImages.filter((img) => img.category === activePhotoCategory)
    : allImages;
  const availableCategories = [...new Set(allImages.map((img) => img.category))].filter(Boolean);

  useEffect(() => {
    reviewAPI.getWorkshopReviews(workshop.id).then((r) => {
      setReviews(r.data);
      setLoadingReviews(false);
    }).catch(() => setLoadingReviews(false));
  }, []);

  const refreshQueue = async () => {
    setRefreshingQueue(true);
    try {
      const res = await workshopAPI.getQueue(workshop.id);
      setQueueSnap(res.data);
    } catch {}
    setRefreshingQueue(false);
  };

  const toggleService = (svc: WorkshopService) => {
    setSelectedServices((prev) => {
      const exists = prev.find((s) => s._id === svc._id);
      return exists ? prev.filter((s) => s._id !== svc._id) : [...prev, svc];
    });
  };

  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);

  const callWorkshop = () => Linking.openURL(`tel:${workshop.phone}`);

  const activeServices = workshop.services.filter((s) => s.is_active !== false);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Photo Gallery */}
        <View style={styles.imageContainer}>
          {filteredImages.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={{ width: SCREEN_W, height: 220 }}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
                setPhotoIndex(idx);
              }}
            >
              {filteredImages.map((img, idx) => (
                <Image
                  key={idx}
                  source={{ uri: uploadAPI.getFullUrl(img.url) }}
                  style={{ width: SCREEN_W, height: 220 }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="build-outline" size={64} color={Colors.textLight} />
              <Text style={{ color: Colors.textLight, marginTop: 8, fontSize: 13 }}>No photos yet</Text>
            </View>
          )}

          {/* Category filter chips overlaid at bottom of gallery */}
          {allImages.length > 0 && availableCategories.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.catBar}
              contentContainerStyle={styles.catBarContent}
            >
              <TouchableOpacity
                style={[styles.catChip, !activePhotoCategory && styles.catChipActive]}
                onPress={() => { setActivePhotoCategory(null); setPhotoIndex(0); }}
              >
                <Text style={[styles.catChipText, !activePhotoCategory && styles.catChipTextActive]}>
                  {t('common.all')} ({allImages.length})
                </Text>
              </TouchableOpacity>
              {availableCategories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, activePhotoCategory === cat && styles.catChipActive]}
                  onPress={() => { setActivePhotoCategory(cat); setPhotoIndex(0); }}
                >
                  <Text style={[styles.catChipText, activePhotoCategory === cat && styles.catChipTextActive]}>
                    {PHOTO_CATEGORY_LABELS[cat] || cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Photo counter */}
          {filteredImages.length > 1 && (
            <View style={styles.photoCounter}>
              <Text style={styles.photoCounterText}>{photoIndex + 1} / {filteredImages.length}</Text>
            </View>
          )}

          {/* Caption */}
          {filteredImages[photoIndex]?.caption ? (
            <View style={styles.captionBar}>
              <Text style={styles.captionText} numberOfLines={1}>{filteredImages[photoIndex].caption}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.heartBtn} onPress={() => dispatch(toggleFavourite(workshop.id))}>
            <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={22} color={isFav ? '#EF4444' : '#fff'} />
          </TouchableOpacity>
          <View style={[styles.statusBadge, !workshop.is_open && styles.closedBadge]}>
            <Text style={styles.statusText}>{workshop.is_open ? t('workshop.openNow') : t('workshop.closed')}</Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* Basic Info */}
          <Text style={styles.name}>{workshop.workshop_name}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="star" size={15} color="#FBBC04" />
              <Text style={styles.statText}>{workshop.rating.toFixed(1)}</Text>
              <Text style={styles.statSub}>({workshop.total_reviews} reviews)</Text>
            </View>
            {workshop.distance_km != null && (
              <View style={styles.stat}>
                <Ionicons name="navigate-outline" size={15} color={Colors.primary} />
                <Text style={styles.statText}>{workshop.distance_km.toFixed(1)} km away</Text>
              </View>
            )}
          </View>

          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.address}>{workshop.address}</Text>
          </View>

          {/* Compare chip */}
          <TouchableOpacity
            style={[
              styles.compareChip,
              isInCompare && styles.compareChipActive,
              compareDisabled && styles.compareChipDisabled,
            ]}
            onPress={() => !compareDisabled && dispatch(toggleCompare(workshop))}
            disabled={compareDisabled}
          >
            <Ionicons
              name={isInCompare ? 'checkmark-circle' : 'git-compare-outline'}
              size={14}
              color={isInCompare ? Colors.success : compareDisabled ? Colors.textLight : Colors.primary}
            />
            <Text style={[styles.compareChipText, isInCompare && { color: Colors.success }]}>
              {isInCompare ? t('home.addedToCompare') : compareDisabled ? t('home.compareFull') : t('home.addToCompare')}
            </Text>
          </TouchableOpacity>

          {/* Panel Workshop Badges */}
          {(workshop as any).is_panel_workshop && (
            <View style={styles.panelRow}>
              <Ionicons name="shield-checkmark" size={14} color="#0EA5E9" />
              <Text style={styles.panelLabel}>Panel Workshop · </Text>
              {((workshop as any).panel_providers as string[] || []).map((p: string) => (
                <View key={p} style={styles.panelBadge}>
                  <Text style={styles.panelBadgeText}>{p.charAt(0).toUpperCase() + p.replace(/_/g, ' ').slice(1)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Queue / Wait Time Card */}
          {queueSnap && queueSnap.total_stations > 0 && (() => {
            const waitMin = queueSnap.est_wait_minutes;
            let waitLabel = 'Available now';
            let waitColor = Colors.success;
            if (waitMin === null) { waitLabel = 'No estimate'; waitColor = Colors.textSecondary; }
            else if (waitMin > 0) {
              const h = Math.floor(waitMin / 60);
              const m = waitMin % 60;
              waitLabel = h > 0 ? `~${h}h ${m}m wait` : `~${m} min wait`;
              waitColor = waitMin <= 30 ? '#F59E0B' : Colors.danger;
            }
            return (
              <View style={styles.queueCard}>
                <View style={styles.queueHeader}>
                  <Ionicons name="time-outline" size={16} color={Colors.primary} />
                  <Text style={styles.queueTitle}>{t('workshop.liveQueueStatus')}</Text>
                  <TouchableOpacity onPress={refreshQueue} style={styles.queueRefreshBtn} disabled={refreshingQueue}>
                    <Ionicons name={refreshingQueue ? 'sync' : 'refresh-outline'} size={16} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.queueStats}>
                  <View style={styles.queueStat}>
                    <Text style={styles.queueStatVal}>{queueSnap.available_stations}</Text>
                    <Text style={styles.queueStatLbl}>{t('workshop.baysFree')}</Text>
                  </View>
                  <View style={styles.queueDivider} />
                  <View style={styles.queueStat}>
                    <Text style={styles.queueStatVal}>{queueSnap.active_jobs}</Text>
                    <Text style={styles.queueStatLbl}>{t('workshop.activeJobs')}</Text>
                  </View>
                  <View style={styles.queueDivider} />
                  <View style={styles.queueStat}>
                    <Text style={styles.queueStatVal}>{queueSnap.total_stations}</Text>
                    <Text style={styles.queueStatLbl}>{t('workshop.totalBays')}</Text>
                  </View>
                </View>
                <View style={[styles.queueWaitBadge, { backgroundColor: waitColor + '15' }]}>
                  <Ionicons name="hourglass-outline" size={14} color={waitColor} />
                  <Text style={[styles.queueWaitText, { color: waitColor }]}>{waitLabel}</Text>
                </View>
              </View>
            );
          })()}

          {workshop.description ? (
            <Text style={styles.description}>{workshop.description}</Text>
          ) : null}

          {/* Active Promotions */}
          {workshop.active_promotions && workshop.active_promotions.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>{t('workshop.currentDeals')}</Text>
              {workshop.active_promotions.map((promo) => (
                <View key={promo.id} style={styles.promoCard}>
                  <View style={styles.promoHeader}>
                    <Ionicons name="flame" size={16} color="#F97316" />
                    <Text style={styles.promoTitle}>{promo.title}</Text>
                  </View>
                  {promo.description ? <Text style={styles.promoDesc}>{promo.description}</Text> : null}
                  <Text style={styles.promoExpiry}>
                    Ends {new Date(promo.ends_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              ))}
            </>
          )}

          {/* Location Map */}
          {typeof workshop.latitude === 'number' && typeof workshop.longitude === 'number' && (
            <>
              <Text style={styles.sectionTitle}>{t('workshop.location')}</Text>
              <LocationMap
                latitude={workshop.latitude}
                longitude={workshop.longitude}
                name={workshop.workshop_name}
                address={workshop.address}
                height={220}
              />
            </>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn} onPress={callWorkshop}>
              <Ionicons name="call" size={20} color={Colors.primary} />
              <Text style={styles.actionBtnText}>{t('workshop.call')}</Text>
            </TouchableOpacity>
          </View>

          {/* Services */}
          <Text style={styles.sectionTitle}>{t('workshop.services')}</Text>
          {activeServices.length === 0 ? (
            <Text style={styles.emptyText}>{t('workshop.noServicesListed')}</Text>
          ) : (
            activeServices.map((svc) => {
              const selected = !!selectedServices.find((s) => s._id === svc._id);
              return (
                <TouchableOpacity
                  key={svc._id}
                  style={[styles.serviceItem, selected && styles.serviceItemSelected]}
                  onPress={() => toggleService(svc)}
                  activeOpacity={0.8}
                >
                  <View style={styles.serviceLeft}>
                    <View style={styles.categoryTag}>
                      <Text style={styles.categoryTagText}>{getCategoryLabel(svc.category)}</Text>
                    </View>
                    <Text style={styles.serviceName}>{svc.name}</Text>
                    {svc.description ? (
                      <Text style={styles.serviceDesc} numberOfLines={2}>{svc.description}</Text>
                    ) : null}
                    <Text style={styles.serviceDuration}>
                      <Ionicons name="time-outline" size={12} /> {svc.duration_minutes} min
                    </Text>
                  </View>
                  <View style={styles.serviceRight}>
                    <Text style={styles.servicePrice}>{formatPrice(svc.price)}</Text>
                    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                      {selected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {/* Reviews */}
          <Text style={styles.sectionTitle}>{t('workshop.reviews')}</Text>
          {loadingReviews ? <Loading /> : reviews.length === 0 ? (
            <Text style={styles.emptyText}>{t('workshop.noReviewsYet')}</Text>
          ) : (
            reviews.slice(0, 5).map((r) => (
              <Card key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewAvatar}>
                    <Text style={styles.reviewAvatarText}>{r.customer_name[0]}</Text>
                  </View>
                  <View style={styles.reviewInfo}>
                    <Text style={styles.reviewName}>{r.customer_name}</Text>
                    <View style={styles.stars}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Ionicons
                          key={i}
                          name={i < r.rating ? 'star' : 'star-outline'}
                          size={13}
                          color="#FBBC04"
                        />
                      ))}
                    </View>
                  </View>
                </View>
                {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
              </Card>
            ))
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Book Button */}
      {selectedServices.length > 0 && (
        <View style={styles.bookBar}>
          <View>
            <Text style={styles.bookCount}>{t('workshop.servicesSelected_other', { count: selectedServices.length })}</Text>
            <Text style={styles.bookTotal}>{formatPrice(totalPrice)}</Text>
          </View>
          <Button
            title={t('workshop.bookNow')}
            onPress={() => navigation.navigate('Booking', { workshop, services: selectedServices })}
            style={styles.bookBtn}
          />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  imageContainer: { height: 220, position: 'relative', overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catBar: {
    position: 'absolute',
    bottom: 36,
    left: 0,
    right: 0,
  },
  catBarContent: { paddingHorizontal: 12, gap: 6 },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  catChipActive: { backgroundColor: Colors.primary },
  catChipText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  catChipTextActive: { color: '#fff' },
  photoCounter: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  photoCounterText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  captionBar: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 50,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  captionText: { fontSize: 11, color: '#fff' },
  backBtn: {
    position: 'absolute',
    top: 50,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    position: 'absolute',
    top: 50,
    right: 16,
    backgroundColor: Colors.success,
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  closedBadge: { backgroundColor: Colors.danger },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  content: { padding: Spacing.lg },
  name: { ...Typography.h2, color: Colors.text, marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 10 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { ...Typography.bodySmall, color: Colors.text, fontWeight: '600' },
  statSub: { ...Typography.caption, color: Colors.textSecondary },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 12 },
  address: { ...Typography.bodySmall, color: Colors.textSecondary, flex: 1, lineHeight: 20 },
  description: { ...Typography.body, color: Colors.textSecondary, lineHeight: 22, marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 12, marginBottom: Spacing.xl },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary + '15',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  actionBtnText: { ...Typography.bodySmall, color: Colors.primary, fontWeight: '600' },
  sectionTitle: { ...Typography.h3, color: Colors.text, marginBottom: Spacing.md, marginTop: Spacing.sm },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  serviceItemSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '06' },
  serviceLeft: { flex: 1, marginRight: 12 },
  categoryTag: {
    backgroundColor: Colors.primary + '15',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  categoryTagText: { fontSize: 10, color: Colors.primary, fontWeight: '600' },
  serviceName: { ...Typography.bodySmall, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  serviceDesc: { ...Typography.caption, color: Colors.textSecondary, lineHeight: 18, marginBottom: 4 },
  serviceDuration: { ...Typography.caption, color: Colors.textSecondary },
  serviceRight: { alignItems: 'flex-end', gap: 10 },
  servicePrice: { ...Typography.body, fontWeight: '700', color: Colors.primary },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  emptyText: { ...Typography.body, color: Colors.textSecondary, marginBottom: 16 },
  reviewCard: { marginBottom: 10 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  reviewInfo: {},
  reviewName: { ...Typography.bodySmall, fontWeight: '600', color: Colors.text },
  stars: { flexDirection: 'row', gap: 2, marginTop: 2 },
  reviewComment: { ...Typography.bodySmall, color: Colors.textSecondary, lineHeight: 20 },
  bookBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  bookCount: { ...Typography.caption, color: Colors.textSecondary },
  bookTotal: { ...Typography.h3, color: Colors.primary },
  bookBtn: { minWidth: 120 },

  heartBtn: {
    position: 'absolute',
    top: 50,
    right: 60,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  compareChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '0A',
    marginBottom: 14,
  },
  compareChipActive: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '0A',
  },
  compareChipDisabled: {
    borderColor: Colors.border,
    backgroundColor: 'transparent',
    opacity: 0.5,
  },
  compareChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  panelRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6,
    marginBottom: 12,
  },
  panelLabel: { ...Typography.caption, color: '#0EA5E9', fontWeight: '600' },
  panelBadge: {
    backgroundColor: '#0EA5E9' + '15', borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  panelBadgeText: { ...Typography.caption, color: '#0EA5E9', fontWeight: '600' },

  queueCard: {
    backgroundColor: Colors.primary + '08',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
    padding: Spacing.md,
    marginBottom: 14,
  },
  queueHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  queueTitle: { ...Typography.bodySmall, fontWeight: '700', color: Colors.text, flex: 1 },
  queueRefreshBtn: { padding: 4 },
  queueStats: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  queueStat: { flex: 1, alignItems: 'center' },
  queueStatVal: { ...Typography.h3, color: Colors.text },
  queueStatLbl: { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  queueDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  queueWaitBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  queueWaitText: { ...Typography.caption, fontWeight: '700', fontSize: 12 },

  promoCard: {
    backgroundColor: '#F9731608', borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: '#F9731625',
    padding: Spacing.md, marginBottom: 10,
  },
  promoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  promoTitle: { ...Typography.bodySmall, fontWeight: '700', color: Colors.text, flex: 1 },
  promoDesc: { ...Typography.caption, color: Colors.textSecondary, lineHeight: 18, marginBottom: 6 },
  promoExpiry: { ...Typography.caption, color: '#F97316', fontWeight: '600' },
});
