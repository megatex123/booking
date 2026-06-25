import React, { useEffect, useRef, useState, useCallback, useMemo} from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { chatAPI } from '../../services/api';
import { connectSocket, joinBookingRoom, leaveBookingRoom, getSocket } from '../../services/socket';
import { useAppSelector } from '../../store';
import { Colors, Typography, Spacing, BorderRadius, AppTheme} from '../../utils/theme';
import { useTheme } from '../../hooks/useTheme';
import { Message } from '../../types';

interface Props {
  navigation: any;
  route: any;
}

export const ChatScreen: React.FC<Props> = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { bookingId, workshopName, customerName } = route.params;
  const { user } = useAppSelector((s) => s.auth);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const chatTitle = user?.role === 'customer'
    ? workshopName || 'Workshop'
    : customerName || 'Customer';

  useEffect(() => {
    chatAPI.getMessages(bookingId).then((r) => {
      setMessages(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));

    const setupSocket = async () => {
      await connectSocket();
      joinBookingRoom(bookingId);
      const socket = getSocket();
      if (socket) {
        socket.on('new_message', (msg: Message) => {
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          listRef.current?.scrollToEnd({ animated: true });
        });
      }
    };
    setupSocket();

    return () => {
      leaveBookingRoom(bookingId);
      const socket = getSocket();
      socket?.off('new_message');
    };
  }, [bookingId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }, [messages.length]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setInput('');
    setSending(true);
    try {
      const res = await chatAPI.sendMessage(bookingId, content);
      setMessages((prev) => {
        if (prev.find((m) => m.id === res.data.id)) return prev;
        return [...prev, res.data];
      });
      listRef.current?.scrollToEnd({ animated: true });
    } catch {
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender_id === user?.id;
    const showAvatar = !isMe && (index === 0 || messages[index - 1]?.sender_id !== item.sender_id);
    const time = new Date(item.created_at).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.msgWrapper, isMe && styles.msgWrapperMe]}>
        {!isMe && (
          <View style={[styles.avatar, !showAvatar && styles.avatarHidden]}>
            {showAvatar && (
              <Text style={styles.avatarText}>{item.sender_name[0]}</Text>
            )}
          </View>
        )}
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          {!isMe && showAvatar && (
            <Text style={styles.senderName}>{item.sender_name}</Text>
          )}
          <Text style={[styles.msgText, isMe && styles.msgTextMe]}>{item.content}</Text>
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>{time}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{chatTitle}</Text>
          <Text style={styles.headerSub}>Booking #{bookingId.slice(-6).toUpperCase()}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.body}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="chatbubbles-outline" size={48} color={colors.textLight} />
                <Text style={styles.emptyText}>No messages yet. Say hello!</Text>
              </View>
            }
          />
        )}

        <View style={styles.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor={colors.textLight}
            style={styles.textInput}
            multiline
            maxLength={1000}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!input.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

function makeStyles(colors: AppTheme) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerInfo: {},
  headerName: { ...Typography.body, fontWeight: '700', color: colors.text },
  headerSub: { ...Typography.caption, color: colors.textSecondary },
  body: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messageList: { padding: Spacing.md, gap: 4 },
  msgWrapper: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  msgWrapperMe: { flexDirection: 'row-reverse' },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHidden: { opacity: 0 },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  bubble: {
    maxWidth: '72%',
    padding: 10,
    borderRadius: 16,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
    borderTopLeftRadius: 4,
  },
  bubbleMe: {
    backgroundColor: colors.primary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
  },
  bubbleThem: {},
  senderName: { ...Typography.caption, color: colors.primary, fontWeight: '600', marginBottom: 2 },
  msgText: { ...Typography.bodySmall, color: colors.text, lineHeight: 20 },
  msgTextMe: { color: '#fff' },
  msgTime: { ...Typography.caption, color: colors.textLight, marginTop: 4, textAlign: 'right' },
  msgTimeMe: { color: 'rgba(255,255,255,0.7)' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { ...Typography.body, color: colors.textSecondary, marginTop: 12 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  textInput: {
    flex: 1,
    ...Typography.body,
    color: colors.text,
    maxHeight: 100,
    paddingVertical: 9,
    paddingHorizontal: 14,
    backgroundColor: colors.background,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  });
}
