import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProducts, getStocks } from '../api/catalog';
import type { Stock } from '../api/types';
import { useCart } from '../cart/CartContext';
import { EmptyState, ErrorPanel, Loading } from '../components/Feedback';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n/I18nContext';
import { useAsync } from '../lib/useAsync';

/** Kho tốt nhất cho một sản phẩm (nhiều tồn nhất) — dùng cho checkout. */
export function bestStock(stocks: Stock[], productId: number): Stock | undefined {
  return stocks
    .filter((item) => item.productId === productId && item.available > 0)
    .sort((left, right) => right.available - left.available)[0];
}

export function ShopPage() {
  const { t, money, number } = useI18n();
  const toast = useToast();
  const cart = useCart();
  const [keyword, setKeyword] = useState('');

  const products = useAsync(() => getProducts('', 200), []);
  const stocks = useAsync(() => getStocks('', 200), []);

  const rows = useMemo(() => {
    const list = products.data?.items ?? [];
    const needle = keyword.trim().toLowerCase();
    return list
      .filter((product) => product.isActive)
      .filter((product) =>
        needle.length === 0
          ? true
          : product.code.toLowerCase().includes(needle) || product.name.toLowerCase().includes(needle),
      )
      .map((product) => ({ product, stock: bestStock(stocks.data?.items ?? [], product.id) }));
  }, [products.data, stocks.data, keyword]);

  if (products.loading || stocks.loading) {
    return <Loading />;
  }

  if (products.error || stocks.error) {
    return (
      <div className="page">
        <ErrorPanel message={products.error ?? stocks.error ?? ''} onRetry={products.reload} />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t('shop.title')}</h1>
          <p className="page-subtitle">{t('shop.subtitle')}</p>
        </div>
        <Link className="btn btn-outline-primary" to="/cart" data-testid="go-cart">
          <Icon name="invoice" className="me-1" />
          {t('nav.cart')}
          {cart.count > 0 ? <span className="badge-count">{cart.count}</span> : null}
        </Link>
      </header>

      <div className="filter-bar">
        <input
          className="form-control form-control-sm"
          placeholder={t('shop.search')}
          aria-label={t('shop.search')}
          value={keyword}
          data-testid="shop-search"
          onChange={(event) => setKeyword(event.target.value)}
        />
      </div>

      {rows.length === 0 ? (
        <section className="panel">
          <EmptyState message={t('shop.empty')} hint={t('shop.emptyHint')} />
        </section>
      ) : (
        <div className="shop-grid">
          {rows.map(({ product, stock }) => {
            const available = stock?.available ?? 0;
            return (
              <article className="shop-card" key={product.id} data-testid={`shop-card-${product.code}`}>
                <div className="shop-thumb">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} loading="lazy" className="shop-img" />
                  ) : (
                    <Icon name="inventory" size={26} />
                  )}
                </div>
                <div className="shop-body">
                  <span className="shop-code">{product.code}</span>
                  <h2 className="shop-name">
                    <Link to={`/shop/${product.id}`}>{product.name}</Link>
                  </h2>
                  <span className="shop-category">{product.category}</span>
                  <div className="shop-foot">
                    <strong className="shop-price num">{money(product.unitPrice)}</strong>
                    {available === 0 ? (
                      <span className="status-pill status-cancelled">{t('shop.outOfStock')}</span>
                    ) : available <= 20 ? (
                      <span className="status-pill status-draft">
                        {t('shop.lowStock', { n: number(available) })}
                      </span>
                    ) : (
                      <span className="status-pill status-active">
                        {t('shop.inStock', { n: number(available) })}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm w-100 mt-2"
                    disabled={!stock}
                    data-testid={`add-${product.code}`}
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
                        1,
                      );
                      toast(t('shop.added', { name: product.name }), 'success');
                    }}
                  >
                    <Icon name="plus" className="me-1" />
                    {t('shop.addToCart')}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
