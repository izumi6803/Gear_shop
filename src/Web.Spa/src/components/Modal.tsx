import { useEffect, type ReactNode } from 'react';
import { useI18n } from '../i18n/I18nContext';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}

export function Modal({ title, onClose, children, footer, size = 'lg' }: ModalProps) {
  const { t } = useI18n();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="app-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`app-modal app-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="app-modal-header">
          <h2 className="h6 mb-0">{title}</h2>
          <button type="button" className="btn-close" aria-label={t('common.close')} onClick={onClose} />
        </header>
        <div className="app-modal-body">{children}</div>
        {footer ? <footer className="app-modal-footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
