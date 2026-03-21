/**
 * Shared types between parts-store client and server.
 */

export interface StoreUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  role: string;
}

export interface AuthResponse {
  user: StoreUser;
  accessToken: string;
  refreshToken: string;
}

export interface CatalogPart {
  id: string;
  name: string;
  partNumber: string;
  salePrice: string;
  purchasePrice: string;
  quantity: number;
  description: string | null;
  longDescription: string | null;
  manufacturer: string | null;
  category: string | null;
  imageUrl: string | null;
  condition: string;
  weight: string | null;
  isOversized: boolean;
  isFeatured: boolean;
  images?: PartImage[];
  partNumbers?: PartNumberInfo[];
  compatibility?: VehicleCompatibilityInfo[];
}

export interface PartImage {
  id: string;
  imageUrl: string;
  sortOrder: number;
  altText: string | null;
  isPrimary: boolean;
}

export interface PartNumberInfo {
  id: string;
  partNumber: string;
  numberType: string;
  brand: string | null;
  isPrimary: boolean | null;
}

export interface VehicleCompatibilityInfo {
  id: string;
  make: string;
  model: string;
  yearStart: number;
  yearEnd: number;
  trim: string | null;
  engineType: string | null;
}

export interface CartItem {
  id: string;
  partId: string;
  quantity: number;
  priceAtAddTime: string;
  part: {
    name: string;
    partNumber: string;
    salePrice: string;
    quantity: number;
    imageUrl: string | null;
    isOversized: boolean;
  };
}

export interface Cart {
  id: string;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
}

export interface DeliveryZoneInfo {
  id: string;
  name: string;
  parishes: string[];
  deliveryFee: string;
  oversizedSurcharge: string;
  estimatedDays: number;
}

export interface StoreSettingsPublic {
  returnWindowDays: number;
  defectiveReturnWindowDays: number;
  maxQuantityPerItem: number;
  maxItemsPerOrder: number;
  currency: string;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: string;
  total: string;
  itemCount: number;
  createdAt: string;
  deliveryMethod: string;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  deliveryMethod: string;
  deliveryAddress: string | null;
  deliveryParish: string | null;
  deliveryFee: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  trackingNumber: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  staffNotes: string | null;
  items: OrderItem[];
  placedAt: string | null;
  confirmedAt: string | null;
  packedAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
}

export interface OrderItem {
  id: string;
  partName: string;
  partNumber: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

export interface ReturnSummary {
  id: string;
  returnNumber: string;
  orderId: string;
  orderNumber: string;
  status: string;
  reason: string;
  createdAt: string;
}

export interface StoreStats {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  returnRate: number;
}
