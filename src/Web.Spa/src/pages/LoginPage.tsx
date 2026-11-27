import { useState, type FormEvent } from 'react';
import { Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n/I18nContext';

const DEMO = [
  { username: 'sales', password: 'Sales@123', label: 'Sales' },
  { username: 'admin', password: 'Admin@123', label: 'Admin' },
  { username: 'viewer', password: 'Viewer@123', label: 'Viewer' },
];

export function LoginPage() {
  const { login, user } = useAuth();
  const { t } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  // Không điền sẵn tài khoản: tránh việc đăng nhập nhầm tài khoản còn lưu/autofill.
  // Nút "Demo accounts" bên dưới điền nhanh khi cần.
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError(t('login.required'));
      return;
    }

    setBusy(true);
    try {
      const signedIn = await login(username.trim(), password);
      // Nói rõ vừa đăng nhập bằng tài khoản nào — tránh hiểu nhầm "vẫn là admin".
      toast(`${t('login.signedInAs')} ${signedIn.name} (${signedIn.role})`, 'success');
      navigate(from, { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="login-brand">
          <span className="app-brand-mark">SF</span>
          <strong>StockFlow</strong>
        </div>
        <h1>{t('hero.title')}</h1>
        <p className="login-hero-sub">{t('hero.subtitle')}</p>
        <ul className="login-points">
          <li>
            <Icon name="dashboard" />
            {t('hero.point1')}
          </li>
          <li>
            <Icon name="check" />
            {t('hero.point2')}
          </li>
          <li>
            <Icon name="invoice" />
            {t('hero.point3')}
          </li>
        </ul>
        <p className="login-hero-foot">{t('hero.stack')}</p>
      </section>

      <section className="login-panel">
        <div className="login-panel-top">
          <LanguageSwitcher compact />
        </div>
        <form className="login-card" onSubmit={onSubmit} noValidate autoComplete="off">
          <h2>{t('login.title')}</h2>
          <p className="text-muted small mb-3">{t('login.subtitle')}</p>

          {error ? (
            <div className="alert alert-danger py-2 small" role="alert" data-testid="login-error">
              {error}
            </div>
          ) : null}

          <div className="mb-3">
            <label className="form-label" htmlFor="username">
              {t('login.username')}
            </label>
            <input
              id="username"
              className="form-control"
              value={username}
              autoComplete="off"
              data-testid="login-username"
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>

          <div className="mb-3">
            <label className="form-label" htmlFor="password">
              {t('login.password')}
            </label>
            <input
              id="password"
              type="password"
              className="form-control"
              value={password}
              autoComplete="new-password"
              data-testid="login-password"
              onChange={(event) => setPassword(event.target.value)}
            />
            <div className="text-end mt-1">
              <Link
                to="/forgot-password"
                className="small text-muted text-decoration-none"
                data-testid="login-forgot"
              >
                {t('auth.forgotLink')}
              </Link>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={busy}
            data-testid="login-submit"
          >
            {busy ? t('login.submitting') : t('login.submit')}
          </button>

          <div className="login-demo">
            <span className="login-demo-title">{t('login.demo')}</span>
            <div className="login-demo-buttons">
              {DEMO.map((account) => (
                <button
                  key={account.username}
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  data-testid={`login-demo-${account.username}`}
                  onClick={() => {
                    setUsername(account.username);
                    setPassword(account.password);
                  }}
                >
                  {account.label}
                </button>
              ))}
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
