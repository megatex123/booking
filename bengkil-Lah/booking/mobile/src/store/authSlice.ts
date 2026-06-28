import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { User } from '../types';
import { authAPI } from '../services/api';
import { saveToken, saveUser, clearAuth } from '../services/storage';
import { connectSocket, disconnectSocket } from '../services/socket';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  loading: false,
  error: null,
};

export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const res = await authAPI.loginUser(email, password);
      return res.data;
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail || 'Login failed');
    }
  }
);

export const registerCustomer = createAsyncThunk(
  'auth/registerCustomer',
  async (data: object, { rejectWithValue }) => {
    try {
      const res = await authAPI.registerCustomer(data);
      return res.data;
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail || 'Registration failed');
    }
  }
);

export const registerWorkshop = createAsyncThunk(
  'auth/registerWorkshop',
  async (data: object, { rejectWithValue }) => {
    try {
      const res = await authAPI.registerWorkshop(data);
      return res.data;
    } catch (e: any) {
      return rejectWithValue(e.response?.data?.detail || 'Registration failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      clearAuth();
      disconnectSocket();
    },
    clearError: (state) => {
      state.error = null;
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    const handlePending = (state: AuthState) => {
      state.loading = true;
      state.error = null;
    };
    const handleFulfilled = (state: AuthState, action: any) => {
      state.loading = false;
      state.token = action.payload.access_token;
      state.user = action.payload.user;
      saveToken(action.payload.access_token);
      saveUser(action.payload.user);
      connectSocket();
    };
    const handleRejected = (state: AuthState, action: any) => {
      state.loading = false;
      state.error = action.payload as string;
    };

    builder
      .addCase(loginUser.pending, handlePending)
      .addCase(loginUser.fulfilled, handleFulfilled)
      .addCase(loginUser.rejected, handleRejected)
      .addCase(registerCustomer.pending, handlePending)
      .addCase(registerCustomer.fulfilled, handleFulfilled)
      .addCase(registerCustomer.rejected, handleRejected)
      .addCase(registerWorkshop.pending, handlePending)
      .addCase(registerWorkshop.fulfilled, handleFulfilled)
      .addCase(registerWorkshop.rejected, handleRejected);
  },
});

export const { setAuth, logout, clearError, updateUser } = authSlice.actions;
export default authSlice.reducer;
