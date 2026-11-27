// Kiểu dữ liệu mirror từ StockFlow.Inventory.Contracts (BE) — cùng shape JSON (camelCase).

export interface Product {
  id: number;
  code: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  isActive: boolean;
  imageUrl?: string | null;
}

export interface Stock {
  productId: number;
  productCode: string;
  productName: string;
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  quantityOnHand: number;
  quantityReserved: number;
  available: number;
}

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  location: string;
  isActive: boolean;
}

export interface Customer {
  id: number;
  code: string;
  name: string;
  nameKana?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
}

export type OrderStatus = 'Draft' | 'Confirmed' | 'Shipped' | 'Cancelled';

export interface OrderLine {
  id: number;
  productId: number;
  productCode: string;
  productName: string;
  warehouseId: number;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
}

export interface Order {
  id: number;
  orderNo: string;
  customerId: number;
  customerName: string;
  orderDate: string;
  status: OrderStatus;
  subTotal: number;
  taxAmount: number;
  totalAmount: number;
  note?: string | null;
  createdAt: string;
  confirmedAt?: string | null;
  shippedAt?: string | null;
  lines: OrderLine[];
  paymentStatus?: 'Unpaid' | 'Paid' | 'Refunded';
  paidAt?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  shippingFee?: number;
}

export interface Invoice {
  id: number;
  invoiceNo: string;
  orderNo: string;
  issuedAt: string;
  dueDate: string;
  amount: number;
  taxAmount: number;
  status: string;
  shippingFee?: number;
}

/** Hoá đơn đầy đủ để in tax invoice (đủ 6 mục the tax authority yêu cầu). */
export interface InvoiceDetail extends Invoice {
  orderId: number;
  orderDate: string;
  customerName: string;
  customerAddress?: string | null;
  subTotal: number;
  lines: OrderLine[];
}

/** Seller profile printed on invoices. */
export interface CompanyProfile {
  name: string;
  addressLine: string;
  city: string;
  postalCode: string;
  country: string;
  email: string;
  phone: string;
  taxId: string;
  bankAccount: string;
  paymentTerms: string;
  currency: string;
}

export interface ShipResult {
  order: Order;
  invoice: Invoice;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface LoginResponse {
  accessToken: string;
  expiresAt: string;
  displayName: string;
  role: string;
}

export interface CreateOrderLineInput {
  productId: number;
  warehouseId: number;
  quantity: number;
}

export interface CreateOrderInput {
  customerId: number;
  orderDate: string;
  lines: CreateOrderLineInput[];
  note?: string | null;
}

// ---------- Marketplace ----------

export interface Account {
  id: number;
  username: string;
  displayName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  customerId?: number | null;
}

export interface CreateAccountInput {
  username: string;
  password: string;
  displayName: string;
  role: string;
}

export interface UpdateAccountInput {
  displayName?: string | null;
  role?: string | null;
  isActive?: boolean | null;
}

export interface ShopStats {
  ordersTotal: number;
  ordersDraft: number;
  ordersConfirmed: number;
  ordersShipped: number;
  ordersCancelled: number;
  ordersUnpaid: number;
  revenuePaid: number;
  customers: number;
  accounts: number;
}

export interface RegisterInput {
  username: string;
  password: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface CheckoutLineInput {
  productId: number;
  warehouseId: number;
  quantity: number;
}

export interface PayInput {
  method: string;
  cardNumber: string;
  cardHolder: string;
  expiry: string;
  cvv: string;
}

export interface ProductUpsertInput {
  code: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  isActive?: boolean;
  imageUrl?: string | null;
}