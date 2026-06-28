import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'favourite_workshop_ids';

export const loadFavourites = createAsyncThunk('favourites/load', async () => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
});

const favouriteSlice = createSlice({
  name: 'favourites',
  initialState: { ids: [] as string[] },
  reducers: {
    toggleFavourite(state, action: PayloadAction<string>) {
      const id = action.payload;
      if (state.ids.includes(id)) {
        state.ids = state.ids.filter((i) => i !== id);
      } else {
        state.ids = [id, ...state.ids];
      }
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state.ids));
    },
  },
  extraReducers: (builder) => {
    builder.addCase(loadFavourites.fulfilled, (state, action) => {
      state.ids = action.payload;
    });
  },
});

export const { toggleFavourite } = favouriteSlice.actions;
export default favouriteSlice.reducer;
