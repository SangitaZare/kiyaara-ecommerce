import { Order } from './order.model';
import { Product } from './product.model';

// Same fields as DashboardSummary.cs
export interface DashboardSummary {
  ordersToday: number;
  salesToday: number;
  waitingToPack: number;
  onTheWay: number;

  productCount: number;
  inStock: number;
  runningLow: number;
  soldOut: number;
  stockValue: number;

  recentOrders: Order[];
  needsAttention: Product[];
}