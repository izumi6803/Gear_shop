import { useI18n } from '../i18n/I18nContext';

const CLASS: Record<string, string> = {
  Draft: 'status-draft',
  Confirmed: 'status-confirmed',
  Shipped: 'status-shipped',
  Cancelled: 'status-cancelled',
};

const KEY: Record<string, string> = {
  Draft: 'status.draft',
  Confirmed: 'status.confirmed',
  Shipped: 'status.shipped',
  Cancelled: 'status.cancelled',
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const className = CLASS[status] ?? 'status-draft';
  const label = KEY[status] ? t(KEY[status]) : status;

  return <span className={`status-pill ${className}`}>{label}</span>;
}
