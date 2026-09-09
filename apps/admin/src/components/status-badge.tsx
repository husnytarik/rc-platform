import { ORDER_STATUS_LABELS_TR, ORDER_STATUS_META, type OrderStatus } from '@rc/shared';
import type { ReactNode } from 'react';

export function StatusBadge({ status }: { status: OrderStatus }): ReactNode {
  const meta = ORDER_STATUS_META[status];
  return (
    <span className="badge" style={{ color: meta.color }}>
      <span className="badge__dot" />
      {ORDER_STATUS_LABELS_TR[status]}
    </span>
  );
}
