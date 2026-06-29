import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { api } from '../services/api';

export interface FlagRecord {
  key: string;
  label: string;
  group: string;
  description: string;
  enabled: boolean;
  overridden?: boolean;
  global_enabled?: boolean;
}

interface FlagsState {
  flags: Record<string, boolean>;
  records: FlagRecord[];
  loaded: boolean;
}

const initialState: FlagsState = {
  flags: {},
  records: [],
  loaded: false,
};

export const fetchFlags = createAsyncThunk(
  'flags/fetch',
  async (_, { getState }) => {
    const state = getState() as any;
    const user = state.auth?.user;
    // Authenticated customer/vendor gets merged (global + user overrides)
    if (user && user.role !== 'admin') {
      const res = await api.get('/users/me/flags');
      return res.data as FlagRecord[];
    }
    // Admin and unauthenticated get raw global flags
    const res = await api.get('/admin/flags');
    return res.data as FlagRecord[];
  }
);

const flagsSlice = createSlice({
  name: 'flags',
  initialState,
  reducers: {
    setFlag(state, action: PayloadAction<{ key: string; enabled: boolean }>) {
      state.flags[action.payload.key] = action.payload.enabled;
      const rec = state.records.find((r) => r.key === action.payload.key);
      if (rec) rec.enabled = action.payload.enabled;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchFlags.fulfilled, (state, action) => {
      state.records = action.payload;
      state.flags = {};
      for (const f of action.payload) {
        state.flags[f.key] = f.enabled;
      }
      state.loaded = true;
    });
  },
});

export const { setFlag } = flagsSlice.actions;
export default flagsSlice.reducer;
