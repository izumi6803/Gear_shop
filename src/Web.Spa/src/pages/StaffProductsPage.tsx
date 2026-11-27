import { useState } from 'react';
import { ApiError } from '../api/client';
import { adjustStock, createProduct, getProducts, getStocks, getWarehouses, updateProduct } from '../api/catalog';
import type { Product, ProductUpsertInput } from '../api/types';
import { ErrorPanel, Loading } from '../components/Feedback';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n/I18nContext';
import { useAsync } from '../lib/useAsync';

const EMPTY: ProductUpsertInput = {
  code: '',
  name: '',
  category: '',
  unit: 'pcs',
  unitPrice: 0,
  isActive: true,
  imageUrl: '',
};

export function StaffProductsPage() {
  const { t, money, number } = useI18n();
  const toast = useToast();
  const products = useAsync(() => getProducts('', 200), []);
  const stocks = useAsync(() => getStocks('', 200), []);
  const warehouses = useAsync(getWarehouses, []);

  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductUpsertInput>(EMPTY);
  const [openForm, setOpenForm] = useState(false);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [warehouseId, setWarehouseId] = useState(0);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('manual adjustment');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (products.loading || stocks.loading) {
    return <Loading />;
  }

  if (products.error || stocks.error) {
    return (
      <div className="page">
        <ErrorPanel
          message={products.error ?? stocks.error ?? ''}
          onRetry={products.reload}
          retryLabel={t('common.retry')}
        />
      </div>
    );
  }

  const available = (productId: number): number =>
    (stocks.data?.items ?? [])
      .filter((item) => item.productId === productId)
      .reduce((sum, item) => sum + item.available, 0);

  const startCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpenForm(true);
    setError(null);
  };

  const startEdit = (product: Product) => {
    setEditing(product);
    setForm({
      code: product.code,
      name: product.name,
      category: product.category,
      unit: product.unit,
      unitPrice: product.unitPrice,
      isActive: product.isActive,
      imageUrl: product.imageUrl ?? '',
    });
    setOpenForm(true);
    setError(null);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await updateProduct(editing.id, form);
      } else {
        await createProduct(form);
      }
      toast(t('staff.saved', { code: form.code }), 'success');
      setOpenForm(false);
      products.reload();
      stocks.reload();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const applyAdjust = async () => {
    if (!adjusting) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adjustStock({
        productId: adjusting.id,
        warehouseId: warehouseId || (warehouses.data ?? [])[0]?.id || 1,
        quantityDelta: delta,
        reason,
      });
      toast(t('staff.adjusted', { code: adjusting.code }), 'success');
      setAdjusting(null);
      setDelta(0);
      stocks.reload();
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
          <h1 className="page-title">{t('staff.title')}</h1>
          <p className="page-subtitle">{t('staff.subtitle')}</p>
        </div>
        <button type="button" className="btn btn-primary" data-testid="new-product" onClick={startCreate}>
          <Icon name="plus" className="me-1" />
          {t('staff.new')}
        </button>
      </header>

      {error ? (
        <div className="alert alert-danger py-2 small" role="alert" data-testid="staff-error">
          {error}
        </div>
      ) : null}

      {openForm ? (
        <section className="panel">
          <header className="panel-head">
            <h2 className="panel-title">{editing ? t('staff.edit') : t('staff.new')}</h2>
          </header>
          <div className="form-grid">
            <div>
              <label className="form-label" htmlFor="pCode">
                {t('staff.code')}
              </label>
              <input
                id="pCode"
                className="form-control"
                value={form.code}
                disabled={Boolean(editing)}
                data-testid="product-code"
                onChange={(event) => setForm({ ...form, code: event.target.value })}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="pName">
                {t('staff.name')}
              </label>
              <input
                id="pName"
                className="form-control"
                value={form.name}
                data-testid="product-name"
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="pCategory">
                {t('staff.category')}
              </label>
              <input
                id="pCategory"
                className="form-control"
                value={form.category}
                data-testid="product-category"
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="pUnit">
                {t('staff.unit')}
              </label>
              <input
                id="pUnit"
                className="form-control"
                value={form.unit}
                data-testid="product-unit"
                onChange={(event) => setForm({ ...form, unit: event.target.value })}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="pPrice">
                {t('staff.price')}
              </label>
              <input
                id="pPrice"
                type="number"
                step="0.01"
                className="form-control"
                value={form.unitPrice}
                data-testid="product-price"
                onChange={(event) => setForm({ ...form, unitPrice: Number(event.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="pImage">
                Image URL
              </label>
              <input
                id="pImage"
                className="form-control"
                placeholder="/products/p-1001.svg"
                value={form.imageUrl ?? ''}
                data-testid="product-image"
                onChange={(event) => setForm({ ...form, imageUrl: event.target.value })}
              />
            </div>
<div className="d-flex align-items-end">
              <div className="form-check">
                <input
                  id="pActive"
                  className="form-check-input"
                  type="checkbox"
                  checked={form.isActive ?? true}
                  data-testid="product-active"
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                />
                <label className="form-check-label" htmlFor="pActive">
                  {t('staff.active')}
                </label>
              </div>
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-primary" disabled={busy} data-testid="product-save" onClick={save}>
              {t('staff.save')}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setOpenForm(false)}>
              {t('common.cancel')}
            </button>
          </div>
        </section>
      ) : null}

      {adjusting ? (
        <section className="panel">
          <header className="panel-head">
            <h2 className="panel-title">{t('staff.adjustTitle', { code: adjusting.code })}</h2>
          </header>
          <div className="form-grid">
            <div>
              <label className="form-label" htmlFor="aWwh">
                {t('staff.warehouse')}
              </label>
              <select
                id="aWwh"
                className="form-select"
                value={warehouseId || (warehouses.data ?? [])[0]?.id || 0}
                data-testid="adjust-warehouse"
                onChange={(event) => setWarehouseId(Number(event.target.value))}
              >
                {(warehouses.data ?? []).map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.code} — {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="aDelta">
                {t('staff.delta')}
              </label>
              <input
                id="aDelta"
                type="number"
                className="form-control"
                value={delta}
                data-testid="adjust-delta"
                onChange={(event) => setDelta(Number(event.target.value) || 0)}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="aReason">
                {t('staff.reason')}
              </label>
              <input
                id="aReason"
                className="form-control"
                value={reason}
                data-testid="adjust-reason"
                onChange={(event) => setReason(event.target.value)}
              />
            </div>
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              data-testid="adjust-submit"
              onClick={applyAdjust}
            >
              {t('staff.adjust')}
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setAdjusting(null)}>
              {t('common.cancel')}
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="table-wrap">
          <table className="table app-table align-middle mb-0">
            <thead>
              <tr>
                <th>{t('staff.code')}</th>
                <th>{t('staff.name')}</th>
                <th className="col-optional">{t('staff.category')}</th>
                <th className="text-end">{t('staff.price')}</th>
                <th className="text-end">{t('products.colAvailable')}</th>
                <th>{t('accounts.status')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(products.data?.items ?? []).map((product) => (
                <tr key={product.id} data-testid={`staff-row-${product.code}`}>
                  <td className="fw-semibold nowrap">{product.code}</td>
                  <td>{product.name}</td>
                  <td className="col-optional">{product.category}</td>
                  <td className="text-end num">{money(product.unitPrice)}</td>
                  <td className="text-end num" data-testid={`staff-available-${product.code}`}>
                    {number(available(product.id))}
                  </td>
                  <td>
                    <span className={`status-pill ${product.isActive ? 'status-active' : 'status-cancelled'}`}>
                      {product.isActive ? t('staff.active') : t('common.no')}
                    </span>
                  </td>
                  <td className="text-end nowrap">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary me-1"
                      data-testid={`staff-edit-${product.code}`}
                      onClick={() => startEdit(product)}
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      data-testid={`staff-adjust-${product.code}`}
                      onClick={() => {
                        setAdjusting(product);
                        setWarehouseId((warehouses.data ?? [])[0]?.id ?? 0);
                        setError(null);
                      }}
                    >
                      {t('staff.adjust')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
