from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class WorkingHours(BaseModel):
    open: str = "08:00"
    close: str = "17:00"
    is_open: bool = True


class WorkshopService(BaseModel):
    name: str
    description: Optional[str] = ""
    price: float
    duration_minutes: int = 60
    category: str  # oil_change, tire, brake, engine, body, electrical, other


class DefaultProduct(BaseModel):
    product_id: str
    quantity: float = 1


class WorkshopServiceCreate(WorkshopService):
    default_products: Optional[List[DefaultProduct]] = []


class WorkshopServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    duration_minutes: Optional[int] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None
    default_products: Optional[List[DefaultProduct]] = None


class ProductCreate(BaseModel):
    name: str
    brand: Optional[str] = ""
    category: str  # lubricant, brake, filter, tyre, electrical, body, other
    price: float
    quantity: float = 0
    unit: str = "pcs"  # pcs, litre, kg, set
    description: Optional[str] = ""
    service_tags: Optional[List[str]] = []  # service names this product is commonly used for
    reorder_threshold: float = 0


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    description: Optional[str] = None
    service_tags: Optional[List[str]] = None
    reorder_threshold: Optional[float] = None


class RepairStationCreate(BaseModel):
    name: str
    description: Optional[str] = ""


class RepairStationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


PHOTO_CATEGORIES = ["exterior", "reception", "lift_bays", "equipment", "waiting_area", "team", "other"]


class WorkshopImage(BaseModel):
    url: str
    category: str = "other"  # one of PHOTO_CATEGORIES
    caption: Optional[str] = ""


class WorkshopUpdate(BaseModel):
    workshop_name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    working_hours: Optional[dict] = None
    images: Optional[List[WorkshopImage]] = None
    is_open: Optional[bool] = None
    open_hour: Optional[str] = None
    close_hour: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class WorkshopResponse(BaseModel):
    id: str
    owner_id: str
    workshop_name: str
    description: Optional[str] = ""
    address: str
    phone: str
    latitude: float
    longitude: float
    distance_km: Optional[float] = None
    rating: float = 0.0
    total_reviews: int = 0
    is_open: bool = True
    working_hours: dict = {}
    images: List[str] = []
    services: List[dict] = []
    created_at: datetime


class NearbyWorkshopsQuery(BaseModel):
    latitude: float
    longitude: float
    radius_km: float = 10.0
    category: Optional[str] = None


class MechanicCreate(BaseModel):
    name: str
    phone: Optional[str] = ""
    specialty: Optional[str] = ""   # e.g. "Engine", "Electrical"
    is_active: bool = True


class MechanicUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    specialty: Optional[str] = None
    is_active: Optional[bool] = None


PANEL_PROVIDERS = ["takaful", "etiqa", "allianz", "axa", "msig", "berjaya_sompo", "zurich", "lonpac"]


class WorkshopPanelUpdate(BaseModel):
    is_panel_workshop: bool
    panel_providers: Optional[List[str]] = []  # subset of PANEL_PROVIDERS


class PromotionCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    ends_at: str  # ISO 8601 datetime e.g. "2024-12-31T23:59:59"
    discount_type: Optional[str] = None   # "percentage" | "fixed"
    discount_value: Optional[float] = None  # e.g. 15 (%) or 20 (RM)


class PromotionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    ends_at: Optional[str] = None
    is_active: Optional[bool] = None
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
