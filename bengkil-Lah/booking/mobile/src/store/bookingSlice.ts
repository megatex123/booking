import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Booking } from '../types';
import { bookingAPI } from '../services/api';

interface BookingState {
  bookings: Booking[];
  selectedBooking: Booking | null;
  loading: boolean;
  error: string | null;
}

const initialState: BookingState = {
  bookings: [],
  selectedBooking: null,
  loading: false,
  error: null,
};

export const fetchMyBookings = createAsyncThunk(
  'bookings/fetchMy',
  async (status: string | undefined, { rejectWithValue }) => {
    try {
      const res = await bookingAPI.getMyBookings(status);
      return res.data as Booking[];
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail || 'Failed to load bookings');
    }
  }
);

export const fetchBookingById = createAsyncThunk(
  'bookings/fetchById',
  async (id: string, { rejectWithValue }) => {
    try {
      const res = await bookingAPI.getById(id);
      return res.data as Booking;
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail || 'Failed to load booking');
    }
  }
);

export const createBooking = createAsyncThunk(
  'bookings/create',
  async (data: object, { rejectWithValue }) => {
    try {
      const res = await bookingAPI.create(data);
      return res.data as Booking;
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail || 'Failed to create booking');
    }
  }
);

export const updateBookingStatus = createAsyncThunk(
  'bookings/updateStatus',
  async (
    { id, status, note, completion_notes, next_service_months, service_reports }:
    {
      id: string;
      status: string;
      note?: string;
      completion_notes?: string;
      next_service_months?: number;
      service_reports?: Array<{
        service_id: string;
        service_name: string;
        work_done: string;
        next_service_months?: number | null;
        media?: string[];
        products_used?: Array<{ product_id: string; product_name: string; brand?: string; unit: string; quantity: number; unit_price: number }>;
      }>;
    },
    { rejectWithValue }
  ) => {
    try {
      const res = await bookingAPI.updateStatus(id, { status, note, completion_notes, next_service_months, service_reports });
      return res.data as Booking;
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail || 'Failed to update booking');
    }
  }
);

export const cancelBooking = createAsyncThunk(
  'bookings/cancel',
  async (id: string, { rejectWithValue }) => {
    try {
      const res = await bookingAPI.cancel(id);
      return res.data as Booking;
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail || 'Failed to cancel booking');
    }
  }
);

const bookingSlice = createSlice({
  name: 'bookings',
  initialState,
  reducers: {
    setSelectedBooking: (state, action: PayloadAction<Booking | null>) => {
      state.selectedBooking = action.payload;
    },
    upsertBooking: (state, action: PayloadAction<Booking>) => {
      const idx = state.bookings.findIndex((b) => b.id === action.payload.id);
      if (idx >= 0) {
        state.bookings[idx] = action.payload;
      } else {
        state.bookings.unshift(action.payload);
      }
      if (state.selectedBooking?.id === action.payload.id) {
        state.selectedBooking = action.payload;
      }
    },
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyBookings.pending, (state) => { state.loading = true; })
      .addCase(fetchMyBookings.fulfilled, (state, action) => {
        state.loading = false;
        state.bookings = action.payload;
      })
      .addCase(fetchMyBookings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchBookingById.fulfilled, (state, action) => {
        state.selectedBooking = action.payload;
      })
      .addCase(createBooking.fulfilled, (state, action) => {
        state.bookings.unshift(action.payload);
        state.selectedBooking = action.payload;
      })
      .addCase(updateBookingStatus.fulfilled, (state, action) => {
        const idx = state.bookings.findIndex((b) => b.id === action.payload.id);
        if (idx >= 0) state.bookings[idx] = action.payload;
        if (state.selectedBooking?.id === action.payload.id) {
          state.selectedBooking = action.payload;
        }
      })
      .addCase(cancelBooking.fulfilled, (state, action) => {
        const idx = state.bookings.findIndex((b) => b.id === action.payload.id);
        if (idx >= 0) state.bookings[idx] = action.payload;
        if (state.selectedBooking?.id === action.payload.id) {
          state.selectedBooking = action.payload;
        }
      });
  },
});

export const { setSelectedBooking, upsertBooking, clearError } = bookingSlice.actions;
export default bookingSlice.reducer;
