import { test, expect } from '@playwright/test';

test.describe('Logística de Despacho E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept and mock brand config & features
    await page.route('**/api/method/paletixa_saas.paletixa_saas.api.get_features', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: {
            client_name: 'La Paletixa',
            colors: { primary: '#9b59b6' },
            features: { logistics: true }
          }
        })
      });
    });

    // Mock logged in user session for logistics operator
    await page.route('**/api/method/frappe.auth.get_logged_user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'logistica@lapaletixa.com' })
      });
    });

    // Set authentication cookies for logistics
    await page.context().addCookies([
      { name: 'user_id', value: 'logistica@lapaletixa.com', domain: 'localhost', path: '/' },
      { name: 'full_name', value: 'Encargado de Logística', domain: 'localhost', path: '/' },
      { name: 'sid', value: 'fake-session-id', domain: 'localhost', path: '/' }
    ]);
  });

  test('should render logistics stock transfer interface', async ({ page }) => {
    // Navigate directly to the logistics module
    await page.goto('/logistica');

    // Verify search input is present
    const searchInput = page.locator('input[placeholder="Buscar paleta o boli..."]');
    await expect(searchInput).toBeVisible();
  });
});
