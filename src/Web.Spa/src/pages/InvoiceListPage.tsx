import { Link } from 'react-router-dom';
import { getInvoices } from '../api/ordering';
import { EmptyState, ErrorPanel, Loading } from '../components/Feedback';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n/I18nContext';
import { useAsync } from '../lib/useAsync';

export function InvoiceListPage() {
  const { t, money, date, number } = useI18n();
  const invoices = useAsync(getInvoices, []);

  if (invoices.loading) {
    return <Loading />;
  }

  if (invoices.error) {
    return (
      <div className="page">
        <ErrorPanel message={invoices.error} onRetry={invoices.reload} />
      </div>
    );
  }

  const rows = invoices.data ?? [];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t('invoices.title')}</h1>
          <p className="page-subtitle">{t('invoices.subtitle')}</p>
        </div>
      </header>

      <section className="panel">
        <header className="panel-head">
          <h2 className="panel-title">{t('invoices.list', { n: number(rows.length) })}</h2>
        </header>

        {rows.length === 0 ? (
          <EmptyState message={t('invoices.empty')} hint={t('invoices.emptyHint')} />
        ) : (
          <div className="table-wrap">
            <table className="table app-table align-middle mb-0">
              <thead>
                <tr>
                  <th>{t('invoices.colNo')}</th>
                  <th className="col-optional">{t('invoices.colOrder')}</th>
                  <th className="text-end col-optional">{t('invoices.colSubtotal')}</th>
                  <th className="text-end col-optional">{t('invoices.colTax')}</th>
                  <th className="text-end">{t('invoices.colTotal')}</th>
                  <th className="col-optional">{t('invoices.colIssued')}</th>
                  <th>{t('invoices.colStatus')}</th>
                  <th className="text-end">{t('invoices.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="fw-semibold nowrap">
                      <Link to={`/invoices/${invoice.id}`}>{invoice.invoiceNo}</Link>
                    </td>
                    <td className="nowrap col-optional">{invoice.orderNo}</td>
                    <td className="text-end num col-optional">{money(invoice.amount)}</td>
                    <td className="text-end num col-optional">{money(invoice.taxAmount)}</td>
                    <td className="text-end num fw-semibold">
                      {money(invoice.amount + invoice.taxAmount)}
                    </td>
                    <td className="text-muted nowrap col-optional">{date(invoice.issuedAt)}</td>
                    <td>
                      <span className="status-pill status-shipped">{invoice.status}</span>
                    </td>
                    <td className="text-end nowrap">
                      <Link
                        className="btn btn-sm btn-outline-secondary"
                        to={`/invoices/${invoice.id}`}
                        title={t('invoices.openPrint')}
                        aria-label={t('invoices.openPrint')}
                        data-testid={`print-${invoice.invoiceNo}`}
                      >
                        <Icon name="print" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
