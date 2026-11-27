import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { cancelOrder, collectCash, confirmOrder, getOrder, shipOrder } from '../api/ordering';
import type { Order } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { ErrorPanel, Loading } from '../components/Feedback';
import { Icon } from '../components/Icon';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n/I18nContext';

type Step = {
  key: string;
  labelKey: string;
  at: string | null;
  done: boolean;
};

export function OrderDetailPage() {
  const { id } = useParams();
  const orderId = Number(id);
  const navigate = useNavigate();
  const { canSell } = useAuth();
  const { t, money, date, dateTime, number } = useI18n();
  const toast = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrder(await getOrder(orderId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('detail.loadError'));
    } finally {
      setLoading(false);
    }
  }, [orderId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: 'confirm' | 'ship' | 'cancel') {
    if (!order) {
      return;
    }
    if (action === 'cancel' && !window.confirm(t('orders.cancelPrompt', { no: order.orderNo }))) {
      return;
    }

    setBusy(action);
    try {
      if (action === 'confirm') {
        const updated = await confirmOrder(order.id);
        setOrder(updated);
        toast(t('orders.toastConfirmed', { no: updated.orderNo }));
      } else if (action === 'ship') {
        const result = await shipOrder(order.id);
        setOrder(result.order);
        toast(
          t('orders.toastShipped', {
            no: result.order.orderNo,
            inv: result.invoice.invoiceNo,
            amount: money(result.invoice.amount + result.invoice.taxAmount + (result.invoice.shippingFee ?? 0)),
          }),
        );
      } else {
        const updated = await cancelOrder(order.id);
        setOrder(updated);
        toast(t('orders.toastCancelled', { no: updated.orderNo }));
      }
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : t('common.error'), 'error');
    } finally {
      setBusy(null);
    }
  }

  // Thu tiền mặt cho đơn COD (Admin/Sales) → nạp lại đơn để cập nhật trạng thái thanh toán
  async function collect() {
    if (!order) {
      return;
    }

    setBusy('collect');
    try {
      await collectCash(order.id);
      toast(t('order.collected'), 'success');
      await load();
    } catch (cause) {
      toast(cause instanceof ApiError ? cause.message : t('common.error'), 'error');
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <Loading />;
  }

  if (error || !order) {
    return (
      <div className="page">
        <nav className="breadcrumb-trail">
          <Link to="/orders">{t('detail.breadcrumb')}</Link>
          <Icon name="chevron" />
          <span>#{id}</span>
        </nav>
        <ErrorPanel message={error ?? t('detail.notFound')} onRetry={load} />
      </div>
    );
  }

  const steps: Step[] = [
    { key: 'created', labelKey: 'detail.step.created', at: order.createdAt ?? null, done: true },
    {
      key: 'confirmed',
      labelKey: 'detail.step.confirmed',
      at: order.confirmedAt ?? null,
      done: Boolean(order.confirmedAt),
    },
    {
      key: 'shipped',
      labelKey: 'detail.step.shipped',
      at: order.shippedAt ?? null,
      done: Boolean(order.shippedAt),
    },
  ];
  const cancelled = order.status === 'Cancelled';

  return (
    <div className="page">
      <nav className="breadcrumb-trail">
        <Link to="/orders">{t('detail.breadcrumb')}</Link>
        <Icon name="chevron" />
        <span>{order.orderNo}</span>
      </nav>

      <header className="page-head">
        <div>
          <h1 className="page-title">
            {order.orderNo} <StatusBadge status={order.status} />{' '}
            <span
              className={`status-pill ${
                order.paymentStatus === 'Paid' ? 'status-active' : 'status-draft'
              }`}
              data-testid="detail-payment"
            >
              {order.paymentMethod === 'cash' ? t('myOrders.payOnDelivery') : t('checkout.online')}
              {' · '}
              {order.paymentStatus === 'Paid' ? t('myOrders.paid') : t('myOrders.unpaid')}
            </span>
          </h1>
          <p className="page-subtitle">
            {order.customerName} · {date(order.orderDate)} ·{' '}
            {t('detail.linesCount', { n: number(order.lines.length) })}
          </p>
        </div>
        {canSell ? (
          <div className="head-actions">
            {order.status === 'Draft' ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy !== null}
                data-testid="detail-confirm"
                onClick={() => void run('confirm')}
              >
                <Icon name="check" className="me-1" />
                {t('orders.confirm')}
              </button>
            ) : null}
            {order.status === 'Confirmed' ? (
              <button
                type="button"
                className="btn btn-success"
                disabled={busy !== null}
                data-testid="detail-ship"
                onClick={() => void run('ship')}
              >
                <Icon name="inventory" className="me-1" />
                {t('orders.ship')}
              </button>
            ) : null}
            {order.paymentMethod === 'cash' &&
            order.paymentStatus !== 'Paid' &&
            (order.status === 'Confirmed' || order.status === 'Shipped') ? (
              <button
                type="button"
                className="btn btn-sm btn-success"
                disabled={busy !== null}
                data-testid="collect-cash"
                onClick={() => void collect()}
              >
                {t('order.collectCash')}
              </button>
            ) : null}
            {order.status === 'Draft' || order.status === 'Confirmed' ? (
              <button
                type="button"
                className="btn btn-outline-danger"
                disabled={busy !== null}
                data-testid="detail-cancel"
                onClick={() => void run('cancel')}
              >
                {t('orders.cancel')}
              </button>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="detail-grid">
        <section className="panel">
          <header className="panel-head">
            <h2 className="panel-title">{t('detail.lines')}</h2>
            <span className="panel-sub">{t('detail.linesCount', { n: number(order.lines.length) })}</span>
          </header>
          <div className="table-wrap">
            <table className="table app-table align-middle mb-0">
              <thead>
                <tr>
                  <th>{t('products.colCode')}</th>
                  <th>{t('products.colName')}</th>
                  <th className="text-end">{t('invoice.colQty')}</th>
                  <th className="text-end">{t('invoice.colUnitPrice')}</th>
                  <th className="text-end">{t('invoice.colAmount')}</th>
                </tr>
              </thead>
              <tbody>
                {order.lines.map((line) => (
                  <tr key={line.id}>
                    <td className="fw-semibold nowrap">{line.productCode}</td>
                    <td>{line.productName}</td>
                    <td className="text-end num">{number(line.quantity)}</td>
                    <td className="text-end num">{money(line.unitPrice)}</td>
                    <td className="text-end num fw-semibold">{money(line.lineAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="totals-block">
            <div className="totals-row">
              <span>{t('create.subtotal')}</span>
              <strong className="num">{money(order.subTotal)}</strong>
            </div>
            <div className="totals-row">
              <span>{t('create.tax')}</span>
              <strong className="num">{money(order.taxAmount)}</strong>
            </div>
            <div className="totals-row">
              <span>{t('order.shippingFee')}</span>
              <strong className="num" data-testid="detail-shipping">
                {money(order.shippingFee ?? 0)}
              </strong>
            </div>
            <div className="totals-row totals-grand">
              <span>{t('create.total')}</span>
              <strong className="num" data-testid="detail-total">
                {money(order.totalAmount)}
              </strong>
            </div>
          </div>
        </section>

        <aside className="detail-side">
          <section className="panel">
            <header className="panel-head">
              <h2 className="panel-title">
                <Icon name="clock" className="me-1" />
                {t('detail.timeline')}
              </h2>
            </header>
            <ol className={`timeline${cancelled ? ' timeline-cancelled' : ''}`}>
              {steps.map((step) => (
                <li key={step.key} className={`timeline-item${step.done ? ' done' : ''}`}>
                  <span className="timeline-dot" aria-hidden="true" />
                  <div className="timeline-body">
                    <strong>{t(step.labelKey)}</strong>
                    <small className="text-muted">{step.at ? dateTime(step.at) : t('detail.notDone')}</small>
                  </div>
                </li>
              ))}
              {cancelled ? (
                <li className="timeline-item cancelled">
                  <span className="timeline-dot" aria-hidden="true" />
                  <div className="timeline-body">
                    <strong>{t('detail.step.cancelled')}</strong>
                    <small className="text-muted">{t('detail.stockReleased')}</small>
                  </div>
                </li>
              ) : null}
            </ol>
          </section>

          <section className="panel">
            <header className="panel-head">
              <h2 className="panel-title">{t('detail.info')}</h2>
            </header>
            <dl className="info-list">
              <dt>{t('detail.customer')}</dt>
              <dd>{order.customerName}</dd>
              <dt>{t('detail.orderDate')}</dt>
              <dd>{date(order.orderDate)}</dd>
              <dt>{t('detail.note')}</dt>
              <dd>{order.note ?? '—'}</dd>
              <dt>{t('detail.invoice')}</dt>
              <dd>
                {order.status === 'Shipped' ? (
                  <Link to="/invoices">{t('detail.invoiceLink')}</Link>
                ) : (
                  <span className="text-muted">{t('detail.invoicePending')}</span>
                )}
              </dd>
            </dl>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary w-100 mt-2"
              onClick={() => navigate('/orders')}
            >
              {t('detail.back')}
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
