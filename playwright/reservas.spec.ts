import { test, expect } from '@playwright/test';

test.describe('Reserva de Eventos E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept and mock brand config & features
    await page.route('**/api/method/paletixa_saas.paletixa_saas.api.get_features', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: {
            client_name: 'La Paletixa',
            colors: { primary: '#1abc9c' },
            features: { reservations: true }
          }
        })
      });
    });

    // Mock logged in user session for operator
    await page.route('**/api/method/frappe.auth.get_logged_user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'admin@lapaletixa.com' })
      });
    });

    // Set authentication cookies for admin/reservations
    await page.context().addCookies([
      { name: 'user_id', value: 'admin@lapaletixa.com', domain: 'localhost', path: '/' },
      { name: 'full_name', value: 'Administrador de Eventos', domain: 'localhost', path: '/' },
      { name: 'sid', value: 'fake-session-id', domain: 'localhost', path: '/' }
    ]);
  });

  test('should render reservations page', async ({ page }) => {
    // Navigate directly to the reservations module
    await page.goto('/reservas');

    // Verify main content or headers are rendered
    const title = page.locator('main');
    await expect(title).toBeVisible();
  });
});
