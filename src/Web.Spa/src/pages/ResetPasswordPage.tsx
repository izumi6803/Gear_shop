import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { resetPassword } from '../api/ordering';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n/I18nContext';

export function ResetPasswordPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  // Token do trang quên mật khẩu sinh ra, truyền qua query string.
  const token = (searchParams.get('token') ?? '').trim();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    // Kiểm tra phía client trước khi gọi API để báo lỗi ngay.
    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    if (!token) {
      setError(t('auth.invalidToken'));
      return;
    }

    setBusy(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      toast(t('auth.resetDone'), 'success');
    } catch (cause) {
      // Backend trả thông báo tiếng Việt khi token sai/hết hạn → hiển thị nguyên văn.
      setError(cause instanceof ApiError ? cause.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-hero">
        <h1>StockFlow</h1>
        <p className="login-hero-sub">{t('auth.resetSubtitle')}</p>
      </section>

      <section className="login-panel">
        <div className="login-panel-top">
          <LanguageSwitcher />
        </div>

      <form className="login-card" onSubmit={onSubmit} noValidate autoComplete="off">
        <h2>{t('auth.resetTitle')}</h2>
        <p className="text-muted small mb-3">{t('auth.resetSubtitle')}</p>

        {error ? (
          <div className="alert alert-danger py-2 small" role="alert" data-testid="reset-error">
            {error}
          </div>
        ) : null}

        {done ? (
          <div data-testid="reset-done">
            <p className="small mb-3">{t('auth.resetDone')}</p>
            <Link to="/login" className="btn btn-primary w-100" data-testid="reset-to-login">
              {t('login.signIn')}
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-3">
              <label className="form-label" htmlFor="token">
                {t('auth.resetTokenLabel')}
              </label>
              <input
                id="token"
                className="form-control"
                value={token}
                readOnly
                data-testid="reset-token"
              />
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="newPassword">
                {t('auth.newPassword')}
              </label>
              <input
                id="newPassword"
                type="password"
                className="form-control"
                value={password}
                autoComplete="new-password"
                data-testid="reset-password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <div className="mb-3">
              <label className="form-label" htmlFor="confirmPassword">
                {t('auth.confirmPassword')}
              </label>
              <input
                id="confirmPassword"
                type="password"
                className="form-control"
                value={confirm}
                autoComplete="new-password"
                data-testid="reset-confirm"
                onChange={(event) => setConfirm(event.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-100"
              disabled={busy}
              data-testid="reset-submit"
            >
              {t('auth.resetSubmit')}
            </button>
          </>
        )}

        <p className="text-center small text-muted mt-3 mb-0">
          <Link to="/login" data-testid="reset-back">
            {t('auth.backToLogin')}
          </Link>
        </p>
      </form>
      </section>
    </div>
  );
}
