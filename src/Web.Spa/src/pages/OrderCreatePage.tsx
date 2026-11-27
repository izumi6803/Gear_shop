import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts, getStocks, getWarehouses } from '../api/catalog';
import { createOrder, getCustomers } from '../api/ordering';
import type { CreateOrderInput } from '../api/types';
import { ErrorPanel, Loading } from '../components/Feedback';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { useI18n } from '../i18n/I18nContext';
import { useAsync } from '../lib/useAsync';

interface DraftLine {
  productId: number;
  warehouseId: number;
  quantity: number;
}

const emptyLine: DraftLine = { productId: 0, warehouseId: 0, quantity: 1 };

export function OrderCreatePage() {
  const { t, money, number } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();

  const customers = useAsync(getCustomers, []);
  const products = useAsync(() => getProducts('', 200), []);
  const warehouses = useAsync(getWarehouses, []);
  const stocks = useAsync(() => getStocks('', 200), []);

  const [customerId, setCustomerId] = useState(0);
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([{ ...emptyLine }]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loading = customers.loading || products.loading || warehouses.loading || stocks.loading;
  const loadError = customers.error ?? products.error ?? warehouses.error ?? stocks.error;

  const priceOf = (productId: number): number =>
    products.data?.items.find((item) => item.id === productId)?.unitPrice ?? 0;

  const availableOf = (productId: number, warehouseId: number): number | undefined =>
    stocks.data?.items.find((item) => item.productId === productId && item.warehouseId === warehouseId)
      ?.available;

  const subTotal = useMemo(
    () => lines.reduce((sum, line) => sum + priceOf(line.productId) * line.quantity, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, products.data],
  );
  const tax = Math.round(subTotal * 0.1);
  const total = subTotal + tax;

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((current) =>
      current.map((line, position) => (position === index ? { ...line, ...patch } : line)),
    );
  }

  function addLine() {
    setLines((current) => [...current, { ...emptyLine }]);
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, position) => position !== index));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (customerId <= 0) {
      setFormError(t('create.needCustomer'));
      return;
    }
    if (!orderDate) {
      setFormError(t('create.needDate'));
      return;
    }

    for (const [index, line] of lines.entries()) {
      const n = index + 1;
      if (line.productId <= 0 && line.quantity > 0) {
        setFormError(t('create.needProduct', { n }));
        return;
      }
      if (line.productId > 0 && line.quantity <= 0) {
        setFormError(t('create.needQuantity', { n }));
        return;
      }
      if (line.productId > 0 && line.warehouseId <= 0) {
        setFormError(t('create.needWarehouse', { n }));
        return;
      }
    }

    const validLines = lines.filter((line) => line.productId > 0 && line.quantity > 0);
    if (validLines.length === 0) {
      setFormError(t('create.needLine'));
      return;
    }

    const input: CreateOrderInput = {
      customerId,
      orderDate,
      note: note.trim() ? note.trim() : null,
      lines: validLines.map((line) => ({
        productId: line.productId,
        warehouseId: line.warehouseId,
        quantity: line.quantity,
      })),
    };

    setSaving(true);
    try {
      const order = await createOrder(input);
      toast(
        t('create.toastCreated', {
          no: order.orderNo,
          status: order.status,
          amount: money(order.totalAmount),
        }),
      );
      navigate('/orders');
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : t('create.failed'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">{t('create.title')}</h1>
          <p className="page-subtitle">{t('create.subtitle')}</p>
        </div>
        <span className="status-pill status-draft">Draft</span>
      </header>

      {loadError ? <ErrorPanel message={loadError} onRetry={customers.reload} /> : null}

      <form onSubmit={onSubmit} noValidate>
        <section className="panel">
          <header className="panel-head">
            <h2 className="panel-title">{t('create.info')}</h2>
          </header>
          <div className="form-grid">
            <div className="form-field">
              <label className="form-label" htmlFor="customer">
                {t('create.customer')} <span className="text-danger">*</span>
              </label>
              <select
                id="customer"
                className="form-select"
                value={customerId}
                required
                data-testid="order-customer"
                onChange={(event) => setCustomerId(Number(event.target.value))}
              >
                <option value={0}>{t('create.chooseCustomer')}</option>
                {(customers.data ?? []).map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.code} — {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label className="form-label" htmlFor="orderDate">
                {t('create.orderDate')}
              </label>
              <input
                id="orderDate"
                type="date"
                className="form-control"
                value={orderDate}
                required
                data-testid="order-date"
                onChange={(event) => setOrderDate(event.target.value)}
              />
            </div>

            <div className="form-field form-field-wide">
              <label className="form-label" htmlFor="note">
                {t('create.note')}
              </label>
              <input
                id="note"
                className="form-control"
                placeholder={t('create.notePlaceholder')}
                value={note}
                data-testid="order-note"
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="panel">
          <header className="panel-head">
            <h2 className="panel-title">{t('create.lines')}</h2>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={addLine}
              data-testid="add-line"
            >
              <Icon name="plus" className="me-1" />
              {t('create.addLine')}
            </button>
          </header>

          <div className="table-wrap">
            <table className="table app-table align-middle mb-0">
              <thead>
                <tr>
                  <th>{t('create.product')}</th>
                  <th>{t('create.warehouse')}</th>
                  <th className="text-end">{t('create.quantity')}</th>
                  <th className="text-end">{t('create.amount')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const available = availableOf(line.productId, line.warehouseId);
                  const overStock = available !== undefined && line.quantity > available;
                  const amount = priceOf(line.productId) * line.quantity;

                  return (
                    <tr key={index}>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          aria-label={`${t('create.product')} ${index + 1}`}
                          value={line.productId}
                          data-testid={`line-product-${index + 1}`}
                          onChange={(event) =>
                            updateLine(index, { productId: Number(event.target.value) })
                          }
                        >
                          <option value={0}>{t('create.chooseProduct')}</option>
                          {(products.data?.items ?? []).map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.code} — {product.name} ({money(product.unitPrice)})
                            </option>
                          ))}
                        </select>
                        {available !== undefined ? (
                          <small className={overStock ? 'text-danger' : 'text-muted'}>
                            {t('create.available', { n: number(available) })}
                            {overStock ? ` — ${t('create.overStock')}` : ''}
                          </small>
                        ) : null}
                      </td>
                      <td>
                        <select
                          className="form-select form-select-sm"
                          aria-label={`${t('create.warehouse')} ${index + 1}`}
                          value={line.warehouseId}
                          data-testid={`line-warehouse-${index + 1}`}
                          onChange={(event) =>
                            updateLine(index, { warehouseId: Number(event.target.value) })
                          }
                        >
                          <option value={0}>—</option>
                          {(warehouses.data ?? []).map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>
                              {warehouse.code}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="text-end" style={{ width: 120 }}>
                        <input
                          type="number"
                          min={1}
                          className="form-control form-control-sm text-end"
                          aria-label={`${t('create.quantity')} ${index + 1}`}
                          value={line.quantity}
                          data-testid={`line-quantity-${index + 1}`}
                          onChange={(event) => {
                            const parsed = Number(event.target.value);
                            updateLine(index, { quantity: Number.isFinite(parsed) ? parsed : 0 });
                          }}
                        />
                      </td>
                      <td className="text-end num">{money(amount)}</td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          aria-label={t('create.removeLine', { n: index + 1 })}
                          data-testid={`remove-line-${index + 1}`}
                          onClick={() => removeLine(index)}
                          disabled={lines.length === 1}
                        >
                          <Icon name="close" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="totals-block">
            <div className="totals-row">
              <span>{t('create.subtotal')}</span>
              <strong className="num" data-testid="total-subtotal">
                {money(subTotal)}
              </strong>
            </div>
            <div className="totals-row">
              <span>{t('create.tax')}</span>
              <strong className="num">{money(tax)}</strong>
            </div>
            <div className="totals-row totals-grand">
              <span>{t('create.total')}</span>
              <strong className="num" data-testid="total-grand">
                {money(total)}
              </strong>
            </div>
          </div>
        </section>

        {formError ? (
          <div className="alert alert-danger py-2 mt-3" role="alert" data-testid="form-error">
            {formError}
          </div>
        ) : null}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving} data-testid="save-order">
            {saving ? t('create.saving') : t('create.save')}
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate('/orders')}
          >
            {t('create.back')}
          </button>
        </div>
      </form>
    </div>
  );
}
