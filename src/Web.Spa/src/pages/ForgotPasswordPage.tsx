import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { forgotPassword } from '../api/ordering';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useI18n } from '../i18n/I18nContext';

interface ForgotResult {
  // Giữ nguyên chuỗi người dùng nhập để hiển thị lại trong thông báo.
  identifier: string;
  // Token chỉ có ở môi trường demo; production thường gửi qua email.
  token: string | null;
}

export function ForgotPasswordPage() {
  const { t } = useI18n();

  const [identifier, setIdentifier] = useState('');
  const [result, setResult] = useState<ForgotResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Trang này vô hại cả khi đã đăng nhập → không redirect, chỉ tạo yêu cầu đặt lại.
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await forgotPassword(identifier.trim());
      setResult({
        identifier,
        token: response.resetToken ?? null,
      });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-hero">
        <h1>StockFlow</h1>
        <p className="login-hero-sub">{t('auth.forgotSubtitle')}</p>
      </section>

      <section className="login-panel">
        <div className="login-panel-top">
          <LanguageSwitcher />
        </div>

      <form className="login-card" onSubmit={onSubmit} noValidate autoComplete="off">
        <h2>{t('auth.forgotTitle')}</h2>
        <p className="text-muted small mb-3">{t('auth.forgotSubtitle')}</p>

        {error ? (
          <div className="alert alert-danger py-2 small" role="alert" data-testid="forgot-error">
            {error}
          </div>
        ) : null}

        {result ? (
          <div data-testid="forgot-result">
            <p className="small mb-3">{t('auth.resetSent', { name: result.identifier })}</p>

            {result.token ? (
              <>
                <p className="form-label mb-1">{t('auth.resetTokenLabel')}</p>
                <code className="d-block mb-2" data-testid="forgot-token">
                  {result.token}
                </code>
                <p className="text-muted small mb-3">{t('auth.resetHint')}</p>
                <Link
                  to={`/reset-password?token=${result.token}`}
                  className="btn btn-primary w-100"
                  data-testid="forgot-open-reset"
                >
                  {t('auth.openReset')}
                </Link>
              </>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mb-3">
              <label className="form-label" htmlFor="identifier">
                {t('auth.identifier')}
              </label>
              <input
                id="identifier"
                className="form-control"
                value={identifier}
                autoComplete="off"
                data-testid="forgot-identifier"
                onChange={(event) => setIdentifier(event.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={busy}
              data-testid="forgot-submit"
            >
              {t('auth.sendReset')}
            </button>
          </>
        )}

        <p className="text-center small text-muted mt-3 mb-0">
          <Link to="/login" data-testid="forgot-back">
            {t('auth.backToLogin')}
          </Link>
        </p>
      </form>
      </section>
    </div>
  );
}
