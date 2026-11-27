import { Link, Navigate } from 'react-router-dom';
import { getInvoices, getOrders } from '../api/ordering';
import { getProducts, getStocks } from '../api/catalog';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorPanel, Loading } from '../components/Feedback';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { useI18n } from '../i18n/I18nContext';
import { useAsync } from '../lib/useAsync';

type RoleKey = 'admin' | 'sales' | 'viewer';

function roleKeyOf(role: string): RoleKey {
  if (role === 'Admin') {
    return 'admin';
  }
  if (role === 'Sales') {
    return 'sales';
  }
  return 'viewer';
}

export function DashboardPage() {
  const { canSell, user } = useAuth();
  const { t, money, date, number } = useI18n();
  const role = roleKeyOf(user?.role ?? '');

  // Khách mua hàng không dùng dashboard nội bộ: vào thẳng cửa hàng.
  if (user?.role === 'Customer') {
    return <Navigate to='/shop' replace />;
  }

  const recent = useAsync(() => getOrders('', 6), []);
  const drafts = useAsync(() => getOrders('Draft', 1), []);
  const products = useAsync(() => getProducts('', 1), []);
  const invoices = useAsync(getInvoices, []);
  const stocks = useAsync(() => getStocks('', 200), []);

  const loading = recent.loading || drafts.loading || products.loading || invoices.loading || stocks.loading;
  const error = recent.error ?? drafts.error ?? products.error ?? invoices.error ?? stocks.error;

  const lowStock = (stocks.data?.items ?? [])
    .filter((item) => item.available <= 20)
    .sort((left, right) => left.available - right.available)
    .slice(0, 6);

  if (loading) {
    return <Loading />;
  }

  // Mỗi role thấy một dashboard khác nhau: Viewer không có số "chờ xác nhận"
  // (không thao tác được) và có ghi chú chỉ đọc; Sales có lối tắt tạo đơn;
  // Admin có công cụ quản trị danh mục.
  const kpis =
    role === 'viewer'
      ? [
          {
            key: 'orders',
            label: t('dash.kpi.orders'),
            foot: t('dash.kpi.ordersFoot'),
            value: recent.data?.totalCount ?? 0,
            tone: '',
          },
          {
            key: 'products',
            label: t('dash.kpi.products'),
            foot: t('dash.kpi.productsFoot'),
            value: products.data?.totalCount ?? 0,
            tone: '',
          },
          {
            key: 'invoices',
            label: t('dash.kpi.invoices'),
            foot: t('dash.kpi.invoicesFoot'),
            value: invoices.data?.length ?? 0,
            tone: 'kpi-card-ok',
          },
        ]
      : [
          {
            key: 'orders',
            label: t('dash.kpi.orders'),
            foot: t('dash.kpi.ordersFoot'),
            value: recent.data?.totalCount ?? 0,
            tone: '',
          },
          {
            key: 'pending',
            label: t('dash.kpi.pending'),
            foot: t('dash.kpi.pendingFoot'),
            value: drafts.data?.totalCount ?? 0,
            tone: 'kpi-card-warn',
          },
          {
            key: 'products',
            label: t('dash.kpi.products'),
            foot: t('dash.kpi.productsFoot'),
            value: products.data?.totalCount ?? 0,
            tone: '',
          },
          {
            key: 'invoices',
            label: t('dash.kpi.invoices'),
            foot: t('dash.kpi.invoicesFoot'),
            value: invoices.data?.length ?? 0,
            tone: 'kpi-card-ok',
          },
        ];

  return (
    <div className="page" data-role={role}>
      <header className="page-head">
        <div>
          <h1 className="page-title">
            {t(`dash.title.${role}`)}
            <span className={`role-chip role-chip-${role} ms-2`} data-testid="current-role">
              {user?.name ?? '—'} · {t(`dash.role${role === 'admin' ? 'Admin' : role === 'sales' ? 'Sales' : 'Viewer'}`)}
            </span>
          </h1>
          <p className="page-subtitle">{t(`dash.subtitle.${role}`)}</p>
        </div>
        {canSell ? (
          <Link className="btn btn-primary" to="/orders/new" data-testid="new-order">
            <Icon name="plus" className="me-1" />
            {t('orders.new')}
          </Link>
        ) : null}
      </header>

      {error ? <ErrorPanel message={error} onRetry={recent.reload} retryLabel={t('common.retry')} /> : null}

      <div className={`kpi-grid kpi-grid-${kpis.length}`}>
        {kpis.map((kpi) => (
          <article key={kpi.key} className={`kpi-card ${kpi.tone}`.trim()} data-testid={`kpi-${kpi.key}`}>
            <span className="kpi-label">{kpi.label}</span>
            <strong className="kpi-value">{number(kpi.value)}</strong>
            <span className="kpi-foot">{kpi.foot}</span>
          </article>
        ))}
      </div>

      <div className="split-grid">
        <section className="panel">
          <header className="panel-head">
            <h2 className="panel-title">{t('dash.recent')}</h2>
            <Link to="/orders" className="panel-link">
              {t('dash.viewAll')}
            </Link>
          </header>
          {(recent.data?.items.length ?? 0) === 0 ? (
            <EmptyState message={t('dash.emptyOrders')} hint={t('dash.emptyOrdersHint')} />
          ) : (
            <div className="table-wrap">
              <table className="table app-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>{t('orders.colNo')}</th>
                    <th className="col-optional">{t('orders.colCustomer')}</th>
                    <th className="col-optional">{t('orders.colDate')}</th>
                    <th className="text-end">{t('orders.colTotal')}</th>
                    <th>{t('orders.colStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.data?.items.map((order) => (
                    <tr key={order.id}>
                      <td className="fw-semibold nowrap">
                        <Link to={`/orders/${order.id}`}>{order.orderNo}</Link>
                      </td>
                      <td className="col-optional">{order.customerName}</td>
                      <td className="text-muted nowrap col-optional">{date(order.orderDate)}</td>
                      <td className="text-end num">{money(order.totalAmount)}</td>
                      <td>
                        <StatusBadge status={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel">
          <header className="panel-head">
            <h2 className="panel-title">{t('dash.lowStock')}</h2>
            <Link to="/products" className="panel-link">
              {t('dash.details')}
            </Link>
          </header>
          {lowStock.length === 0 ? (
            <EmptyState message={t('dash.emptyStock')} />
          ) : (
            <ul className="alert-list">
              {lowStock.map((item) => (
                <li key={`${item.productId}-${item.warehouseId}`}>
                  <div>
                    <strong>{item.productCode}</strong>
                    <small className="d-block text-muted">{item.productName}</small>
                  </div>
                  <span className={`num fw-semibold${item.available <= 5 ? ' text-danger' : ' text-warning'}`}>
                    {number(item.available)} / {number(item.quantityOnHand)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="panel-foot text-muted">{t('dash.lowStockHint', { n: 20 })}</p>
        </section>
      </div>

      {/* Khối riêng của từng role — để không role nào thấy "cùng một dashboard" */}
      {role === 'admin' ? (
        <section className="panel role-panel role-panel-admin" data-testid="role-panel-admin">
          <header className="panel-head">
            <h2 className="panel-title">
              <Icon name="inventory" className="me-1" />
              {t('dash.adminTools')}
            </h2>
          </header>
          <p className="text-muted small mb-2">{t('dash.adminToolsHint')}</p>
          <div className="head-actions">
            <Link className="btn btn-sm btn-outline-primary" to="/products">
              {t('dash.openProducts')}
            </Link>
            <Link className="btn btn-sm btn-outline-secondary" to="/invoices">
              {t('dash.openInvoices')}
            </Link>
            <Link className="btn btn-sm btn-outline-secondary" to="/orders">
              {t('dash.openOrders')}
            </Link>
          </div>
        </section>
      ) : null}

      {role === 'sales' ? (
        <section className="panel role-panel role-panel-sales" data-testid="role-panel-sales">
          <header className="panel-head">
            <h2 className="panel-title">
              <Icon name="new" className="me-1" />
              {t('dash.quickAction')}
            </h2>
          </header>
          <p className="text-muted small mb-2">{t('dash.quickActionHint')}</p>
          <div className="head-actions">
            <Link className="btn btn-sm btn-primary" to="/orders/new">
              <Icon name="plus" className="me-1" />
              {t('orders.new')}
            </Link>
            <Link className="btn btn-sm btn-outline-secondary" to="/orders">
              {t('dash.openOrders')}
            </Link>
          </div>
        </section>
      ) : null}

      {role === 'viewer' ? (
        <section className="panel role-panel role-panel-viewer" data-testid="role-panel-viewer">
          <header className="panel-head">
            <h2 className="panel-title">
              <Icon name="info" className="me-1" />
              {t('dash.readOnlyNote')}
            </h2>
          </header>
          <p className="text-muted small mb-2">{t('dash.readOnlyWhy')}</p>
          <div className="head-actions">
            <Link className="btn btn-sm btn-outline-secondary" to="/orders">
              {t('dash.openOrders')}
            </Link>
            <Link className="btn btn-sm btn-outline-secondary" to="/invoices">
              {t('dash.openInvoices')}
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
