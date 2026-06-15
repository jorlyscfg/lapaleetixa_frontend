import { test, expect } from '@playwright/test';

test.describe('Venta Mayorista (Puntos Fijos) E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept and mock brand config & features
    await page.route('**/api/method/paletixa_saas.paletixa_saas.api.get_features', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: {
            client_name: 'La Paletixa',
            colors: { primary: '#3498db' },
            features: { wholesale: true }
          }
        })
      });
    });

    // Mock logged in user session for wholesale client
    await page.route('**/api/method/frappe.auth.get_logged_user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'mayorista@gmail.com' })
      });
    });

    // Set authentication cookies for wholesale
    await page.context().addCookies([
      { name: 'user_id', value: 'mayorista@gmail.com', domain: 'localhost', path: '/' },
      { name: 'full_name', value: 'Cliente Mayorista', domain: 'localhost', path: '/' },
      { name: 'sid', value: 'fake-session-id', domain: 'localhost', path: '/' }
    ]);
  });

  test('should render points of sale wholesale panel', async ({ page }) => {
    // Navigate directly to the puntos-fijos module
    await page.goto('/puntos-fijos');

    // Verify main content container is rendered
    const container = page.locator('main');
    await expect(container).toBeVisible();
  });
});
