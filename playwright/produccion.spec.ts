import { test, expect } from '@playwright/test';

test.describe('Control de Producción E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept and mock brand config & features
    await page.route('**/api/method/paletixa_saas.paletixa_saas.api.get_features', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: {
            client_name: 'La Paletixa',
            colors: { primary: '#2ecc71' },
            features: { production: true }
          }
        })
      });
    });

    // Mock logged in user session for production operator
    await page.route('**/api/method/frappe.auth.get_logged_user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'produccion@lapaletixa.com' })
      });
    });

    // Set authentication cookies for production
    await page.context().addCookies([
      { name: 'user_id', value: 'produccion@lapaletixa.com', domain: 'localhost', path: '/' },
      { name: 'full_name', value: 'Operador de Planta', domain: 'localhost', path: '/' },
      { name: 'sid', value: 'fake-session-id', domain: 'localhost', path: '/' }
    ]);
  });

  test('should render production entries interface', async ({ page }) => {
    // Navigate directly to the production module
    await page.goto('/produccion');

    // Verify search input is present
    const searchInput = page.locator('input[placeholder="Buscar producto..."]');
    await expect(searchInput).toBeVisible();
  });
});
