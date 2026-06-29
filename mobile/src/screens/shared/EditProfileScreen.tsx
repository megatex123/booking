import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Platform, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../store';
import { updateUser } from '../../store/authSlice';
import { api, uploadAPI } from '../../services/api';
import { saveUser } from '../../services/storage';
import { showAlert } from '../../utils/webAlert';
import { Colors, Typography, Spacing, BorderRadius, AppTheme } from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';

interface Props { navigation: any }

export const EditProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);

  const [name, setName]       = useState(user?.name    || '');
  const [phone, setPhone]     = useState(user?.phone   || '');
  const [address, setAddress] = useState(user?.address || '');
  const [saving, setSaving]   = useState(false);
  const [error,  setError]    = useState('');

  // Avatar upload state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<any>(null);

  const currentAvatarUri = avatarPreview
    ?? (user?.avatar ? uploadAPI.getFullUrl(user.avatar) : null);

  const pickAvatar = () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: any) => {
    const file: File | undefined = e.target.files?.[0];
    if (!file) return;

    // Validate size (5 MB max)
    if (file.size > 5 * 1024 * 1024) {
      showAlert('File too large', 'Please choose an image under 5 MB.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
    setUploadingAvatar(true);
    try {
      const uploadedPath = await uploadAPI.uploadFile(objectUrl, file.type, file.name);
      const res = await api.patch('/users/me', { avatar: uploadedPath });
      dispatch(updateUser(res.data));
      await saveUser({ ...user!, ...res.data });
      // Replace preview with the canonical server URL so there's no dangling blob URL
      setAvatarPreview(uploadAPI.getFullUrl(uploadedPath));
    } catch {
      setAvatarPreview(null);
      showAlert('Upload Failed', 'Could not upload the image. Please try again.');
    }
    setUploadingAvatar(false);
    // Reset file input so the same file can be re-selected if needed
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await api.patch('/users/me', { name: name.trim(), phone: phone.trim(), address: address.trim() });
      dispatch(updateUser(res.data));
      await saveUser({ ...user!, ...res.data });
      navigation.goBack();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">

        {/* Avatar picker */}
        <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar} activeOpacity={0.8}>
          {currentAvatarUri ? (
            <Image source={{ uri: currentAvatarUri }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarInitial}>{name[0]?.toUpperCase() || '?'}</Text>
            </View>
          )}

          {/* Camera badge */}
          <View style={[styles.cameraBadge, { backgroundColor: colors.primary }]}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>

          {/* Upload spinner overlay */}
          {uploadingAvatar && (
            <View style={styles.uploadOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        <Text style={[styles.avatarHint, { color: colors.textSecondary }]}>
          Tap to change photo
        </Text>

        {/* Hidden web file input */}
        {Platform.OS === 'web' && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        )}

        {error ? <Text style={[styles.errorText, { backgroundColor: colors.danger + '15', color: colors.danger }]}>{error}</Text> : null}

        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
          placeholderTextColor={colors.textLight}
        />

        <Text style={styles.label}>Phone Number</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={phone}
          onChangeText={setPhone}
          placeholder="e.g. 0123456789"
          placeholderTextColor={colors.textLight}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Address</Text>
        <TextInput
          style={[styles.input, styles.inputMulti, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={address}
          onChangeText={setAddress}
          placeholder="e.g. No. 12, Jalan Bukit, Kuala Lumpur"
          placeholderTextColor={colors.textLight}
          multiline
          numberOfLines={2}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.divider, borderColor: colors.border, color: colors.textLight }]}
          value={user?.email || ''}
          editable={false}
        />
        <Text style={[styles.hint, { color: colors.textLight }]}>Email cannot be changed</Text>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving || uploadingAvatar}
          activeOpacity={0.8}
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </TouchableOpacity>
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
    body: { padding: Spacing.lg, alignItems: 'stretch' },

    avatarWrap: {
      alignSelf: 'center', marginBottom: 8, position: 'relative',
    },
    avatarImg: {
      width: 96, height: 96, borderRadius: 48,
    },
    avatarPlaceholder: {
      width: 96, height: 96, borderRadius: 48,
      alignItems: 'center', justifyContent: 'center',
    },
    avatarInitial: { fontSize: 38, fontWeight: '700', color: '#fff' },
    cameraBadge: {
      position: 'absolute', bottom: 2, right: 2,
      width: 28, height: 28, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 2, borderColor: colors.background,
    },
    uploadOverlay: {
      position: 'absolute', inset: 0,
      borderRadius: 48, backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center', justifyContent: 'center',
    },
    avatarHint: { textAlign: 'center', fontSize: 12, marginBottom: Spacing.lg },

    label: { ...Typography.bodySmall, color: colors.textSecondary, marginBottom: 6, marginTop: Spacing.md },
    input: {
      borderWidth: 1, borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md, paddingVertical: 12,
      ...Typography.body,
    },
    inputMulti: { minHeight: 64, textAlignVertical: 'top' },
    hint: { ...Typography.caption, marginTop: 4 },
    errorText: {
      ...Typography.bodySmall, padding: Spacing.md,
      borderRadius: BorderRadius.sm, marginBottom: Spacing.md,
    },
    saveBtn: {
      borderRadius: BorderRadius.md, paddingVertical: 14,
      alignItems: 'center', marginTop: Spacing.xl,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { ...Typography.button, color: '#fff' },
  });
}
