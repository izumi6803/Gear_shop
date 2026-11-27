import { Link, useParams } from 'react-router-dom';
import { getCompanyProfile, getInvoiceDetail } from '../api/ordering';
import { ErrorPanel, Loading } from '../components/Feedback';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n/I18nContext';
import { useAsync } from '../lib/useAsync';

/**
 * Printable invoice (A4 / save as PDF via the browser print dialog).
 * Layout is intentionally generic so it works for any market: seller and buyer blocks,
 * invoice number, issue/due dates, line items, tax breakdown, payment details.
 */
export function InvoicePrintPage() {
  const { id } = useParams();
  const invoiceId = Number(id);
  const { t, money, date, number } = useI18n();

  const invoice = useAsync(() => getInvoiceDetail(invoiceId), [invoiceId]);
  const company = useAsync(getCompanyProfile, []);

  if (invoice.loading || company.loading) {
    return <Loading />;
  }

  if (invoice.error || company.error || !invoice.data || !company.data) {
    return (
      <div className="page">
        <ErrorPanel
          message={invoice.error ?? company.error ?? t('common.error')}
          onRetry={invoice.reload}
        />
      </div>
    );
  }

  const data = invoice.data;
  const seller = company.data;
  const shipping = data.shippingFee ?? 0;
  const total = data.amount + data.taxAmount + shipping;

  return (
    <div className="page invoice-page">
      <div className="invoice-toolbar no-print">
        <Link to="/invoices" className="btn btn-sm btn-outline-secondary">
          {t('invoice.back')}
        </Link>
        <div className="invoice-toolbar-right">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => window.print()}
            data-testid="print-invoice"
          >
            <Icon name="print" className="me-1" />
            {t('invoice.print')}
          </button>
        </div>
      </div>

      <article className="invoice-sheet" aria-label={`${t('invoice.docTitle')} ${data.invoiceNo}`}>
        <header className="invoice-head">
          <div>
            <h1 className="invoice-title">{t('invoice.docTitle')}</h1>
            <p className="invoice-subtitle">StockFlow</p>
          </div>
          <div className="invoice-meta">
            <div>
              <span>{t('invoice.invoiceNo')}</span>
              <strong>{data.invoiceNo}</strong>
            </div>
            <div>
              <span>{t('invoice.issueDate')}</span>
              <strong>{date(data.issuedAt)}</strong>
            </div>
            <div>
              <span>{t('invoice.dueDate')}</span>
              <strong>{date(data.dueDate)}</strong>
            </div>
          </div>
        </header>

        <section className="invoice-parties">
          <div className="invoice-customer">
            <p className="invoice-label">{t('invoice.billTo')}</p>
            <p className="invoice-customer-name">{data.customerName}</p>
            {data.customerAddress ? <p className="invoice-muted">{data.customerAddress}</p> : null}
            <p className="invoice-label mt-3">{t('invoice.amountDue')}</p>
            <p className="invoice-amount" data-testid="invoice-amount">
              {money(total)}
            </p>
            <p className="invoice-muted">{t('invoice.taxIncluded')}</p>
          </div>

          <div className="invoice-seller">
            <p className="invoice-seller-name">{seller.name}</p>
            <p className="invoice-muted">{seller.addressLine}</p>
            <p className="invoice-muted">
              {seller.postalCode} {seller.city}, {seller.country}
            </p>
            <p className="invoice-muted">
              {seller.phone} · {seller.email}
            </p>
            <p className="invoice-registration">
              {t('invoice.footer', { company: seller.name, taxId: seller.taxId })}
            </p>
          </div>
        </section>

        <section className="invoice-subject">
          <p>
            <strong>{t('invoice.subject')}:</strong> {t('invoice.subjectValue')}
          </p>
          <p className="invoice-muted">
            {t('invoice.orderNo')} {data.orderNo} · {t('invoice.tradeDate')} {date(data.orderDate)} ·{' '}
            {t('invoice.paymentTerms')} {seller.paymentTerms}
          </p>
        </section>

        <table className="invoice-table">
          <thead>
            <tr>
              <th>{t('invoice.colItem')}</th>
              <th className="text-end">{t('invoice.colQty')}</th>
              <th className="text-end">{t('invoice.colUnitPrice')}</th>
              <th className="text-end">{t('invoice.colAmount')}</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((line) => (
              <tr key={line.id}>
                <td>
                  {line.productName}
                  <small className="invoice-muted"> ({line.productCode})</small>
                </td>
                <td className="text-end num">{number(line.quantity)}</td>
                <td className="text-end num">{money(line.unitPrice)}</td>
                <td className="text-end num">{money(line.lineAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="invoice-summary">
          <table className="invoice-summary-table">
            <tbody>
              <tr>
                <th>{t('invoice.subtotalLabel')}</th>
                <td className="text-end num">{money(data.subTotal)}</td>
              </tr>
              <tr>
                <th>{t('invoice.taxLabel')}</th>
                <td className="text-end num">{money(data.taxAmount)}</td>
              </tr>
<tr>
                <th>{t('order.shippingFee')}</th>
                <td className="text-end num" data-testid="invoice-shipping">
                  {money(shipping)}
                </td>
              </tr>
              <tr className="invoice-summary-total">
                <th>{t('invoice.totalLabel')}</th>
                <td className="text-end num" data-testid="invoice-total">
                  {money(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="invoice-bank">
          <p>
            <strong>{t('invoice.paymentDetails')}:</strong> {seller.bankAccount}
          </p>
          <p className="invoice-muted">{t('invoice.paymentNote')}</p>
        </section>

        <footer className="invoice-foot invoice-muted">
          <p>{t('invoice.thankYou')}</p>
          <p>{t('invoice.generatedAt', { date: date(new Date().toISOString()) })}</p>
        </footer>
      </article>
    </div>
  );
}
