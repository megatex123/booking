export type UserRole = 'customer' | 'workshop';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar?: string;
  address?: string;
  created_at: string;
}

export interface Vehicle {
  name: string;
  plate: string;
  brand: string;
  year?: number;
  color?: string;
}

export interface WorkshopService {
  _id: string;
  name: string;
  description?: string;
  price: number;
  duration_minutes: number;
  category: string;
  is_active: boolean;
}

export interface WorkingHours {
  open: string;
  close: string;
  is_open: boolean;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  ends_at: string;
  discount_type?: 'percentage' | 'fixed' | null;
  discount_value?: number | null;
}

export interface WorkshopImage {
  url: string;
  category: string;
  caption?: string;
}

export const PHOTO_CATEGORY_LABELS: Record<string, string> = {
  exterior:     'Exterior',
  reception:    'Reception',
  lift_bays:    'Lift Bays',
  equipment:    'Equipment',
  waiting_area: 'Waiting Area',
  team:         'Our Team',
  other:        'Other',
};

export interface Workshop {
  id: string;
  owner_id: string;
  workshop_name: string;
  description?: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
  distance_km?: number;
  rating: number;
  total_reviews: number;
  is_open: boolean;
  open_hour?: string;
  close_hour?: string;
  working_hours: Record<string, WorkingHours>;
  images: WorkshopImage[];
  services: WorkshopService[];
  is_panel_workshop?: boolean;
  panel_providers?: string[];
  queue_snapshot?: {
    total_stations: number;
    active_jobs: number;
    available_stations: number;
    est_wait_minutes: number | null;
    avg_job_duration: number;
    updated_at: string;
  };
  active_promotions?: Promotion[];
  created_at: string;
}

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'paid';

export interface Booking {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  workshop_id: string;
  workshop_name: string;
  workshop_address: string;
  services: WorkshopService[];
  vehicle_plate: string;
  vehicle_name: string;
  vehicle_brand: string;
  scheduled_date: string;
  scheduled_time: string;
  notes?: string;
  status: BookingStatus;
  total_price: number;
  services_total?: number;
  products_total?: number;
  referral_discount?: number;
  promotion_discount?: number;
  promotion_title?: string;
  loyalty_points_used?: number;
  loyalty_discount?: number;
  loyalty_points_earned?: number;
  payment_status: PaymentStatus;
  payment_intent_id?: string;
  completion_notes?: string;
  next_service_months?: number;
  station_id?: string;
  has_review?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  booking_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: UserRole;
  content: string;
  created_at: string;
  is_read: boolean;
}

export interface Review {
  id: string;
  booking_id: string;
  workshop_id: string;
  customer_id: string;
  customer_name: string;
  rating: number;
  comment?: string;
  created_at: string;
}
