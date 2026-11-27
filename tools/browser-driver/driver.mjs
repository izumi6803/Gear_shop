// Browser driver: giữ 1 session Chrome sống và nhận lệnh qua HTTP, để có thể
// điều khiển/kiểm tra UI từng bước (khác với e2e chạy một mạch).
//
//   node driver.mjs            # nghe http://127.0.0.1:4599
//   POST /cmd  { "cmd": "goto", "url": "http://localhost:4173/login" }
//
// Hỗ trợ target dạng:
//   "css=..."            CSS thuần
//   "text=Đăng nhập"     Playwright text selector
//   "label=Mật khẩu"     getByLabel
//   "role=button[name=\"Đăng nhập\"]"  getByRole (name hỗ trợ /regex/)

import http from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const PORT = Number(process.env.DRIVER_PORT ?? 4599);
const HOST = '127.0.0.1';
const SCREENSHOT_DIR = process.env.DRIVER_SHOTS ?? path.resolve('../../docs/img');

let browser = null;
let context = null;
let page = null;
let consoleEntries = [];
let networkErrors = [];

function attach(pageInstance) {
  pageInstance.on('console', (message) => {
    consoleEntries.push({ type: message.type(), text: message.text() });
  });
  pageInstance.on('pageerror', (error) => {
    consoleEntries.push({ type: 'pageerror', text: error.message });
  });
  pageInstance.on('response', (response) => {
    if (response.status() >= 400) {
      networkErrors.push({ status: response.status(), url: response.url() });
    }
  });
}

async function ensureBrowser() {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    context = null;
    page = null;
  }
  return browser;
}

async function ensurePage() {
  await ensureBrowser();
  if (!context) {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  }
  if (!page || page.isClosed()) {
    page = await context.newPage();
    attach(page);
  }
  return page;
}

/** Dịch "target" của lệnh thành Playwright locator (có thể scope trong "within"). */
function locatorFor(target, within) {
  if (typeof target !== 'string' || target.length === 0) {
    throw new Error('Thiếu "target" (selector).');
  }

  const scope = within ? page.locator(within) : page;

  if (target.startsWith('role=')) {
    const match = /^role=([a-z]+)\[name=(?:"([^"]*)"|\/([^/]*)\/)\]$/i.exec(target);
    if (!match) {
      throw new Error('Cú pháp role= sai. Ví dụ: role=button[name="Đăng nhập"]');
    }
    const [, role, plainName, regexName] = match;
    const name = regexName !== undefined ? new RegExp(regexName) : plainName;
    return scope.getByRole(role, { name });
  }

  if (target.startsWith('label=')) {
    const raw = target.slice('label='.length);
    // "label=/regex/" hoặc "label=chuỗi con"
    if (raw.length > 2 && raw.startsWith('/') && raw.endsWith('/')) {
      return scope.getByLabel(new RegExp(raw.slice(1, -1)));
    }
    return scope.getByLabel(raw);
  }

  if (target.startsWith('text=')) {
    const raw = target.slice('text='.length);
    if (raw.length > 2 && raw.startsWith('/') && raw.endsWith('/')) {
      return scope.getByText(new RegExp(raw.slice(1, -1)));
    }
    return scope.locator(target);
  }

  if (target.startsWith('css=')) {
    return scope.locator(target);
  }

  return scope.locator(target);
}

async function detailsOf(locator) {
  const count = await locator.count();
  if (count === 0) {
    return { count: 0 };
  }
  const first = locator.first();
  const text = (await first.innerText().catch(() => '')) ?? '';
  const LIMIT = 20000;
  return {
    count,
    text: text.trim().slice(0, LIMIT),
    truncated: text.length > LIMIT,
    visible: await first.isVisible().catch(() => false),
  };
}

