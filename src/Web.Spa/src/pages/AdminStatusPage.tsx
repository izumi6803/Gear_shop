import { getShopStats } from '../api/ordering';
import { ErrorPanel, Loading } from '../components/Feedback';
import { useI18n } from '../i18n/I18nContext';
import { useAsync } from '../lib/useAsync';

export function AdminStatusPage() {
  const { t, money, number } = useI18n();
  const stats = useAsync(getShopStats, []);

  if (stats.loading) {
    return <Loading />;
  }

  if (stats.error || !stats.data) {
    return (
      <div className="page">
        <ErrorPanel message={stats.error ?? ''} onRetry={stats.reload} retryLabel={t('common.retry')} />
      </div>
    );
  }

  const data = stats.data;
  const cards = [
    { key: 'orders', label: t('status.ordersTotal'), value: number(data.ordersTotal), tone: '' },
    { key: 'unpaid', label: t('status.unpaid'), value: number(data.ordersUnpaid), tone: 'kpi-card-warn' },
    { key: 'revenue', label: t('status.revenue'), value: money(data.revenuePaid), tone: 'kpi-card-ok' },
    { key: 'customers', label: t('status.customers'), value: number(data.customers), tone: '' },
    { key: 'accounts', label: t('status.accounts'), value: number(data.accounts), tone: '' },
  ];

  const breakdown = [
    { key: 'draft', label: t('status.draft'), value: data.ordersDraft, status: 'Draft' },
    { key: 'confirmed', label: t('status.confirmed'), value: data.ordersConfirmed, status: 'Confirmed' },
    { key: 'shipped', label: t('status.shipped'), value: data.ordersShipped, status: 'Shipped' },
    { key: 'cancelled', label: t('status.cancelled'), value: data.ordersCancelled, status: 'Cancelled' },
  ];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t('status.title')}</h1>
          <p className="page-subtitle">{t('status.subtitle')}</p>
        </div>
      </header>

      <div className="kpi-grid kpi-grid-5">
        {cards.map((card) => (
          <article key={card.key} className={`kpi-card ${card.tone}`.trim()} data-testid={`stat-${card.key}`}>
            <span className="kpi-label">{card.label}</span>
            <strong className="kpi-value">{card.value}</strong>
          </article>
        ))}
      </div>

      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">{t('status.byStatus')}</h2>
        </header>
        <div className="table-wrap">
          <table className="table app-table align-middle mb-0">
            <thead>
              <tr>
                <th>{t('orders.colStatus')}</th>
                <th className="text-end">{t('status.ordersTotal')}</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((row) => (
                <tr key={row.key} data-testid={`stat-row-${row.key}`}>
                  <td>{row.label}</td>
                  <td className="text-end num fw-semibold">{number(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
