import { test, expect, type Page } from '@playwright/test';

// The nginx stub serves this marker at /importer; Actual's SPA never does.
const STUB = 'IMPORTER_STUB_OK';

// Wait until Actual's service worker is installed AND controlling the page. Only
// a *controlling* SW intercepts the next navigation — that's what makes the
// denylist assertion meaningful (an active SW without our patch would serve the
// SPA shell for /importer instead of letting it reach the network).
async function waitForControllingServiceWorker(page: Page) {
  await page.goto('/');
  await page.waitForFunction(
    async () => {
      if (!('serviceWorker' in navigator)) return false;
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      return !!reg && !!navigator.serviceWorker.controller;
    },
    null,
    { timeout: 30_000 },
  );
}

test('service worker hands /importer off to the server (denylist works)', async ({ page }) => {
  await waitForControllingServiceWorker(page);
  // With a controlling SW, navigating to /importer must reach the network
  // (→ nginx stub) rather than being served Actual's cached SPA shell.
  await page.goto('/importer');
  await expect(page.locator('#importer-stub')).toHaveText(STUB);
});

test('control: a normal route is still served by the Actual SPA', async ({ page }) => {
  await waitForControllingServiceWorker(page);
  await page.goto('/budget');
  // The stub marker must be absent — the SW served Actual for this route.
  await expect(page.locator('#importer-stub')).toHaveCount(0);
  await expect(page).toHaveURL(/\/budget$/);
});

// Reach the main app + sidebar via a server-backed demo budget. A fresh
// actual-server shows "Where's the server?" (/config-server): "Use current
// domain" fills the URL, "OK" validates + persists it, then the app routes to
// /bootstrap, whose "Try Demo" opens a demo budget (rendering the full sidebar)
// without setting a password. We use the demo (server) path rather than a local
// "Start fresh" budget, which hangs at "Creating budget..." in no-server mode.
async function openDemoBudget(page: Page) {
  const tryDemo = page.getByRole('button', { name: 'Try Demo' });
  // The cold server's first config-server→bootstrap pass can stall before routing
  // to /bootstrap (the first /info + /account/needs-bootstrap calls are slow). The
  // *second* full pass is fast because that first pass warmed the server — which is
  // exactly why a test-level retry always passes. Re-run the whole onboarding from
  // a fresh load until "Try Demo" (on /bootstrap) appears, so attempt 1 is reliable.
  await expect(async () => {
    await page.goto('/');
    const useCurrentDomain = page.getByRole('button', { name: 'Use current domain' });
    await expect(useCurrentDomain.or(tryDemo)).toBeVisible({ timeout: 10_000 });
    if (await useCurrentDomain.isVisible()) {
      await useCurrentDomain.click();
      await page.getByRole('button', { name: 'OK' }).click();
    }
    await expect(tryDemo).toBeVisible({ timeout: 12_000 });
  }).toPass({ timeout: 90_000 });
  await tryDemo.click();
}

test('Importer sidebar button renders and navigates to the importer', async ({ page }) => {
  test.setTimeout(150_000);
  await openDemoBudget(page);

  // The patched PrimaryButtons adds <Item title="Importer" to="/importer"
  // reloadDocument/>, which renders as a sidebar link named "Importer".
  const importer = page.getByRole('link', { name: 'Importer' });
  await expect(importer).toBeVisible({ timeout: 30_000 });

  await importer.click();
  // reloadDocument forces a full navigation; the SW denylist lets /importer
  // reach the network; nginx serves the stub. All three in one assertion.
  await expect(page.locator('#importer-stub')).toHaveText(STUB);
  await expect(page).toHaveURL(/\/importer\/?$/);
});
