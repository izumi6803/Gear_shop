// E2E: đổi tài khoản ở tab khác thì tab cũ KHÔNG được tiếp tục hiển thị tài khoản trước.
// Chạy: node e2e/multi-tab-auth.mjs   (cần SPA ở :4173 và 2 API đang chạy)

import { chromium } from 'playwright';

const BASE = process.env.SPA_BASE ?? 'http://localhost:4173';
const problems = [];

function ok(message) {
  console.log(`  [PASS] ${message}`);
}
function fail(message) {
  console.error(`  [FAIL] ${message}`);
  problems.push(message);
}

async function chip(page) {
  const el = page.locator('.app-user-meta strong');
  return (await el.count()) > 0 ? (await el.first().innerText()).trim() : '(none)';
}

async function role(page) {
  const el = page.locator('.app-user-meta small');
  return (await el.count()) > 0 ? (await el.first().innerText()).trim() : '(none)';
}

async function signIn(page, username, password) {
  await page.getByTestId('login-username').fill(username);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await page.waitForTimeout(2200);
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

try {
  console.log('\n== Tab A: sign in as admin');
  const tabA = await context.newPage();
  await tabA.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await tabA.waitForTimeout(800);
  await signIn(tabA, 'admin', 'Admin@123');
  if ((await role(tabA)) === 'Admin') {
    ok(`tab A is admin (${await chip(tabA)})`);
  } else {
    fail(`tab A expected Admin, got ${await role(tabA)}`);
  }

  console.log('\n== Tab B: sign in as sales (different tab, same browser)');
  const tabB = await context.newPage();
  await tabB.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await tabB.waitForTimeout(800);
  await signIn(tabB, 'sales', 'Sales@123');
  if ((await role(tabB)) === 'Sales') {
    ok(`tab B is sales (${await chip(tabB)})`);
  } else {
    fail(`tab B expected Sales, got ${await role(tabB)}`);
  }

  console.log('\n== Tab A must drop the admin session');
  await tabA.bringToFront();
  await tabA.waitForTimeout(1800);
  const urlA = tabA.url();
  const chipA = await chip(tabA);
  if (urlA.includes('/login')) {
    ok(`tab A redirected to login (${urlA})`);
  } else {
    fail(`tab A still on ${urlA} with chip "${chipA}"`);
  }
  if (chipA !== 'System Administrator') {
    ok(`tab A no longer shows the admin account (chip="${chipA}")`);
  } else {
    fail('tab A still shows "System Administrator" after another tab signed in as sales');
  }

  console.log('\n== Tab B keeps its own session');
  await tabB.bringToFront();
  await tabB.waitForTimeout(600);
  if ((await role(tabB)) === 'Sales') {
    ok(`tab B still sales (${await chip(tabB)})`);
  } else {
    fail(`tab B lost its session, role=${await role(tabB)}`);
  }

  console.log('\n== Signing out in one tab also ends the other tabs');
  await tabB.getByTestId('logout').click();
  await tabB.waitForTimeout(1500);
  await tabA.waitForTimeout(1200);
  if (tabA.url().includes('/login') && tabB.url().includes('/login')) {
    ok('both tabs are at the login page');
  } else {
    fail(`after logout: tabA=${tabA.url()} tabB=${tabB.url()}`);
  }
} catch (error) {
  fail(`exception: ${error.message}`);
} finally {
  await browser.close();
}

console.log('');
if (problems.length > 0) {
  console.error(`${problems.length} check(s) FAILED`);
  process.exit(1);
}
console.log('MULTI-TAB AUTH: ALL PASS');
