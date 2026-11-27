import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { register } from '../api/ordering';
import { useAuth } from '../auth/AuthContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n/I18nContext';

// Kiểm tra email ở mức tối thiểu: có chữ trước/sau @ và có phần tên miền.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegisterPage() {
  const { t } = useI18n();
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    const name = username.trim();
    const mail = email.trim();

    // Kiểm tra phía client trước khi gọi API: báo lỗi rõ ràng, tránh gọi mạng vô ích.
    if (name.length < 3) {
      setError(t('auth.usernameTooShort'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    if (mail && !EMAIL_PATTERN.test(mail)) {
      setError(t('auth.emailInvalid'));
      return;
    }

    setBusy(true);
    try {
      await register({
        username: name,
        password,
        displayName: displayName.trim(),
        email: mail || null,
        phone: phone.trim() || null,
        address: address.trim() || null,
      });
      // Đăng ký xong đăng nhập luôn để vào thẳng cửa hàng.
      const signedIn = await login(name, password);
      toast(t('register.success', { name: signedIn.name }), 'success');
      navigate('/shop', { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <section className="login-hero">
        <h1>StockFlow</h1>
        <p className="login-hero-sub">{t('register.subtitle')}</p>
      </section>

      <section className="login-panel">
        <div className="login-panel-top">
          <LanguageSwitcher />
        </div>

      <form className="login-card" onSubmit={onSubmit} noValidate autoComplete="off">
        <h2>{t('register.title')}</h2>

        {error ? (
          <div className="alert alert-danger py-2 small" role="alert" data-testid="register-error">
            {error}
          </div>
        ) : null}

        <div className="mb-3">
          <label className="form-label" htmlFor="username">
            {t('accounts.username')}
          </label>
          <input
            id="username"
            className="form-control"
            value={username}
            autoComplete="off"
            data-testid="register-username"
            onChange={(event) => setUsername(event.target.value)}
          />
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="password">
            {t('accounts.password')}
          </label>
          <input
            id="password"
            type="password"
            className="form-control"
            value={password}
            autoComplete="new-password"
            data-testid="register-password"
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
            data-testid="register-confirm"
            onChange={(event) => setConfirm(event.target.value)}
          />
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="displayName">
            {t('register.displayName')}
          </label>
          <input
            id="displayName"
            className="form-control"
            value={displayName}
            data-testid="register-display-name"
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </div>

        <div className="mb-3">
          <label className="form-label" htmlFor="email">
            {t('register.email')}
          </label>
          <input
            id="email"
            type="email"
            className="form-control"
            value={email}
            data-testid="register-email"
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="row g-2 mb-3">
          <div className="col-6">
            <label className="form-label" htmlFor="phone">
              {t('register.phone')}
            </label>
            <input
              id="phone"
              className="form-control"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
          <div className="col-6">
            <label className="form-label" htmlFor="address">
              {t('register.address')}
            </label>
            <input
              id="address"
              className="form-control"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary w-100" disabled={busy} data-testid="register-submit">
          {busy ? t('register.submitting') : t('register.submit')}
        </button>

        <p className="text-center small text-muted mt-3 mb-0">
          {t('register.have')}{' '}
          <Link to="/login" data-testid="register-to-login">
            {t('login.signIn')}
          </Link>
        </p>
      </form>
      </section>
    </div>
  );
}
