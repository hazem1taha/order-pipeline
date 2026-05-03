const API_BASE = 'http://localhost:3000/local/orders';

export interface Customer {
  customerId: string;
  email: string;
}

export interface LineItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  productName?: string;
  category?: string;
}

export interface Order {
  orderId: string;
  tenantId: string;
  customer: Customer;
  lineItems: LineItem[];
  status: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  validatedAt?: string;
  enrichedAt?: string;
  completedAt?: string;
  failedAt?: string;
  failureReason?: string;
}

class ApiError extends Error {
  constructor(public statusCode: number, body: unknown) {
    super(JSON.stringify(body));
    this.name = 'ApiError';
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body);
  }
  return body as T;
}

export const api = {
  submitOrder: (order: Omit<Order, 'orderId' | 'status' | 'createdAt' | 'updatedAt'>) =>
    request<Order>(`${API_BASE}`, {
      method: 'POST',
      body: JSON.stringify(order),
    }),

  getOrder: (orderId: string, tenantId: string) =>
    request<Order>(`${API_BASE}/${orderId}?tenantId=${encodeURIComponent(tenantId)}`),

  listOrders: (tenantId: string, status?: string) => {
    const params = new URLSearchParams({ tenantId });
    if (status) params.set('status', status);
    return request<Order[]>(`${API_BASE}?${params.toString()}`);
  },
};
