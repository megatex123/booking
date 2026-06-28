import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isLocal =
  typeof window === 'undefined' || window.location.hostname === 'localhost';
const BASE_URL = isLocal
  ? 'http://localhost:8000/api/v1'
  : 'https://bengkil-lah-api.percubaan.com/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let _unauthorizedHandler: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { _unauthorizedHandler = fn; };

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('user');
      _unauthorizedHandler?.();
    }
    return Promise.reject(err);
  }
);

export const authAPI = {
  loginUser: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  registerCustomer: (data: object) =>
    api.post('/auth/register/customer', data),
  registerWorkshop: (data: object) =>
    api.post('/auth/register/workshop', data),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (email: string, otp: string, new_password: string) =>
    api.post('/auth/reset-password', { email, otp, new_password }),
  changePassword: (current_password: string, new_password: string) =>
    api.patch('/auth/change-password', { current_password, new_password }),
};

export const userAPI = {
  getMe: () => api.get('/users/me'),
  updateProfile: (data: object) => api.patch('/users/me', data),
  getVehicles: () => api.get('/users/me/vehicles'),
  getOnlineStatus: (userIds: string[]) => api.get('/users/online-status', { params: { user_ids: userIds } }),
};

export const workshopAPI = {
  getNearby: (lat: number, lng: number, radius = 10, category?: string, panel_provider?: string) =>
    api.get('/workshops/nearby', { params: { latitude: lat, longitude: lng, radius_km: radius, category, panel_provider } }),
  getById: (id: string) => api.get(`/workshops/${id}`),
  getMyWorkshop: () => api.get('/workshops/my/profile'),
  updateMyWorkshop: (data: object) => api.patch('/workshops/my/profile', data),
  addService: (data: object) => api.post('/workshops/my/services', data),
  updateService: (id: string, data: object) => api.patch(`/workshops/my/services/${id}`, data),
  deleteService: (id: string) => api.delete(`/workshops/my/services/${id}`),
  getProducts: () => api.get('/workshops/my/products'),
  addProduct: (data: object) => api.post('/workshops/my/products', data),
  updateProduct: (id: string, data: object) => api.patch(`/workshops/my/products/${id}`, data),
  deleteProduct: (id: string) => api.delete(`/workshops/my/products/${id}`),
  getStations: () => api.get('/workshops/my/stations'),
  addStation: (data: object) => api.post('/workshops/my/stations', data),
  updateStation: (id: string, data: object) => api.patch(`/workshops/my/stations/${id}`, data),
  deleteStation: (id: string) => api.delete(`/workshops/my/stations/${id}`),
  getMechanics: () => api.get('/workshops/my/mechanics'),
  addMechanic: (data: object) => api.post('/workshops/my/mechanics', data),
  updateMechanic: (id: string, data: object) => api.patch(`/workshops/my/mechanics/${id}`, data),
  deleteMechanic: (id: string) => api.delete(`/workshops/my/mechanics/${id}`),
  getAnalytics: (months = 6) => api.get('/workshops/my/analytics', { params: { months } }),
  getCustomers: () => api.get('/workshops/my/customers'),
  updatePanel: (data: object) => api.patch('/workshops/my/panel', data),
  getQueue: (id: string) => api.get(`/workshops/${id}/queue`),
  getPromotions: () => api.get('/workshops/my/promotions'),
  createPromotion: (data: object) => api.post('/workshops/my/promotions', data),
  updatePromotion: (id: string, data: object) => api.patch(`/workshops/my/promotions/${id}`, data),
  deletePromotion: (id: string) => api.delete(`/workshops/my/promotions/${id}`),
};

export const bookingAPI = {
  rescheduleBooking: (id: string, scheduled_date: string, scheduled_time: string) =>
    api.patch(`/bookings/${id}/reschedule`, { scheduled_date, scheduled_time }),
  create: (data: object) => api.post('/bookings/', data),
  getMyBookings: (status?: string) =>
    api.get('/bookings/my', { params: status ? { status } : {} }),
  getById: (id: string) => api.get(`/bookings/${id}`),
  updateStatus: (id: string, data: object) => api.patch(`/bookings/${id}/status`, data),
  cancel: (id: string) => api.patch(`/bookings/${id}/cancel`),
  assignStation: (id: string, station_id: string | null) =>
    api.patch(`/bookings/${id}/station`, { station_id }),
  downloadInvoice: (id: string) =>
    api.get(`/bookings/${id}/invoice`, { responseType: 'blob' }),
  submitInsuranceClaim: (id: string, data: object) => api.patch(`/bookings/${id}/insurance`, data),
  updateInsuranceStatus: (id: string, data: object) => api.patch(`/bookings/${id}/insurance-status`, data),
  getVehicleHealth: () => api.get('/bookings/vehicle-health'),
};

