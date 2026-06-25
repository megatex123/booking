import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { notificationAPI } from '../services/api';

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

interface NotificationState {
  items: Notification[];
  unreadCount: number;
  loading: boolean;
}

const initialState: NotificationState = {
  items: [],
  unreadCount: 0,
  loading: false,
};

export const fetchNotifications = createAsyncThunk('notifications/fetchAll', async () => {
  const res = await notificationAPI.getNotifications();
  return res.data as Notification[];
});

export const fetchUnreadCount = createAsyncThunk('notifications/fetchCount', async () => {
  const res = await notificationAPI.getUnreadCount();
  return res.data.count as number;
});

export const markRead = createAsyncThunk('notifications/markRead', async (id: string) => {
  await notificationAPI.markRead(id);
  return id;
});

export const markAllRead = createAsyncThunk('notifications/markAllRead', async () => {
  await notificationAPI.markAllRead();
});

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification(state, action: PayloadAction<Notification>) {
      state.items.unshift(action.payload);
      if (!action.payload.is_read) {
        state.unreadCount += 1;
      }
    },
    setUnreadCount(state, action: PayloadAction<number>) {
      state.unreadCount = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => { state.loading = true; })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.items = action.payload;
        state.unreadCount = action.payload.filter(n => !n.is_read).length;
        state.loading = false;
      })
      .addCase(fetchNotifications.rejected, (state) => { state.loading = false; })
      .addCase(markRead.fulfilled, (state, action) => {
        const item = state.items.find(n => n.id === action.payload);
        if (item && !item.is_read) {
          item.is_read = true;
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
      })
      .addCase(markAllRead.fulfilled, (state) => {
        state.items.forEach(n => { n.is_read = true; });
        state.unreadCount = 0;
      });
  },
});

export const { addNotification, setUnreadCount } = notificationSlice.actions;
export default notificationSlice.reducer;
