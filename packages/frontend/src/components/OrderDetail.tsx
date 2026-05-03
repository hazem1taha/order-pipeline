import { useState } from 'react';
import { type Order } from '../api/client';
import { StatusBadge } from './StatusBadge';

interface Props {
  order: Order;
  onClose: () => void;
}

export function OrderDetail({ order, onClose }: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const timestamps = [
    { label: 'created', value: order.createdAt },
    { label: 'validated', value: order.validatedAt },
    { label: 'enriched', value: order.enrichedAt },
    { label: 'completed', value: order.completedAt },
    { label: 'failed', value: order.failedAt },
  ].filter(t => t.value);

  return (
    <div className="space-y-4 text-xs font-mono">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} />
          <span className="text-zinc-400">{order.orderId}</span>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white">✕</button>
      </div>

      <div className="space-y-1">
        {timestamps.map(t => (
          <div key={t.label} className="flex gap-2">
            <span className="text-zinc-500 w-20">{t.label}:</span>
            <span className="text-zinc-300">{new Date(t.value!).toLocaleString()}</span>
          </div>
        ))}
        {order.failureReason && (
          <div className="text-red-400 mt-2">Failure: {order.failureReason}</div>
        )}
      </div>

      <details className="cursor-pointer">
        <summary onClick={(e) => { e.preventDefault(); setShowRaw(!showRaw); }} className="text-zinc-500 hover:text-zinc-300">
          {showRaw ? 'Hide' : 'Show'} raw event payload
        </summary>
        {showRaw && (
          <pre className="mt-2 p-2 bg-zinc-900 rounded overflow-x-auto text-zinc-400 text-[10px] max-h-64 overflow-y-auto">
            {JSON.stringify(order, null, 2)}
          </pre>
        )}
      </details>
    </div>
  );
}
