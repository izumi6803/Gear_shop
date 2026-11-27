import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cancelOrder, confirmOrder, getOrders, shipOrder } from '../api/ordering';
import type { Order, OrderStatus } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { EmptyState, ErrorPanel, Loading } from '../components/Feedback';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n/I18nContext';
import { useAsync } from '../lib/useAsync';

const STATUSES: OrderStatus[] = ['Draft', 'Confirmed', 'Shipped', 'Cancelled'];

export function OrdersPage() {
  const { canSell } = useAuth();
  const { t, money, date, dateTime, number } = useI18n();
  const toast = useToast();

  const [filter, setFilter] = useState<OrderStatus | ''>('');
  const [detail, setDetail] = useState<Order | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const orders = useAsync(() => getOrders(filter, 200), [filter]);

  async function run(order: Order, action: 'confirm' | 'ship' | 'cancel') {
    if (!canSell) {
      toast(t('orders.needRole'), 'error');
      return;
    }
    if (action === 'cancel' && !window.confirm(t('orders.cancelPrompt', { no: order.orderNo }))) {
      return;
    }

    setBusyId(order.id);
    try {
      if (action === 'confirm') {
        const updated = await confirmOrder(order.id);
        toast(t('orders.toastConfirmed', { no: updated.orderNo }));
      } else if (action === 'ship') {
        const result = await shipOrder(order.id);
        toast(
          t('orders.toastShipped', {
            no: result.order.orderNo,
            inv: result.invoice.invoiceNo,
            amount: money(result.invoice.amount + result.invoice.taxAmount),
          }),
        );
      } else {
        const updated = await cancelOrder(order.id);
        toast(t('orders.toastCancelled', { no: updated.orderNo }));
      }
      orders.reload();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : t('common.error'), 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (orders.loading) {
    return <Loading />;
  }

  if (orders.error) {
    return (
      <div className="page">
        <ErrorPanel message={orders.error} onRetry={orders.reload} />
      </div>
    );
  }

  const rows = orders.data?.items ?? [];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t('orders.title')}</h1>
          <p className="page-subtitle">{t('orders.subtitle')}</p>
        </div>
        {canSell ? (
          <Link className="btn btn-primary" to="/orders/new" data-testid="new-order">
            <Icon name="plus" className="me-1" />
            {t('orders.new')}
          </Link>
        ) : null}
      </header>

      <div className="filter-bar">
        <div className="segmented" role="group" aria-label={t('orders.colStatus')}>
          <button
            type="button"
            className={filter === '' ? 'active' : ''}
            data-testid="filter-all"
            onClick={() => setFilter('')}
          >
            {t('orders.filterAll')}
          </button>
          {STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              className={filter === status ? 'active' : ''}
              data-testid={`filter-${status}`}
              onClick={() => setFilter(status)}
            >
              <StatusBadge status={status} />
            </button>
          ))}
        </div>
        <span className="text-muted small">{t('orders.count', { n: number(rows.length) })}</span>
      </div>

      <section className="panel">
        {rows.length === 0 ? (
          <EmptyState message={t('orders.empty')} hint={t('orders.emptyHint')} />
        ) : (
          <div className="table-wrap">
            <table className="table app-table align-middle mb-0">
              <thead>
                <tr>
                  <th>{t('orders.colNo')}</th>
                  <th className="col-optional">{t('orders.colCustomer')}</th>
                  <th className="col-optional">{t('orders.colDate')}</th>
                  <th className="text-end col-optional">{t('orders.colLines')}</th>
                  <th className="text-end col-optional">{t('orders.colSubtotal')}</th>
                  <th className="text-end col-optional">{t('orders.colTax')}</th>
                  <th className="text-end col-compact">{t('orders.colTotal')}</th>
                  <th>{t('orders.colStatus')}</th>
                  <th className="text-end">{t('orders.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => {
                  const busy = busyId === order.id;
                  return (
                    <tr key={order.id} data-testid={`row-${order.orderNo}`}>
                      <td className="fw-semibold nowrap">
                        <Link to={`/orders/${order.id}`}>{order.orderNo}</Link>
                      </td>
                      <td className="col-optional">
                        {order.customerName}
                        {order.note ? <small className="d-block text-muted">{order.note}</small> : null}
                      </td>
                      <td className="text-muted nowrap col-optional">{date(order.orderDate)}</td>
                      <td className="text-end num col-optional">{number(order.lines.length)}</td>
                      <td className="text-end num col-optional">{money(order.subTotal)}</td>
                      <td className="text-end num col-optional">{money(order.taxAmount)}</td>
                      <td className="text-end num fw-semibold col-compact">{money(order.totalAmount)}</td>
                      <td>
                        <span data-testid={`status-${order.orderNo}`}>
                          <StatusBadge status={order.status} />
                        </span>
                      </td>
                      <td className="nowrap">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => setDetail(order)}
                            title={t('orders.view')}
                            aria-label={t('orders.view')}
                            data-testid={`detail-${order.orderNo}`}
                          >
                            <Icon name="list" />
                          </button>
                          {canSell ? (
                            <>
                              {order.status === 'Draft' ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  disabled={busy}
                                  aria-label={t('orders.confirm')}
                                  data-testid={`confirm-${order.orderNo}`}
                                  onClick={() => void run(order, 'confirm')}
                                >
                                  <Icon name="check" className="d-md-none" />
                                  <span className="d-none d-md-inline">{t('orders.confirm')}</span>
                                </button>
                              ) : null}
                              {order.status === 'Confirmed' ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-success"
                                  disabled={busy}
                                  aria-label={t('orders.ship')}
                                  data-testid={`ship-${order.orderNo}`}
                                  onClick={() => void run(order, 'ship')}
                                >
                                  <Icon name="inventory" className="d-md-none" />
                                  <span className="d-none d-md-inline">{t('orders.ship')}</span>
                                </button>
                              ) : null}
                              {order.status === 'Draft' || order.status === 'Confirmed' ? (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  disabled={busy}
                                  aria-label={t('orders.cancel')}
                                  data-testid={`cancel-${order.orderNo}`}
                                  onClick={() => void run(order, 'cancel')}
                                >
                                  <Icon name="close" className="d-md-none" />
                                  <span className="d-none d-md-inline">{t('orders.cancel')}</span>
                                </button>
                              ) : null}
                            </>
                          ) : null}
                          {busy ? (
                            <span className="spinner-border spinner-border-sm text-primary" aria-hidden="true" />
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detail ? (
        <Modal title={`${detail.orderNo}`} onClose={() => setDetail(null)}>
          <div className="detail-head">
            <StatusBadge status={detail.status} />
            <span className="text-muted small">{detail.customerName}</span>
            <span className="text-muted small">
              {date(detail.orderDate)} · {dateTime(detail.createdAt)}
            </span>
          </div>

          <table className="table app-table align-middle">
            <thead>
              <tr>
                <th>{t('create.product')}</th>
                <th className="text-end">{t('create.quantity')}</th>
                <th className="text-end">{t('invoice.colUnitPrice')}</th>
                <th className="text-end">{t('invoice.colAmount')}</th>
              </tr>
            </thead>
            <tbody>
              {detail.lines.map((line) => (
                <tr key={line.id}>
                  <td>
                    {line.productName}
                    <small className="d-block text-muted">{line.productCode}</small>
                  </td>
                  <td className="text-end num">{number(line.quantity)}</td>
                  <td className="text-end num">{money(line.unitPrice)}</td>
                  <td className="text-end num">{money(line.lineAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="totals-block">
            <div className="totals-row">
              <span>{t('create.subtotal')}</span>
              <strong className="num">{money(detail.subTotal)}</strong>
            </div>
            <div className="totals-row">
              <span>{t('create.tax')}</span>
              <strong className="num">{money(detail.taxAmount)}</strong>
            </div>
            <div className="totals-row totals-grand">
              <span>{t('create.total')}</span>
              <strong className="num">{money(detail.totalAmount)}</strong>
            </div>
          </div>

          {detail.note ? <p className="text-muted small mt-2">{detail.note}</p> : null}

          <div className="modal-actions">
            <Link className="btn btn-sm btn-outline-secondary" to={`/orders/${detail.id}`}>
              {t('orders.view')}
            </Link>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
