import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform, Alert } from 'react-native';
import { showAlert } from '../../utils/webAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/common/Button';
import { reviewAPI } from '../../services/api';
import { Colors, Typography, Spacing, BorderRadius } from '../../utils/theme';
import { Booking } from '../../types';

interface Props {
  navigation: any;
  route: any;
}

export const ReviewScreen: React.FC<Props> = ({ navigation, route }) => {
  const booking: Booking = route.params?.booking;
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!booking?.id) {
      showAlert('Error', 'Booking information is missing');
      return;
    }
    setLoading(true);
    try {
      await reviewAPI.create({ booking_id: booking.id, rating, comment: comment.trim() });
      if (Platform.OS === 'web') {
        window.alert('Review submitted! Thank you for your feedback.');
        navigation.goBack();
      } else {
        Alert.alert('Review Submitted', 'Thank you for your feedback!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (e: any) {
      const msg = e.response?.data?.detail || e.message || 'Failed to submit review';
      showAlert('Submission Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const LABELS = ['Poor', 'Fair', 'Good', 'Great', 'Excellent'];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leave a Review</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.workshopInfo}>
          <View style={styles.workshopIcon}>
            <Ionicons name="build" size={28} color={Colors.primary} />
          </View>
          <Text style={styles.workshopName}>{booking.workshop_name}</Text>
          <Text style={styles.serviceNames}>
            {booking.services.map((s: any) => s.name).join(', ')}
          </Text>
        </View>

        {/* Star Rating */}
        <Text style={styles.ratingLabel}>How was your experience?</Text>
        <View style={styles.stars}>
          {Array.from({ length: 5 }).map((_, i) => (
            <TouchableOpacity key={i} onPress={() => setRating(i + 1)} activeOpacity={0.7}>
              <Ionicons
                name={i < rating ? 'star' : 'star-outline'}
                size={44}
                color={i < rating ? '#FBBC04' : Colors.border}
              />
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.ratingText}>{LABELS[rating - 1]}</Text>

        {/* Comment */}
        <Text style={styles.commentLabel}>Add a comment (optional)</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Share your experience with other customers..."
          placeholderTextColor={Colors.textLight}
          multiline
          numberOfLines={4}
          style={styles.commentInput}
          textAlignVertical="top"
          maxLength={500}
        />
        <Text style={styles.charCount}>{comment.length}/500</Text>

        <Button
          title="Submit Review"
          onPress={handleSubmit}
          loading={loading}
          fullWidth
          size="lg"
          style={{ marginTop: 24 }}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { ...Typography.h3, color: Colors.text },
  content: { flex: 1, padding: Spacing.lg },
  workshopInfo: { alignItems: 'center', paddingVertical: Spacing.xl },
  workshopIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  workshopName: { ...Typography.h3, color: Colors.text, textAlign: 'center', marginBottom: 6 },
  serviceNames: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'center' },
  ratingLabel: { ...Typography.body, color: Colors.text, fontWeight: '600', textAlign: 'center', marginBottom: 16 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 10 },
  ratingText: { ...Typography.h3, color: '#FBBC04', textAlign: 'center', marginBottom: 32 },
  commentLabel: { ...Typography.bodySmall, color: Colors.text, fontWeight: '500', marginBottom: 10 },
  commentInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 14,
    ...Typography.body,
    color: Colors.text,
    minHeight: 120,
  },
  charCount: { ...Typography.caption, color: Colors.textLight, textAlign: 'right', marginTop: 6 },
});
