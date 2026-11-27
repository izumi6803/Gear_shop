import { useMemo, useState } from 'react';
import { getProducts, getStocks, getWarehouses } from '../api/catalog';
import { EmptyState, ErrorPanel, Loading } from '../components/Feedback';
import { useI18n } from '../i18n/I18nContext';
import { useAsync } from '../lib/useAsync';

export function ProductsPage() {
  const { t, money, number } = useI18n();
  const [keyword, setKeyword] = useState('');
  const [warehouseId, setWarehouseId] = useState(0);

  const products = useAsync(() => getProducts(keyword, 200), [keyword]);
  const stocks = useAsync(() => getStocks(keyword, 200), [keyword]);
  const warehouses = useAsync(getWarehouses, []);

  const filteredStocks = useMemo(
    () =>
      (stocks.data?.items ?? []).filter((item) => warehouseId === 0 || item.warehouseId === warehouseId),
    [stocks.data, warehouseId],
  );

  const loading = products.loading || stocks.loading || warehouses.loading;
  const error = products.error ?? stocks.error ?? warehouses.error;

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return (
      <div className="page">
        <ErrorPanel message={error} onRetry={products.reload} />
      </div>
    );
  }

  const productRows = products.data?.items ?? [];

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t('products.title')}</h1>
          <p className="page-subtitle">{t('products.subtitle')}</p>
        </div>
      </header>

      <div className="filter-bar">
        <input
          className="form-control form-control-sm"
          placeholder={t('products.search')}
          aria-label={t('products.searchLabel')}
          value={keyword}
          data-testid="product-search"
          onChange={(event) => setKeyword(event.target.value)}
        />
        <select
          className="form-select form-select-sm"
          aria-label={t('products.warehouseFilter')}
          value={warehouseId}
          data-testid="warehouse-filter"
          onChange={(event) => setWarehouseId(Number(event.target.value))}
        >
          <option value={0}>{t('products.allWarehouses')}</option>
          {(warehouses.data ?? []).map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.code} — {warehouse.name}
            </option>
          ))}
        </select>
      </div>

      <div className="split-grid">
        <section className="panel">
          <header className="panel-head">
            <h2 className="panel-title">{t('products.catalog', { n: number(productRows.length) })}</h2>
          </header>
          {productRows.length === 0 ? (
            <EmptyState message={t('products.empty')} hint={t('products.emptyHint')} />
          ) : (
            <div className="table-wrap">
              <table className="table app-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>{t('products.colCode')}</th>
                    <th>{t('products.colName')}</th>
                    <th className="col-optional">{t('products.colCategory')}</th>
                    <th className="text-end">{t('products.colUnitPrice')}</th>
                    <th className="col-optional">{t('products.colStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {productRows.map((product) => (
                    <tr key={product.id}>
                      <td className="fw-semibold nowrap">{product.code}</td>
                      <td>{product.name}</td>
                      <td className="col-optional text-muted">{product.category}</td>
                      <td className="text-end num">{money(product.unitPrice)}</td>
                      <td className="col-optional">
                        <span className={`status-pill ${product.isActive ? 'status-active' : 'status-draft'}`}>
                          {product.isActive ? t('products.active') : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel">
          <header className="panel-head">
            <h2 className="panel-title">{t('products.stock', { n: number(filteredStocks.length) })}</h2>
            <span className="panel-sub">{t('products.threshold', { n: 20 })}</span>
          </header>
          {filteredStocks.length === 0 ? (
            <EmptyState message={t('products.empty')} hint={t('products.emptyHint')} />
          ) : (
            <div className="table-wrap">
              <table className="table app-table align-middle mb-0">
                <thead>
                  <tr>
                    <th>{t('products.colProduct')}</th>
                    <th className="col-optional">{t('products.colWarehouse')}</th>
                    <th className="text-end">{t('products.colOnHand')}</th>
                    <th className="text-end col-optional">{t('products.colReserved')}</th>
                    <th className="text-end">{t('products.colAvailable')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStocks.map((item) => (
                    <tr key={`${item.productId}-${item.warehouseId}`}>
                      <td>
                        <strong className="nowrap">{item.productCode}</strong>
                        <small className="d-block text-muted">{item.productName}</small>
                      </td>
                      <td className="col-optional nowrap">{item.warehouseCode}</td>
                      <td className="text-end num">{number(item.quantityOnHand)}</td>
                      <td className="text-end num col-optional">{number(item.quantityReserved)}</td>
                      <td
                        className={`text-end num fw-semibold${item.available <= 20 ? ' text-danger' : ''}`}
                      >
                        {number(item.available)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
