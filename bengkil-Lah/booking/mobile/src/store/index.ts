import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';
import authReducer from './authSlice';
import bookingReducer from './bookingSlice';
import workshopReducer from './workshopSlice';
import notificationReducer from './notificationSlice';
import favouriteReducer from './favouriteSlice';
import compareReducer from './compareSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    bookings: bookingReducer,
    workshops: workshopReducer,
    notifications: notificationReducer,
    favourites: favouriteReducer,
    compare: compareReducer,
  },
  middleware: (getDefault) => getDefault({ serializableCheck: false }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
