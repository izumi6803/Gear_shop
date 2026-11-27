import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getProducts, getStocks, getWarehouses } from '../api/catalog';
import { useCart } from '../cart/CartContext';
import { ErrorPanel, Loading } from '../components/Feedback';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n/I18nContext';
import { useAsync } from '../lib/useAsync';
import { bestStock } from './ShopPage';

export function ProductPage() {
  const { id } = useParams();
  const productId = Number(id);
  const { t, money, number } = useI18n();
  const toast = useToast();
  const cart = useCart();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);

  const products = useAsync(() => getProducts('', 200), []);
  const stocks = useAsync(() => getStocks('', 200), []);
  const warehouses = useAsync(getWarehouses, []);

  if (products.loading || stocks.loading) {
    return <Loading />;
  }

  const product = (products.data?.items ?? []).find((item) => item.id === productId);
  if (!product) {
    return (
      <div className="page">
        <ErrorPanel message={t('product.notFound')} />
        <Link to="/shop" className="btn btn-outline-secondary mt-2">
          {t('product.back')}
        </Link>
      </div>
    );
  }

  const stock = bestStock(stocks.data?.items ?? [], productId);
  const warehouse = (warehouses.data ?? []).find((item) => item.id === stock?.warehouseId);

  return (
    <div className="page">
      <nav className="breadcrumb-trail">
        <Link to="/shop">{t('shop.title')}</Link>
        <Icon name="chevron" />
        <span>{product.code}</span>
      </nav>

      <div className="detail-grid">
        <section className="panel">
          <header className="panel-head">
            <h2 className="panel-title">{product.name}</h2>
            <span className="panel-sub">{product.code}</span>
          </header>
          <div className="shop-thumb shop-thumb-lg">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} className="shop-img" />
            ) : (
              <Icon name="inventory" size={48} />
            )}
          </div>
          <dl className="info-list mt-3">
            <dt>{t('staff.category')}</dt>
            <dd>{product.category}</dd>
            <dt>{t('staff.unit')}</dt>
            <dd>{product.unit}</dd>
            <dt>{t('product.warehouse')}</dt>
            <dd>{warehouse ? `${warehouse.code} — ${warehouse.name}` : '—'}</dd>
            <dt>{t('products.colAvailable')}</dt>
            <dd data-testid="product-available">{number(stock?.available ?? 0)}</dd>
          </dl>
        </section>

        <aside className="panel">
          <header className="panel-head">
            <h2 className="panel-title">{t('product.details')}</h2>
          </header>
          <p className="product-price num">{money(product.unitPrice)}</p>
          <label className="form-label" htmlFor="qty">
            {t('cart.qty')}
          </label>
          <input
            id="qty"
            type="number"
            min={1}
            max={stock?.available ?? 1}
            className="form-control mb-3"
            value={quantity}
            data-testid="product-qty"
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
          />
          <button
            type="button"
            className="btn btn-primary w-100"
            disabled={!stock}
            data-testid="product-add"
            onClick={() => {
              if (!stock) {
                return;
              }
              cart.add(
                {
                  productId: product.id,
                  code: product.code,
                  name: product.name,
                  unitPrice: product.unitPrice,
                  warehouseId: stock.warehouseId,
                  available: stock.available,
                },
                quantity,
              );
              toast(t('shop.added', { name: product.name }), 'success');
              navigate('/cart');
            }}
          >
            <Icon name="plus" className="me-1" />
            {t('shop.addToCart')}
          </button>
          <Link to="/shop" className="btn btn-outline-secondary w-100 mt-2">
            {t('product.back')}
          </Link>
        </aside>
      </div>
    </div>
  );
}
