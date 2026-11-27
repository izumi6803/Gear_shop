import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import { getMyOrders, shopPay } from '../api/ordering';
import type { Order, PayInput } from '../api/types';
import { EmptyState, ErrorPanel, Loading } from '../components/Feedback';
import { PaymentForm } from '../components/PaymentForm';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n/I18nContext';
import { useAsync } from '../lib/useAsync';

function paymentLabel(order: Order, t: (key: string) => string): string {
  switch (order.paymentStatus) {
    case 'Paid':
      return t('myOrders.paid');
    case 'Refunded':
      return t('myOrders.refunded');
    default:
      // Đơn COD: khách trả tiền khi nhận hàng → nhãn riêng thay cho "Chưa thanh toán"
      return order.paymentMethod === 'cash' ? t('myOrders.payOnDelivery') : t('myOrders.unpaid');
  }
}

function paymentPillClass(order: Order): string {
  if (order.paymentStatus === 'Paid') {
    return 'status-active';
  }
  // COD chưa thu tiền → pill xanh để phân biệt với đơn online còn nợ
  return order.paymentMethod === 'cash' ? 'status-confirmed' : 'status-draft';
}

export function MyOrdersPage() {
  const { t, money, date } = useI18n();
  const toast = useToast();
  const orders = useAsync(getMyOrders, []);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (orders.loading) {
    return <Loading />;
  }

  if (orders.error) {
    return (
      <div className="page">
        <ErrorPanel message={orders.error} onRetry={orders.reload} retryLabel={t('common.retry')} />
      </div>
    );
  }

  const items = orders.data ?? [];

  const pay = async (order: Order, payment: PayInput) => {
    setBusy(true);
    setError(null);
    try {
      await shopPay(order.id, payment);
      toast(t('myOrders.paid'), 'success');
      setPayingId(null);
      orders.reload();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t('myOrders.title')}</h1>
          <p className="page-subtitle">{t('myOrders.subtitle')}</p>
        </div>
        <Link className="btn btn-outline-primary" to="/shop">
          {t('cart.continue')}
        </Link>
      </header>

      {error ? (
        <div className="alert alert-danger py-2 small" role="alert" data-testid="myorders-error">
          {error}
        </div>
      ) : null}

      <section className="panel">
        {items.length === 0 ? (
          <EmptyState message={t('myOrders.empty')} hint={t('myOrders.emptyHint')} />
        ) : (
          <div className="table-wrap">
            <table className="table app-table align-middle mb-0">
              <thead>
                <tr>
                  <th>{t('orders.colNo')}</th>
                  <th className="col-optional">{t('orders.colDate')}</th>
                  <th className="text-end">{t('orders.colTotal')}</th>
                  <th>{t('orders.colStatus')}</th>
                  <th>{t('myOrders.payment')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((order) => (
                  <tr key={order.id} data-testid={`myorder-${order.orderNo}`}>
                    <td className="fw-semibold nowrap">{order.orderNo}</td>
                    <td className="text-muted nowrap col-optional">{date(order.orderDate)}</td>
                    <td className="text-end num">{money(order.totalAmount)}</td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td>
                      <span
                        className={`status-pill ${paymentPillClass(order)}`}
                        data-testid={`payment-${order.orderNo}`}
                      >
                        {paymentLabel(order, t)}
                      </span>
                    </td>
                    <td className="text-end">
                      {order.status === 'Confirmed' &&
                      order.paymentStatus !== 'Paid' &&
                      order.paymentMethod !== 'cash' ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          data-testid={`pay-${order.orderNo}`}
                          onClick={() => setPayingId(payingId === order.id ? null : order.id)}
                        >
                          {t('myOrders.payNow')}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {payingId !== null ? (
        <section className="panel mt-3">
          <header className="panel-head">
            <h2 className="panel-title">{t('checkout.payment')}</h2>
          </header>
          {items
            .filter((order) => order.id === payingId)
            .map((order) => (
              <PaymentForm
                key={order.id}
                amountLabel={money(order.totalAmount)}
                busy={busy}
                submitLabel={t('checkout.pay')}
                onSubmit={(payment) => pay(order, payment)}
              />
            ))}
        </section>
      ) : null}
    </div>
  );
}
