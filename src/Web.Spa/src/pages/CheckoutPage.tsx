import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { shopCheckout, shopPay } from '../api/ordering';
import type { PayInput } from '../api/types';
import { useCart } from '../cart/CartContext';
import { EmptyState } from '../components/Feedback';
import { PaymentForm } from '../components/PaymentForm';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n/I18nContext';

export function CheckoutPage() {
  const { t, money } = useI18n();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash'>('online');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (cart.lines.length === 0) {
    return (
      <div className="page">
        <section className="panel">
          <EmptyState message={t('checkout.emptyCart')} hint={t('cart.emptyHint')} />
          <div className="form-actions">
            <Link className="btn btn-primary" to="/shop">
              {t('cart.continue')}
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const lines = cart.lines.map((line) => ({
    productId: line.productId,
    warehouseId: line.warehouseId,
    quantity: line.quantity,
  }));

  const payOnline = async (payment: PayInput) => {
    if (note.trim().length === 0) {
      setError(t('checkout.needAddress'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      // 1) Tạo đơn + giữ tồn, 2) thanh toán. Hai bước tách rời như thiết kế.
      const order = await shopCheckout(lines, note.trim(), 'online');

      await shopPay(order.id, payment);
      cart.clear();
      toast(t('checkout.success', { no: order.orderNo }), 'success');
      navigate('/my-orders');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const placeCashOrder = async () => {
    if (note.trim().length === 0) {
      setError(t('checkout.needAddress'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      // Đơn COD: chỉ tạo đơn, không gọi thanh toán thẻ.
      const order = await shopCheckout(lines, note.trim(), 'cash');
      cart.clear();
      toast(t('checkout.cashSuccess', { no: order.orderNo }), 'success');
      navigate('/my-orders');
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
          <h1 className="page-title">{t('checkout.title')}</h1>
          <p className="page-subtitle">{t('checkout.subtitle')}</p>
        </div>
      </header>

      {error ? (
        <div className="alert alert-danger py-2 small" role="alert" data-testid="checkout-error">
          {error}
        </div>
      ) : null}

      <div className="detail-grid">
        <section className="panel">
          <header className="panel-head">
            <h2 className="panel-title">{t('checkout.delivery')}</h2>
          </header>
          <label className="form-label" htmlFor="note">
            {t('checkout.note')}
          </label>
          <textarea
            id="note"
            className="form-control"
            rows={3}
            placeholder={t('checkout.notePlaceholder')}
            value={note}
            data-testid="checkout-note"
            onChange={(event) => setNote(event.target.value)}
          />

          <div className="table-wrap mt-3">
            <table className="table app-table align-middle mb-0">
              <thead>
                <tr>
                  <th>{t('staff.name')}</th>
                  <th className="text-end">{t('cart.qty')}</th>
                  <th className="text-end">{t('invoice.colAmount')}</th>
                </tr>
              </thead>
              <tbody>
                {cart.lines.map((line) => (
                  <tr key={line.productId}>
                    <td>
                      <strong>{line.name}</strong>
                      <small className="d-block text-muted">{line.code}</small>
                    </td>
                    <td className="text-end num">{line.quantity}</td>
                    <td className="text-end num">{money(line.unitPrice * line.quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="totals-block">
            <div className="totals-row">
              <span>{t('create.subtotal')}</span>
              <strong className="num">{money(cart.subTotal)}</strong>
            </div>
            <div className="totals-row">
              <span>{t('create.tax')}</span>
              <strong className="num">{money(cart.tax)}</strong>
            </div>
            <div className="totals-row">
              <span>{t('cart.shipping')}</span>
              <strong className="num" data-testid="checkout-shipping">
                {cart.shipping === 0 && cart.lines.length > 0
                  ? t('cart.freeShipping')
                  : money(cart.shipping)}
              </strong>
            </div>
            <div className="totals-row totals-grand">
              <span>{t('create.total')}</span>
              <strong className="num" data-testid="checkout-total">
                {money(cart.total)}
              </strong>
            </div>
          </div>
        </section>

        <aside className="panel">
          <header className="panel-head">
            <h2 className="panel-title">{t('checkout.payment')}</h2>
          </header>

          <div className="mb-3">
            <span className="form-label d-block">{t('checkout.method')}</span>
            <div className="form-check">
              <input
                id="payMethodOnline"
                className="form-check-input"
                type="radio"
                name="payMethod"
                value="online"
                checked={paymentMethod === 'online'}
                data-testid="pay-method-online"
                onChange={() => setPaymentMethod('online')}
              />
              <label className="form-check-label" htmlFor="payMethodOnline">
                {t('checkout.online')}
              </label>
            </div>
            <div className="form-check">
              <input
                id="payMethodCash"
                className="form-check-input"
                type="radio"
                name="payMethod"
                value="cash"
                checked={paymentMethod === 'cash'}
                data-testid="pay-method-cash"
                onChange={() => setPaymentMethod('cash')}
              />
              <label className="form-check-label" htmlFor="payMethodCash">
                {t('checkout.cash')}
              </label>
            </div>
          </div>

          {paymentMethod === 'online' ? (
            <PaymentForm
              amountLabel={money(cart.total)}
              busy={busy}
              submitLabel={t('checkout.pay')}
              onSubmit={payOnline}
            />
          ) : (
            <>
              <p className="text-muted small">{t('checkout.cashNote')}</p>
              <button
                type="button"
                className="btn btn-primary w-100"
                disabled={busy}
                data-testid="place-order-cash"
                onClick={placeCashOrder}
              >
                {t('checkout.placeOrder')}
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
