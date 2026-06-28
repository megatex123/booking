import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Workshop } from '../types';

const MAX = 3;

const compareSlice = createSlice({
  name: 'compare',
  initialState: { items: [] as Workshop[] },
  reducers: {
    toggleCompare(state, action: PayloadAction<Workshop>) {
      const w = action.payload;
      const idx = state.items.findIndex((x) => x.id === w.id);
      if (idx >= 0) {
        state.items.splice(idx, 1);
      } else if (state.items.length < MAX) {
        state.items.push(w);
      }
    },
    removeFromCompare(state, action: PayloadAction<string>) {
      state.items = state.items.filter((w) => w.id !== action.payload);
    },
    clearCompare(state) {
      state.items = [];
    },
  },
});

export const { toggleCompare, removeFromCompare, clearCompare } = compareSlice.actions;
export default compareSlice.reducer;
