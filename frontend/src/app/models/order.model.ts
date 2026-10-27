export type PaymentMethod = 'COD' | 'UPI';
export type AddressType = 'Home' | 'Work';

// Same names as the OrderStatus enum in Order.cs
export type OrderStatus = 'Placed' | 'Packed' | 'Shipped' | 'Delivered' | 'Cancelled';

export interface DeliveryAddress {
  fullName: string;
  mobile: string;
  pincode: string;
  city: string;
  state: string;
  house: string;
  area: string;
  landmark: string;
  addressType: AddressType;
}

// What the checkout sends
export interface PlaceOrderRequest {
  items: { productId: number; size: string; quantity: number }[];
  address: DeliveryAddress;
  paymentMethod: PaymentMethod;
}

// What the API returns
export interface OrderItem {
  productId: number;
  brand: string;
  name: string;
  imageUrl: string;
  size: string;
  quantity: number;
  price: number;
  mrp: number;
}

export interface StatusChange {
  status: OrderStatus;
  at: string;               // when the order reached this status
}

export interface Order {
  id: number;
  orderNumber: string;      // "KY-1001"
  placedAt: string;
  expectedDelivery: string;
  status: OrderStatus;
  history: StatusChange[];
  nextStatuses: OrderStatus[];   // where the admin may move it next
  items: OrderItem[];
  address: DeliveryAddress;
  paymentMethod: PaymentMethod;
  totalMrp: number;
  subtotal: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
}