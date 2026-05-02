import { useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { OrderForm } from './components/OrderForm';
import { OrderList } from './components/OrderList';
import { type Order, api } from './api/client';

const queryClient = new QueryClient();

function TenantSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs font-mono">
      <span className="text-zinc-400 uppercase tracking-wide">Tenant:</span>
      <input
        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white font-mono"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="tenant-123"
      />
    </label>
  );
}

function OrderListWithPolling({ tenantId }: { tenantId: string }) {
  const { data: orders = [] } = useQuery({
    queryKey: ['orders', tenantId],
    queryFn: () => api.listOrders(tenantId),
    refetchInterval: (query) => {
      const allTerminal = query.state.data?.every(o => o.status === 'completed' || o.status === 'failed');
      return allTerminal ? false : 3000;
    },
    enabled: tenantId.length > 0,
  });

  return <OrderList orders={orders} onSelect={() => {}} />;
}

function AppContent() {
  const [tenantId, setTenantId] = useState('tenant-123');
  const [activeTab, setActiveTab] = useState<'submit' | 'orders'>('submit');
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium tracking-tight">Order Pipeline</h1>
          <TenantSelector value={tenantId} onChange={setTenantId} />
        </div>

        <div className="flex gap-1 border-b border-zinc-800">
          {(['submit', 'orders'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-medium capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab === 'submit' ? 'Submit Order' : 'Orders'}
            </button>
          ))}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          {activeTab === 'submit' ? (
            <OrderForm tenantId={tenantId} onSuccess={(order) => {
              setLastOrder(order);
              setActiveTab('orders');
            }} />
          ) : (
            <OrderListWithPolling tenantId={tenantId} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}