export const chatAPI = {
  getMessages: (bookingId: string) => api.get(`/chat/${bookingId}/messages`),
  sendMessage: (bookingId: string, content: string) =>
    api.post(`/chat/${bookingId}/messages`, { booking_id: bookingId, content }),
};

export const reviewAPI = {
  create: (data: object) => api.post('/reviews/', data),
  getMyReviews: () => api.get('/reviews/my'),
  getWorkshopReviews: (workshopId: string) => api.get(`/reviews/workshop/${workshopId}`),
  getBookingReview: (bookingId: string) => api.get(`/reviews/booking/${bookingId}`),
};

export const notificationAPI = {
  getNotifications: () => api.get('/notifications/'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

export const paymentAPI = {
  createIntent: (bookingId: string) => api.post(`/payments/create-intent/${bookingId}`),
  confirmPayment: (bookingId: string) => api.post(`/payments/confirm/${bookingId}`),
};

export const referralAPI = {
  getMyCode: () => api.get('/referrals/my-code'),
  validate: (code: string) => api.post('/referrals/validate', { code }),
  getHistory: () => api.get('/referrals/history'),
};

export const loyaltyAPI = {
  getBalance: () => api.get('/loyalty/balance'),
  getHistory: () => api.get('/loyalty/history'),
};

export const serviceLogAPI = {
  list: (plate?: string) => api.get('/service-logs/', { params: plate ? { plate } : {} }),
  create: (data: {
    vehicle_plate: string; service_date: string; location: string;
    services: string[]; notes?: string; mileage?: number;
    cost?: number; next_service_months?: number;
  }) => api.post('/service-logs/', data),
  update: (id: string, data: object) => api.patch(`/service-logs/${id}`, data),
  remove: (id: string) => api.delete(`/service-logs/${id}`),
};

export const reminderAPI = {
  list: () => api.get('/reminders/'),
  create: (data: { vehicle_plate: string; vehicle_name?: string; reminder_date: string; label?: string }) =>
    api.post('/reminders/', data),
  update: (id: string, data: { reminder_date?: string; label?: string }) =>
    api.patch(`/reminders/${id}`, data),
  remove: (id: string) => api.delete(`/reminders/${id}`),
};

export const scheduleAPI = {
  list: (params?: { date_from?: string; date_to?: string }) =>
    api.get('/workshops/my/schedules/', { params }),
  today: () => api.get('/workshops/my/schedules/today'),
  create: (data: {
    mechanic_id: string; date: string; shift: string;
    status?: string; notes?: string;
  }) => api.post('/workshops/my/schedules/', data),
  update: (id: string, data: { shift?: string; status?: string; notes?: string }) =>
    api.patch(`/workshops/my/schedules/${id}`, data),
  remove: (id: string) => api.delete(`/workshops/my/schedules/${id}`),
};

export const corporateAPI = {
  register: (data: object) => api.post('/corporate/register', data),
  getMy: () => api.get('/corporate/my'),
  update: (data: object) => api.patch('/corporate/my', data),
  addVehicle: (data: object) => api.post('/corporate/vehicles', data),
  updateVehicle: (id: string, data: object) => api.patch(`/corporate/vehicles/${id}`, data),
  deleteVehicle: (id: string) => api.delete(`/corporate/vehicles/${id}`),
  inviteDriver: (email: string) => api.post('/corporate/drivers/invite', { email }),
  removeDriver: (driverId: string) => api.delete(`/corporate/drivers/${driverId}`),
  getBilling: (month?: string) => api.get('/corporate/billing', { params: month ? { month } : {} }),
};

export const uploadAPI = {
  uploadFile: async (uri: string, mimeType: string, filename: string): Promise<string> => {
    const formData = new FormData();
    // On web, uri is a data URL or blob URL — fetch + blob it
    if (uri.startsWith('data:') || uri.startsWith('blob:') || uri.startsWith('http')) {
      const res = await fetch(uri);
      const blob = await res.blob();
      formData.append('file', blob, filename);
    } else {
      // React Native native path
      formData.append('file', { uri, type: mimeType, name: filename } as any);
    }
    const token = await (await import('@react-native-async-storage/async-storage')).default.getItem('access_token');
    const response = await fetch(`${BASE_URL}/uploads/`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Upload failed');
    }
    const data = await response.json();
    return data.url as string; // e.g. "/uploads/abc123.jpg"
  },
  mediaUrl: (path: string) => `http://localhost:8000${path}`,
  getFullUrl: (path: string) => path.startsWith('http') ? path : `http://localhost:8000${path}`,
};
