import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Workshop } from '../types';
import { workshopAPI } from '../services/api';

interface WorkshopState {
  nearby: Workshop[];
  selected: Workshop | null;
  myWorkshop: Workshop | null;
  loading: boolean;
  error: string | null;
}

const initialState: WorkshopState = {
  nearby: [],
  selected: null,
  myWorkshop: null,
  loading: false,
  error: null,
};

export const fetchNearbyWorkshops = createAsyncThunk(
  'workshops/fetchNearby',
  async (
    { lat, lng, radius, category }: { lat: number; lng: number; radius?: number; category?: string },
    { rejectWithValue }
  ) => {
    try {
      const res = await workshopAPI.getNearby(lat, lng, radius, category);
      return res.data as Workshop[];
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail || 'Failed to load workshops');
    }
  }
);

export const fetchWorkshopById = createAsyncThunk(
  'workshops/fetchById',
  async (id: string, { rejectWithValue }) => {
    try {
      const res = await workshopAPI.getById(id);
      return res.data as Workshop;
    } catch (e: any) {
      return rejectWithValue('Failed to load workshop');
    }
  }
);

export const fetchMyWorkshop = createAsyncThunk(
  'workshops/fetchMine',
  async (_, { rejectWithValue }) => {
    try {
      const res = await workshopAPI.getMyWorkshop();
      return res.data as Workshop;
    } catch (e: any) {
      return rejectWithValue('Failed to load workshop');
    }
  }
);

const workshopSlice = createSlice({
  name: 'workshops',
  initialState,
  reducers: {
    setSelected: (state, action: PayloadAction<Workshop | null>) => {
      state.selected = action.payload;
    },
    updateMyWorkshop: (state, action: PayloadAction<Workshop>) => {
      state.myWorkshop = action.payload;
    },
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNearbyWorkshops.pending, (state) => { state.loading = true; })
      .addCase(fetchNearbyWorkshops.fulfilled, (state, action) => {
        state.loading = false;
        state.nearby = action.payload;
      })
      .addCase(fetchNearbyWorkshops.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchWorkshopById.fulfilled, (state, action) => {
        state.selected = action.payload;
      })
      .addCase(fetchMyWorkshop.fulfilled, (state, action) => {
        state.myWorkshop = action.payload;
      });
  },
});

export const { setSelected, updateMyWorkshop, clearError } = workshopSlice.actions;
export default workshopSlice.reducer;