const handlers = {
  async open({ url, width = 1440, height = 900, storage }) {
    await ensureBrowser();
    if (context) {
      await context.close().catch(() => {});
      context = null;
      page = null;
    }
    context = await browser.newContext({ viewport: { width, height } });
    if (storage && typeof storage === 'object') {
      const entries = Object.entries(storage);
      await context.addInitScript((pairs) => {
        try {
          for (const [key, value] of pairs) { localStorage.setItem(key, value); }
        } catch {
          // storage not available on this document
        }
      }, entries);
    }
    page = await context.newPage();
    attach(page);
    if (url) {
      await page.goto(url, { waitUntil: 'load' });
    }
    return { url: page.url(), viewport: { width, height } };
  },

  async goto({ url }) {
    // networkidle có thể không bao giờ đạt (SPA còn request/ảnh) → fallback để test không chết oan.
  try {
    await (await ensurePage()).goto(url, { waitUntil: 'load', timeout: 20000 });
  } catch {
    try {
      await (await ensurePage()).goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await (await ensurePage()).waitForTimeout(1200);
    } catch {
      // Page treo hẳn: bỏ context cũ, tạo context mới rồi thử lần cuối.
      try { if (context) { await context.close(); } } catch { /* ignore */ }
      context = null;
      page = null;
      await (await ensurePage()).goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await (await ensurePage()).waitForTimeout(1500);
    }
  }
    return { url: page.url(), title: await page.title() };
  },

  async click({ target, within, timeout = 10000, position }) {
    const locator = locatorFor(target, within);
    const options = { timeout };
    if (position) {
      options.position = { x: Number(position.x), y: Number(position.y) };
    }
    await locator.first().click(options);
    return { clicked: target, within, position };
  },

  async fill({ target, within, value = '' }) {
    await locatorFor(target, within).first().fill(String(value));
    return { filled: target, value };
  },

  async select({ target, within, value, index }) {
    const locator = locatorFor(target, within).first();
    if (index !== undefined) {
      await locator.selectOption({ index: Number(index) });
    } else {
      await locator.selectOption(String(value));
    }
    return { selected: target, value, index };
  },

  async press({ key, target }) {
    if (target) {
      await locatorFor(target).first().press(key);
    } else {
      await (await ensurePage()).keyboard.press(key);
    }
    return { pressed: key };
  },

  async wait({ ms = 500 }) {
    await (await ensurePage()).waitForTimeout(Number(ms));
    return { waited: Number(ms) };
  },

  async waitFor({ target, within, state = 'visible', timeout = 15000 }) {
    await locatorFor(target, within).first().waitFor({ state, timeout });
    return { found: target, state };
  },

  async text({ target, within, all = false }) {
    const pageInstance = await ensurePage();
    if (!target) {
      return { text: (await pageInstance.locator('body').innerText()).slice(0, 4000) };
    }
    const locator = locatorFor(target, within);
    if (all) {
      return { texts: await locator.allInnerTexts() };
    }
    return detailsOf(locator);
  },

  async count({ target, within }) {
    return { count: await locatorFor(target, within).count() };
  },

  async screenshot({ name = 'shot', fullPage = false }) {
    const pageInstance = await ensurePage();
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    const file = path.join(SCREENSHOT_DIR, `${name}.png`);
    await pageInstance.screenshot({ path: file, fullPage });
    return { path: file };
  },

  async viewport({ width = 390, height = 844 }) {
    await (await ensurePage()).setViewportSize({ width: Number(width), height: Number(height) });
    return { width, height };
  },

  async url() {
    return { url: page ? page.url() : null };
  },

  async eval({ expression }) {
    const value = await (await ensurePage()).evaluate(expression);
    return { value };
  },

  async console({ clear = false }) {
    const data = { console: consoleEntries.slice(), networkErrors: networkErrors.slice() };
    if (clear) {
      consoleEntries = [];
      networkErrors = [];
    }
    return data;
  },

  async key({ name }) {
    await (await ensurePage()).keyboard.press(name);
    return { key: name };
  },

  async back() {
    const response = await (await ensurePage()).goBack();
    return { url: page.url(), status: response ? response.status() : null };
  },

  async forward() {
    const response = await (await ensurePage()).goForward();
    return { url: page.url(), status: response ? response.status() : null };
  },

  async media({ type = 'print' }) {
    await (await ensurePage()).emulateMedia({ media: type });
    return { media: type };
  },

  async pdf({ name = 'document', format = 'A4' }) {
    const pageInstance = await ensurePage();
    await mkdir(SCREENSHOT_DIR, { recursive: true });
    const file = path.join(SCREENSHOT_DIR, `${name}.pdf`);
    await pageInstance.pdf({ path: file, format, printBackground: true });
    return { path: file };
  },

  async close() {
    if (browser) {
      await browser.close();
    }
    browser = null;
    context = null;
    page = null;
    return { closed: true };
  },
};

/** Nếu Chrome đã chết giữa chừng, khởi động lại rồi thử lại 1 lần. */
async function runWithRecovery(task) {
  try {
    return await task();
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    const died = /has been closed|Target closed|browser has been closed|Session closed|Protocol error/i.test(message);
    if (!died) {
      throw error;
    }
    console.error(`browser-driver: relaunching browser after: ${message}`);
    try {
      await browser?.close().catch(() => {});
    } catch {
      // ignore
    }
    browser = null;
    context = null;
    page = null;
    await ensureBrowser();
    return await task();
  }
}

async function readBody(request) {  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const server = http.createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (request.method === 'GET' && request.url === '/health') {
    response.end(JSON.stringify({ ok: true, hasPage: Boolean(page) }));
    return;
  }

  if (request.method !== 'POST' || request.url !== '/cmd') {
    response.statusCode = 404;
    response.end(JSON.stringify({ ok: false, error: 'Chỉ hỗ trợ POST /cmd và GET /health' }));
    return;
  }

  try {
    const payload = JSON.parse(await readBody(request) || '{}');
    const handler = handlers[payload.cmd];
    if (!handler) {
      throw new Error(`Lệnh không hỗ trợ: ${payload.cmd}. Có: ${Object.keys(handlers).join(', ')}`);
    }
    const data = await runWithRecovery(() => handler(payload));
    response.end(JSON.stringify({ ok: true, data }));
  } catch (error) {
    response.statusCode = 200;
    response.end(JSON.stringify({ ok: false, error: error.message }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`browser-driver: http://${HOST}:${PORT}  (POST /cmd, GET /health)`);
  console.log(`screenshot dir: ${SCREENSHOT_DIR}`);
});

const shutdown = async () => {
  try {
    await handlers.close();
  } finally {
    server.close(() => process.exit(0));
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
