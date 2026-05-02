import { useState } from 'react';
import { api, type Customer, type LineItem } from '../api/client';

interface Props {
  tenantId: string;
  onSuccess: (order: import('../api/client').Order) => void;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function OrderForm({ tenantId, onSuccess }: Props) {
  const [customerId, setCustomerId] = useState('');
  const [email, setEmail] = useState('');
  const [items, setItems] = useState<LineItem[]>([{ productId: '', quantity: 1, unitPrice: 0 }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addItem = () => setItems([...items, { productId: '', quantity: 1, unitPrice: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof LineItem, value: string | number) =>
    setItems(items.map((item, idx) => (idx === i ? { ...item, [field]: value } : item)));

  const validate = () => {
    const errs: string[] = [];
    if (!tenantId) errs.push('tenantId required');
    if (!customerId) errs.push('customerId required');
    if (!emailRegex.test(email)) errs.push('valid email required');
    if (items.length === 0) errs.push('at least one item required');
    items.forEach((it, i) => {
      if (!it.productId) errs.push(`item ${i + 1}: productId required`);
      if (it.quantity <= 0) errs.push(`item ${i + 1}: quantity > 0`);
      if (it.unitPrice <= 0) errs.push(`item ${i + 1}: unitPrice > 0`);
    });
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const errs = validate();
    if (errs.length > 0) { setError(errs.join('; ')); return; }

    setLoading(true);
    try {
      const order = await api.submitOrder({
        tenantId,
        idempotencyKey: crypto.randomUUID(),
        customer: { customerId, email } as Customer,
        lineItems: items,
      });
      onSuccess(order);
      setCustomerId(''); setEmail('');
      setItems([{ productId: '', quantity: 1, unitPrice: 0 }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          Customer ID
          <input className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 font-mono text-xs" value={customerId} onChange={e => setCustomerId(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          Email
          <input className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 font-mono text-xs" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
      </div>

      <div className="space-y-2">
        <div className="text-xs text-zinc-400 uppercase tracking-wide">Line Items</div>
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-4 gap-2 items-end">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">Product ID</span>
              <input className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 font-mono text-xs" value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">Qty</span>
              <input className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 font-mono text-xs" type="number" min="1" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 0)} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500">Unit Price (cents)</span>
              <input className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 font-mono text-xs" type="number" min="0" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', parseInt(e.target.value) || 0)} />
            </label>
            <button type="button" onClick={() => removeItem(i)} className="text-red-400 text-xs mb-1">✕ Remove</button>
          </div>
        ))}
        <button type="button" onClick={addItem} className="text-xs text-blue-400">+ Add item</button>
      </div>

      {error && <div className="text-red-400 text-xs font-mono">{error}</div>}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white rounded py-2 text-sm font-medium transition-colors"
      >
        {loading ? 'Submitting...' : 'Submit Order'}
      </button>
    </form>
  );
}
