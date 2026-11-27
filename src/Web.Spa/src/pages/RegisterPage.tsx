import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { register } from '../api/ordering';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n/I18nContext';

// Kiểm tra email ở mức tối thiểu: có chữ trước/sau @ và có phần tên miền.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Số điện thoại: chỉ chấp nhận số, khoảng trắng, +, -, ngoặc; ít nhất 8 chữ số.
const PHONE_PATTERN = /^[\d\s+\-()]{8,}$/;

type Errors = {
  email?: string;
  password?: string;
  confirm?: string;
  phone?: string;
};

/**
 * Đăng ký 2 bước, bố cục chia đôi:
 * - trái: vì sao nên có tài khoản (ship miễn phí, 2 cách thanh toán, hoá đơn PDF)
 * - phải: bước 1 chỉ email + mật khẩu, bước 2 là thông tin nhận hàng (bỏ qua được)
 * Email là tên đăng nhập luôn, để khách đăng nhập lại bằng đúng email đã đăng ký.
 */
export function RegisterPage() {
  const { t } = useI18n();
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});

  const validateStep1 = (): boolean => {
    const next: Errors = {};
    const mail = email.trim();

    if (!mail) {
      next.email = t('auth.emailRequired');
    } else if (!EMAIL_PATTERN.test(mail)) {
      next.email = t('auth.emailInvalid');
    }
    if (password.length < 6) {
      next.password = t('auth.passwordTooShort');
    }
    if (password !== confirm) {
      next.confirm = t('auth.passwordMismatch');
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };


  /**
   * Nhận dữ liệu bước 2 qua tham số, không đọc state: nút "Bỏ qua" gửi bản rỗng
   * ngay trong cùng một lần bấm, state chưa kịp cập nhật.
   */
  const finish = async (payload: { displayName: string; phone: string; address: string }) => {
    setError(null);

    const mail = email.trim();
    if (!validateStep1()) {
      setStep(1);
      return;
    }

    const tel = payload.phone.trim();
    if (tel && !PHONE_PATTERN.test(tel)) {
      setErrors({ phone: t('auth.phoneInvalid') });
      return;
    }

    setBusy(true);
    try {
      // Tên hiển thị rỗng thì lấy phần trước @ của email cho câu chào dễ đọc.
      const name = payload.displayName.trim() || mail.split('@')[0];
      await register({
        username: mail,
        password,
        displayName: name,
        email: mail,
        phone: tel || null,
        address: payload.address.trim() || null,
      });
      // Đăng ký xong đăng nhập luôn để vào thẳng cửa hàng.
      const signedIn = await login(mail, password);
      toast(t('register.success', { name: signedIn.name }), 'success');
      navigate('/shop', { replace: true });
    } catch (cause) {
      // Trùng tài khoản: username chính là email nên phải nói về email, không nói "tên đăng nhập".
      const taken = cause instanceof ApiError && (cause.status === 409 || cause.code === 'AUTH_USERNAME_TAKEN');
      setError(taken ? t('register.emailTaken') : cause instanceof ApiError ? cause.message : t('common.error'));
      setStep(1);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Một đường duy nhất: form onSubmit tự phân nhánh theo bước.
   * Bước 1 chỉ kiểm tra rồi sang bước 2, bước 2 mới gọi API.
   */
  const onFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (step === 1) {
      if (validateStep1()) {
        setStep(2);
      }
      return;
    }

    void finish({ displayName, phone, address });
  };

  const fieldError = (key: keyof Errors) =>
    errors[key] ? (
      <p className="reg-error" data-testid={`register-error-${key}`}>
        <Icon name="warning" className="reg-error-icon" />
        {errors[key]}
      </p>
    ) : null;

  return (
    <div className="reg-page">
      <aside className="reg-benefits">
        <p className="reg-brand">
          <span className="reg-brand-mark">SF</span>
          StockFlow
        </p>
        <div className="reg-photo" aria-hidden="true">
          <img src="/products/photos/p-3001.jpg" alt="" loading="lazy" />
        </div>
        <ul className="reg-benefit-list">
          <li>
            <Icon name="inventory" className="reg-benefit-icon" />
            {t('register.benefit1')}
          </li>
          <li>
            <Icon name="check" className="reg-benefit-icon" />
            {t('register.benefit2')}
          </li>
          <li>
            <Icon name="invoice" className="reg-benefit-icon" />
            {t('register.benefit3')}
          </li>
        </ul>
      </aside>

      <section className="reg-panel">
        <div className="reg-panel-top">
          <LanguageSwitcher />
        </div>

        <form className="reg-card" onSubmit={onFormSubmit} noValidate autoComplete="off">
          <ol className="reg-steps">
            <li className={`reg-step${step === 1 ? ' is-current' : ' is-done'}`} aria-current={step === 1 ? 'step' : undefined}>
              <span className="reg-step-num">{step === 1 ? '1' : '✓'}</span>
              {t('register.stepAccount')}
            </li>
            <li className="reg-step-line" aria-hidden="true" />
            <li className={`reg-step${step === 2 ? ' is-current' : ''}`} aria-current={step === 2 ? 'step' : undefined}>
              <span className="reg-step-num">2</span>
              {t('register.stepDelivery')}
            </li>
          </ol>

          {step === 1 ? (
            <>
              <h2 className="reg-title">{t('register.title')}</h2>
              <p className="reg-sub">{t('register.step1Sub')}</p>
            </>
          ) : (
            <>
              <h2 className="reg-title">{t('register.step2Title')}</h2>
              <p className="reg-sub">{t('register.step2Sub')}</p>
            </>
          )}

          {error ? (
            <div className="alert alert-danger py-2 small" role="alert" data-testid="register-error">
              {error}
            </div>
          ) : null}

          {step === 1 ? (
            <>
              <div className="reg-field">
                <label className="reg-label" htmlFor="email">
                  {t('register.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  className={`reg-input${errors.email ? ' is-invalid' : ''}`}
                  value={email}
                  autoComplete="email"
                  data-testid="register-email"
                  onChange={(event) => setEmail(event.target.value)}
                />
                {fieldError('email')}
              </div>

              <div className="reg-field">
                <label className="reg-label" htmlFor="password">
                  {t('accounts.password')}
                </label>
                <input
                  id="password"
                  type="password"
                  className={`reg-input${errors.password ? ' is-invalid' : ''}`}
                  value={password}
                  autoComplete="new-password"
                  data-testid="register-password"
                  onChange={(event) => setPassword(event.target.value)}
                />
                <p className="reg-hint">{t('register.passwordHint')}</p>
                {fieldError('password')}
              </div>

              <div className="reg-field">
                <label className="reg-label" htmlFor="confirmPassword">
                  {t('auth.confirmPassword')}
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  className={`reg-input${errors.confirm ? ' is-invalid' : ''}`}
                  value={confirm}
                  autoComplete="new-password"
                  data-testid="register-confirm"
                  onChange={(event) => setConfirm(event.target.value)}
                />
                {fieldError('confirm')}
              </div>

              <button type="submit" className="btn btn-primary w-100 reg-submit" data-testid="register-next">
                {t('register.next')}
              </button>
            </>
          ) : (
            <>
              <div className="reg-field">
                <label className="reg-label" htmlFor="displayName">
                  {t('register.displayName')}
                </label>
                <input
                  id="displayName"
                  className="reg-input"
                  value={displayName}
                  data-testid="register-display-name"
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </div>

              <div className="reg-field">
                <label className="reg-label" htmlFor="phone">
                  {t('register.phone')}
                </label>
                <input
                  id="phone"
                  type="tel"
                  className={`reg-input${errors.phone ? ' is-invalid' : ''}`}
                  value={phone}
                  autoComplete="tel"
                  data-testid="register-phone"
                  onChange={(event) => setPhone(event.target.value)}
                />
                <p className="reg-hint">{t('register.phoneHint')}</p>
                {fieldError('phone')}
              </div>

              <div className="reg-field">
                <label className="reg-label" htmlFor="address">
                  {t('register.address')} <span className="reg-optional">{t('register.addressOptional')}</span>
                </label>
                <input
                  id="address"
                  className="reg-input"
                  value={address}
                  data-testid="register-address"
                  onChange={(event) => setAddress(event.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary w-100 reg-submit" disabled={busy} data-testid="register-submit">
                {busy ? t('register.submitting') : t('register.submit')}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary w-100 reg-skip"
                disabled={busy}
                data-testid="register-skip"
                onClick={() => void finish({ displayName: '', phone: '', address: '' })}
              >
                {t('register.skip')}
              </button>
            </>
          )}

          <p className="reg-footer">
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
