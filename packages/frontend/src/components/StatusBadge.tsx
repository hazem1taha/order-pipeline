const COLORS: Record<string, string> = {
  received: 'bg-gray-600',
  validated: 'bg-blue-600',
  enriched: 'bg-purple-600',
  completed: 'bg-green-600',
  failed: 'bg-red-600',
};

interface Props {
  status: string;
}

export function StatusBadge({ status }: Props) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono text-white ${COLORS[status] ?? 'bg-gray-500'}`}>
      {status}
    </span>
  );
}
