import { useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { type Order } from '../api/client';
import { OrderDetail } from './OrderDetail';

interface Props {
  orders: Order[];
  onSelect: (order: Order) => void;
}

export function OrderList({ orders, onSelect }: Props) {
  const [selected, setSelected] = useState<Order | null>(null);

  if (orders.length === 0) {
    return <div className="text-zinc-500 text-sm text-center py-8">No orders yet. Submit one to get started.</div>;
  }

  return (
    <div className="space-y-2">
      {selected && (
        <div className="border border-zinc-700 rounded p-4 mb-4">
          <OrderDetail order={selected} onClose={() => setSelected(null)} />
        </div>
      )}
      {orders.map((order) => (
        <div
          key={order.orderId}
          onClick={() => { setSelected(order); onSelect(order); }}
          className="flex items-center gap-3 bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 rounded px-3 py-2 cursor-pointer text-xs font-mono"
        >
          <StatusBadge status={order.status} />
          <span className="text-zinc-400 truncate">{order.orderId}</span>
          <span className="text-zinc-500 truncate">{order.customer.email}</span>
          <span className="text-zinc-600 ml-auto">{new Date(order.createdAt).toLocaleTimeString()}</span>
        </div>
      ))}
    </div>
  );
}
