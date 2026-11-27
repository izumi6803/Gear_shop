import { useState } from 'react';
import { ApiError } from '../api/client';
import { createAccount, getAccounts, updateAccount } from '../api/ordering';
import { useAuth } from '../auth/AuthContext';
import { ErrorPanel, Loading } from '../components/Feedback';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n/I18nContext';
import { useAsync } from '../lib/useAsync';

const ROLES = ['Admin', 'Sales', 'Viewer', 'Customer'];

export function AdminAccountsPage() {
  const { t, date } = useI18n();
  const { user, logout } = useAuth();
  const toast = useToast();
  const accounts = useAsync(getAccounts, []);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('Sales');

  if (accounts.loading) {
    return <Loading />;
  }

  if (accounts.error) {
    return (
      <div className="page">
        <ErrorPanel message={accounts.error} onRetry={accounts.reload} retryLabel={t('common.retry')} />
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await createAccount({
        username: username.trim(),
        password,
        displayName: displayName.trim() || username.trim(),
        role,
      });
      toast(t('accounts.created_toast', { name: username.trim() }), 'success');
      setOpen(false);
      setUsername('');
      setPassword('');
      setDisplayName('');
      setRole('Sales');
      accounts.reload();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (id: number, nextRole: string, name: string) => {
    try {
      await updateAccount(id, { role: nextRole });
      toast(t('accounts.updated_toast', { name }), 'success');
      // Tự đổi quyền của chính mình ⇒ token hiện tại đã bị vô hiệu, phải đăng nhập lại.
      if (name === user?.username) {
        logout();
        return;
      }
      accounts.reload();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t('common.error'));
    }
  };

  const toggleActive = async (id: number, isActive: boolean, name: string) => {
    try {
      await updateAccount(id, { isActive });
      toast(t('accounts.updated_toast', { name }), 'success');
      if (name === user?.username) {
        logout();
        return;
      }
      accounts.reload();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t('common.error'));
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t('accounts.title')}</h1>
          <p className="page-subtitle">{t('accounts.subtitle')}</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="new-account"
          onClick={() => setOpen((current) => !current)}
        >
          <Icon name="plus" className="me-1" />
          {t('accounts.new')}
        </button>
      </header>

      {error ? (
        <div className="alert alert-danger py-2 small" role="alert" data-testid="accounts-error">
          {error}
        </div>
      ) : null}

      {open ? (
        <section className="panel">
          <header className="panel-head">
            <h2 className="panel-title">{t('accounts.new')}</h2>
          </header>
          <div className="form-grid">
            <div>
              <label className="form-label" htmlFor="newUsername">
                {t('accounts.username')}
              </label>
              <input
                id="newUsername"
                className="form-control"
                value={username}
                data-testid="account-username"
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="newPassword">
                {t('accounts.password')}
              </label>
              <input
                id="newPassword"
                className="form-control"
                value={password}
                data-testid="account-password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="newDisplayName">
                {t('accounts.displayName')}
              </label>
              <input
                id="newDisplayName"
                className="form-control"
                value={displayName}
                data-testid="account-display-name"
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="newRole">
                {t('accounts.role')}
              </label>
              <select
                id="newRole"
                className="form-select"
                value={role}
                data-testid="account-role"
                onChange={(event) => setRole(event.target.value)}
              >
                {ROLES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              data-testid="account-submit"
              onClick={submit}
            >
              {t('accounts.create')}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="table-wrap">
          <table className="table app-table align-middle mb-0">
            <thead>
              <tr>
                <th>{t('accounts.username')}</th>
                <th className="col-optional">{t('accounts.displayName')}</th>
                <th>{t('accounts.role')}</th>
                <th>{t('accounts.status')}</th>
                <th className="col-optional">{t('accounts.created')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accounts.data?.map((account) => {
                const isSelf = account.username === user?.username;
                return (
                  <tr key={account.id} data-testid={`account-${account.username}`}>
                    <td className="fw-semibold">
                      {account.username}
                      {isSelf ? <span className="text-muted small"> {t('accounts.you')}</span> : null}
                    </td>
                    <td className="col-optional">{account.displayName}</td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={account.role}
                        aria-label={`${t('accounts.role')} ${account.username}`}
                        data-testid={`account-role-${account.username}`}
                        onChange={(event) => changeRole(account.id, event.target.value, account.username)}
                      >
                        {ROLES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span
                        className={`status-pill ${
                          account.isActive ? 'status-active' : 'status-cancelled'
                        }`}
                        data-testid={`account-status-${account.username}`}
                      >
                        {account.isActive ? t('accounts.active') : t('accounts.disabled')}
                      </span>
                    </td>
                    <td className="text-muted nowrap col-optional">{date(account.createdAt)}</td>
                    <td className="text-end">
                      <button
                        type="button"
                        className={`btn btn-sm ${
                          account.isActive ? 'btn-outline-danger' : 'btn-outline-success'
                        }`}
                        disabled={isSelf}
                        data-testid={`account-toggle-${account.username}`}
                        onClick={() => toggleActive(account.id, !account.isActive, account.username)}
                      >
                        {account.isActive ? t('accounts.disable') : t('accounts.enable')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
