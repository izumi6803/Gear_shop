import { useI18n } from '../i18n/I18nContext';
import { Icon, type IconName } from './Icon';

interface LoadingProps {
  label?: string;
}

export function Loading({ label }: LoadingProps) {
  const { t } = useI18n();

  return (
    <div className="app-loading">
      <span className="spinner-border spinner-border-sm text-primary" aria-hidden="true" />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}

export function ErrorPanel({
  message,
  onRetry,
  retryLabel,
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  const { t } = useI18n();

  return (
    <div className="alert alert-danger d-flex align-items-center justify-content-between" role="alert">
      <span>
        <Icon name="warning" className="me-2" />
        {message}
      </span>
      {onRetry ? (
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={onRetry}>
          {retryLabel ?? t('common.retry')}
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  message,
  hint,
  icon = 'inbox',
}: {
  message: string;
  hint?: string;
  icon?: IconName;
}) {
  return (
    <div className="app-empty">
      <Icon name={icon} size={28} />
      <p className="mb-1">{message}</p>
      {hint ? <small className="text-muted">{hint}</small> : null}
    </div>
  );
}
