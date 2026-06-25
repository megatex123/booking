import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius } from '../../utils/theme';
import { workshopAPI } from '../../services/api';
import { showAlert, showConfirm } from '../../utils/webAlert';

interface Props {
  navigation: any;
}

interface Promo {
  id: string;
  title: string;
  description: string;
  ends_at: string;
  is_active: boolean;
  is_expired: boolean;
  created_at: string;
}

const MIN_ENDS_AT = () => {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  return d.toISOString().slice(0, 16);
};

export const WorkshopPromotionsScreen: React.FC<Props> = ({ navigation }) => {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await workshopAPI.getPromotions();
      setPromos(res.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setEndsAt(MIN_ENDS_AT());
    setShowModal(true);
  };

  const openEdit = (p: Promo) => {
    setEditingId(p.id);
    setTitle(p.title);
    setDescription(p.description);
    setEndsAt(p.ends_at.slice(0, 16));
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!title.trim()) { showAlert('Missing Info', 'Please enter a promotion title.'); return; }
    if (!endsAt) { showAlert('Missing Info', 'Please set an end date/time.'); return; }
    setSaving(true);
    try {
      const payload = { title: title.trim(), description: description.trim(), ends_at: endsAt };
      if (editingId) {
        await workshopAPI.updatePromotion(editingId, payload);
      } else {
        await workshopAPI.createPromotion(payload);
      }
      setShowModal(false);
      await load();
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Failed to save promotion.');
    }
    setSaving(false);
  };

  const handleToggle = async (p: Promo) => {
    try {
      await workshopAPI.updatePromotion(p.id, { is_active: !p.is_active });
      await load();
    } catch {}
  };

  const handleDelete = (p: Promo) => {
    showConfirm('Delete Promotion', `Remove "${p.title}"?`, async () => {
      try {
        await workshopAPI.deletePromotion(p.id);
        await load();
      } catch {}
    });
  };

  const active = promos.filter((p) => p.is_active && !p.is_expired);
  const inactive = promos.filter((p) => !p.is_active || p.is_expired);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Promotions & Flash Deals</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add-circle-outline" size={26} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Info banner */}
            <View style={styles.infoBanner}>
              <Ionicons name="flame" size={18} color="#F97316" />
              <Text style={styles.infoText}>Active deals appear as badges on your workshop card in the Explore screen.</Text>
            </View>

            {/* Active promotions */}
            <Text style={styles.groupTitle}>Active ({active.length})</Text>
            {active.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No active promotions. Tap + to create one.</Text>
              </View>
            ) : (
              active.map((p) => <PromoCard key={p.id} promo={p} onEdit={() => openEdit(p)} onToggle={() => handleToggle(p)} onDelete={() => handleDelete(p)} />)
            )}

            {/* Past / inactive */}
            {inactive.length > 0 && (
              <>
                <Text style={[styles.groupTitle, { marginTop: 20 }]}>Past / Inactive ({inactive.length})</Text>
                {inactive.map((p) => <PromoCard key={p.id} promo={p} onEdit={() => openEdit(p)} onToggle={() => handleToggle(p)} onDelete={() => handleDelete(p)} />)}
              </>
            )}
          </>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Create / Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowModal(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{editingId ? 'Edit Promotion' : 'New Promotion'}</Text>
            <Text style={styles.fieldLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Free tyre rotation with oil change"
              placeholderTextColor={Colors.textLight}
              maxLength={80}
            />
            <Text style={styles.fieldLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="More details about the offer, T&C, etc."
              placeholderTextColor={Colors.textLight}
              multiline
              numberOfLines={3}
              maxLength={200}
            />
            <Text style={styles.fieldLabel}>Ends at (date & time) *</Text>
            <TextInput
              style={styles.input}
              value={endsAt}
              onChangeText={setEndsAt}
              placeholder="YYYY-MM-DDTHH:MM"
              placeholderTextColor={Colors.textLight}
            />
            <Text style={styles.fieldHint}>Format: 2025-12-31T23:59</Text>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{editingId ? 'Save Changes' : 'Create Promotion'}</Text>}
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const PromoCard: React.FC<{ promo: Promo; onEdit: () => void; onToggle: () => void; onDelete: () => void }> = ({ promo, onEdit, onToggle, onDelete }) => {
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <View style={[cardStyles.card, (promo.is_expired || !promo.is_active) && cardStyles.cardDim]}>
      <View style={cardStyles.top}>
        <Ionicons name="flame" size={16} color={promo.is_active && !promo.is_expired ? '#F97316' : Colors.textLight} />
        <Text style={cardStyles.title} numberOfLines={2}>{promo.title}</Text>
        <Switch
          value={promo.is_active && !promo.is_expired}
          onValueChange={onToggle}
          disabled={promo.is_expired}
          trackColor={{ true: Colors.primary }}
        />
      </View>
      {promo.description ? <Text style={cardStyles.desc} numberOfLines={2}>{promo.description}</Text> : null}
      <View style={cardStyles.footer}>
        <View style={cardStyles.expiry}>
          <Ionicons name="time-outline" size={13} color={promo.is_expired ? Colors.danger : Colors.textSecondary} />
          <Text style={[cardStyles.expiryText, promo.is_expired && { color: Colors.danger }]}>
            {promo.is_expired ? 'Expired ' : 'Ends '}{fmtDate(promo.ends_at)}
          </Text>
        </View>
        <View style={cardStyles.actions}>
          <TouchableOpacity onPress={onEdit} style={cardStyles.actionBtn}>
            <Ionicons name="pencil-outline" size={16} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={cardStyles.actionBtn}>
            <Ionicons name="trash-outline" size={16} color={Colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { ...Typography.h3, color: Colors.text },
  content: { padding: Spacing.lg },

  infoBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#F9731610', borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: '#F9731630',
    padding: Spacing.md, marginBottom: Spacing.lg,
  },
  infoText: { ...Typography.bodySmall, color: Colors.text, flex: 1, lineHeight: 20 },

  groupTitle: { ...Typography.h3, color: Colors.text, marginBottom: 12 },
  emptyCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.lg, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
  },
  emptyText: { ...Typography.bodySmall, color: Colors.textSecondary },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: Spacing.lg, paddingBottom: 32,
  },
  sheetTitle: { ...Typography.h3, color: Colors.text, marginBottom: Spacing.lg },
  fieldLabel: { ...Typography.caption, color: Colors.textSecondary, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm,
    paddingHorizontal: 14, paddingVertical: 10,
    ...Typography.body, color: Colors.text, backgroundColor: Colors.background,
  },
  textArea: { height: 80, textAlignVertical: 'top', paddingTop: 10 },
  fieldHint: { ...Typography.caption, color: Colors.textSecondary, marginTop: 4 },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: Spacing.lg,
  },
  saveBtnText: { ...Typography.button, color: '#fff' },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardDim: { opacity: 0.65 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  title: { ...Typography.body, fontWeight: '700', color: Colors.text, flex: 1 },
  desc: { ...Typography.caption, color: Colors.textSecondary, lineHeight: 18, marginBottom: 8 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  expiry: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  expiryText: { ...Typography.caption, color: Colors.textSecondary },
  actions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 6 },
});
