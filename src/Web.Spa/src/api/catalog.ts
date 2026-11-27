import { get, post, put } from './client';
import type { PagedResult, Product, ProductUpsertInput, Stock, Warehouse } from './types';

export function getProducts(keyword = '', pageSize = 100): Promise<PagedResult<Product>> {
  const query = new URLSearchParams({
    page: '1',
    pageSize: String(pageSize),
    keyword,
  });
  return get<PagedResult<Product>>('catalog', `/api/products?${query.toString()}`);
}

export function getStocks(keyword = '', pageSize = 200): Promise<PagedResult<Stock>> {
  const query = new URLSearchParams({
    page: '1',
    pageSize: String(pageSize),
    keyword,
  });
  return get<PagedResult<Stock>>('catalog', `/api/stocks?${query.toString()}`);
}

export function getWarehouses(): Promise<Warehouse[]> {
  return get<Warehouse[]>('catalog', '/api/warehouses');
}

// ---------- Back office: Sales quản lý sản phẩm & tồn kho ----------

export function createProduct(input: ProductUpsertInput): Promise<Product> {
  return post<Product>('catalog', '/api/products', input);
}

export function updateProduct(id: number, input: ProductUpsertInput): Promise<Product> {
  return put<Product>('catalog', `/api/products/${id}`, input);
}

export function adjustStock(input: {
  productId: number;
  warehouseId: number;
  quantityDelta: number;
  reason: string;
}): Promise<Stock> {
  return post<Stock>('catalog', '/api/stocks/adjust', input);
}
