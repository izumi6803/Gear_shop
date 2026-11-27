// E2E smoke test (Playwright + Chrome có sẵn trên máy, không cần tải Chromium).
// Chạy: npm run e2e   (cần API :5080/:5081 và SPA preview :4173 đang chạy)
//
// Kịch bản: login → tạo đơn → xác nhận (giữ tồn) → xuất kho (sinh hoá đơn) → chụp screenshot.

import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE = process.env.SPA_BASE ?? 'http://localhost:4173';
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, '../../../docs/img');

const shots = [];
const problems = [];

function ok(message) {
  console.log(`  [PASS] ${message}`);
}

function fail(message) {
  console.error(`  [FAIL] ${message}`);
  problems.push(message);
}

async function shot(page, name) {
  const file = path.join(outDir, `spa-${name}.png`);
  await page.screenshot({ path: file });
  shots.push(file);
  console.log(`  [SHOT] ${path.basename(file)}`);
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const consoleErrors = [];
const failedResponses = [];
page.on('console', (message) => {
  if (message.type() === 'error') {
    consoleErrors.push(message.text());
  }
});
page.on('response', (response) => {
  if (response.status() >= 400) {
    failedResponses.push(`${response.status()} ${response.url()}`);
  }
});
page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

try {
  console.log('\n== 1. Mở app, phải chuyển tới trang đăng nhập');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  if (!page.url().includes('/login')) {
    fail(`URL mong đợi /login, nhận ${page.url()}`);
  } else {
    ok(`redirect → ${page.url()}`);
  }
  await page.waitForSelector('form');
  await shot(page, 'login');

  console.log('\n== 2. Đăng nhập bằng tài khoản Sales');
  await page.getByLabel('Tài khoản').fill('sales');
  await page.getByLabel('Mật khẩu').fill('Sales@123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForSelector('.app-sidebar', { timeout: 15000 });
  await page.waitForSelector('.kpi-card');
  const dashTitle = await page.locator('.page-title').first().innerText();
  if (!dashTitle.includes('Tổng quan')) {
    fail(`không thấy dashboard (title="${dashTitle}")`);
  } else {
    ok('dashboard hiển thị');
  }
  await page.waitForTimeout(600);
  await shot(page, 'dashboard');

  console.log('\n== 3. Mở danh sách đơn hàng');
  await page.getByRole('link', { name: /Đơn hàng/ }).click();
  await page.waitForURL('**/orders');
  await page.waitForSelector('.app-table, .app-empty');
  ok('trang đơn hàng đã load');

  console.log('\n== 4. Tạo đơn mới (Draft)');
  await page.locator('a.btn-primary[href="/orders/new"]').click();
  await page.waitForURL('**/orders/new');
  await page.waitForSelector('#customer');

  await page.getByLabel(/Khách hàng/).selectOption({ index: 1 });

  const productSelect = page.getByLabel('Hàng hoá dòng 1');
  await productSelect.selectOption({ index: 1 });
  const warehouseSelect = page.getByLabel('Kho dòng 1');
  await warehouseSelect.selectOption({ index: 1 });
  await page.getByLabel('Số lượng dòng 1').fill('3');

  await page.waitForTimeout(300);
  const totalText = await page.locator('.totals-grand strong').innerText();
  if (!totalText.includes('¥')) {
    fail(`tổng tiền hiển thị sai: ${totalText}`);
  } else {
    ok(`tổng tiền client tính = ${totalText}`);
  }
  await shot(page, 'order-create');

  await page.getByRole('button', { name: /Lưu đơn/ }).click();
  await page.waitForURL('**/orders', { timeout: 15000 });
  await page.waitForSelector('.app-toast', { timeout: 15000 });
  const createToast = await page.locator('.app-toast').first().innerText();
  if (!createToast.includes('Đã tạo đơn')) {
    fail(`toast tạo đơn bất thường: ${createToast}`);
  } else {
    ok(`toast: ${createToast.replace(/\s+/g, ' ').trim()}`);
  }

  const firstRow = page.locator('tbody tr').first();
  const orderNo = (await firstRow.locator('td').first().innerText()).trim();
  if (!/^SO-\d{6}-\d{4}$/.test(orderNo)) {
    fail(`số đơn không đúng định dạng: ${orderNo}`);
  } else {
    ok(`đơn mới: ${orderNo}`);
  }

  const rowStatus = async () => (await firstRow.locator('.status-pill').innerText()).trim();

  const draftStatus = await rowStatus();
  if (draftStatus !== 'Draft') {
    fail(`trạng thái sau khi tạo phải là Draft, nhận ${draftStatus}`);
  } else {
    ok('trạng thái = Draft');
  }

  console.log('\n== 5. Xác nhận đơn (Ordering gọi Catalog giữ tồn)');
  await firstRow.getByRole('button', { name: 'Xác nhận' }).click();
  await page.waitForSelector('tbody tr:first-child .status-confirmed', { timeout: 20000 });
  if ((await rowStatus()) !== 'Confirmed') {
    fail('không chuyển được sang Confirmed');
  } else {
    ok('trạng thái = Confirmed');
  }

  console.log('\n== 6. Xuất kho (trừ tồn thực tế + sinh hoá đơn)');
  await firstRow.getByRole('button', { name: 'Xuất kho' }).click();
  await page.waitForSelector('tbody tr:first-child .status-shipped', { timeout: 20000 });
  if ((await rowStatus()) !== 'Shipped') {
    fail('không chuyển được sang Shipped');
  } else {
    ok('trạng thái = Shipped');
  }

  const shipToast = await page
    .locator('.app-toast', { hasText: 'hoá đơn' })
    .first()
    .innerText({ timeout: 15000 });
  if (!shipToast.includes('hoá đơn')) {
    fail(`toast xuất kho thiếu thông tin hoá đơn: ${shipToast}`);
  } else {
    ok(`toast: ${shipToast.replace(/\s+/g, ' ').trim()}`);
  }
  await shot(page, 'orders');

  console.log('\n== 7. Xem chi tiết đơn (snapshot giá & tên hàng)');
  await firstRow.getByRole('button', { name: 'Xem chi tiết' }).click();
  await page.waitForSelector('.app-modal');
  const modalText = await page.locator('.app-modal-body').innerText();
  if (!modalText.includes('Tổng cộng')) {
    fail('modal chi tiết thiếu tổng cộng');
  } else {
    ok('modal chi tiết hiển thị đủ dòng hàng + tổng');
  }
  await shot(page, 'order-detail');
  await page.locator('.app-modal .btn-close').click();

  console.log('\n== 8. Trang hàng hoá & tồn kho');
  await page.getByRole('link', { name: /Hàng hoá/ }).click();
  await page.waitForURL('**/products');
  await page.waitForSelector('.app-table');
  const stockRows = await page.locator('tbody tr').count();  if (stockRows === 0) {
    fail('bảng hàng hoá rỗng');
  } else {
    ok(`${stockRows} dòng hàng hoá/tồn kho`);
  }
  await page.waitForTimeout(400);
  await shot(page, 'products');

  console.log('\n== 9. Kiểm tra console / network');
  if (consoleErrors.length > 0) {
    fail(`console error: ${consoleErrors.join(' | ')}`);
  } else {
    ok('không có lỗi console');
  }
  if (failedResponses.length > 0) {
    fail(`HTTP lỗi: ${failedResponses.join(' | ')}`);
  } else {
    ok('không có request nào trả >= 400');
  }
} catch (error) {
  fail(`exception: ${error.message}`);
} finally {
  await browser.close();
}

console.log(`\nScreenshots: ${shots.length} → ${outDir}`);
if (problems.length > 0) {
  console.error(`\n${problems.length} kiểm tra THẤT BẠI`);
  process.exit(1);
}
console.log('\nE2E PASS — FE (React) + BE (.NET) chạy đúng end-to-end');
