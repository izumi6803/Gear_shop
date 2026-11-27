import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../cart/CartContext';
import { EmptyState } from '../components/Feedback';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n/I18nContext';

export function CartPage() {
  const { t, money, number } = useI18n();
  const cart = useCart();
  const navigate = useNavigate();

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t('cart.title')}</h1>
          <p className="page-subtitle">{t('cart.subtitle')}</p>
        </div>
      </header>

      <section className="panel">
        {cart.lines.length === 0 ? (
          <>
            <EmptyState message={t('cart.empty')} hint={t('cart.emptyHint')} />
            <div className="form-actions">
              <Link className="btn btn-primary" to="/shop">
                {t('cart.continue')}
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table app-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>{t('staff.name')}</th>
                    <th className="text-end">{t('staff.price')}</th>
                    <th className="text-end">{t('cart.qty')}</th>
                    <th className="text-end">{t('invoice.colAmount')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cart.lines.map((line) => (
                    <tr key={line.productId} data-testid={`cart-row-${line.code}`}>
                      <td>
                        <strong>{line.name}</strong>
                        <small className="d-block text-muted">{line.code}</small>
                      </td>
                      <td className="text-end num">{money(line.unitPrice)}</td>
                      <td className="text-end" style={{ width: 110 }}>
                        <input
                          type="number"
                          min={1}
                          className="form-control form-control-sm text-end"
                          aria-label={`${t('cart.qty')} ${line.code}`}
                          value={line.quantity}
                          data-testid={`cart-qty-${line.code}`}
                          onChange={(event) =>
                            cart.setQuantity(line.productId, Math.max(1, Number(event.target.value) || 1))
                          }
                        />
                      </td>
                      <td className="text-end num fw-semibold">
                        {money(line.unitPrice * line.quantity)}
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          aria-label={t('cart.remove')}
                          data-testid={`cart-remove-${line.code}`}
                          onClick={() => cart.remove(line.productId)}
                        >
                          <Icon name="close" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="totals-block">
              <div className="totals-row">
                <span>{t('create.subtotal')}</span>
                <strong className="num" data-testid="cart-subtotal">
                  {money(cart.subTotal)}
                </strong>
              </div>
              <div className="totals-row">
                <span>{t('create.tax')}</span>
                <strong className="num">{money(cart.tax)}</strong>
              </div>
              <div className="totals-row">
                <span>{t('cart.shipping')}</span>
                <strong className="num" data-testid="cart-shipping">
                  {cart.shipping === 0 && cart.lines.length > 0
                    ? t('cart.freeShipping')
                    : money(cart.shipping)}
                </strong>
              </div>
              <div className="totals-row totals-grand">
                <span>{t('create.total')}</span>
                <strong className="num" data-testid="cart-total">
                  {money(cart.total)}
                </strong>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary"
                data-testid="cart-checkout"
                onClick={() => navigate('/checkout')}
              >
                {t('cart.checkout')} ({number(cart.count)})
              </button>
              <Link className="btn btn-outline-secondary" to="/shop">
                {t('cart.continue')}
              </Link>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
