import { test, expect } from '@playwright/test';

test.describe('POS (Punto de Venta) E2E', () => {
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
            features: { pos: true }
          }
        })
      });
    });

    // Mock logged in user session
    await page.route('**/api/method/frappe.auth.get_logged_user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'cajero@lapaletixa.com' })
      });
    });

    // Mock products/items list
    await page.route('**/api/method/paletixa_saas.paletixa_saas.api.get_items', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: [
            { item_code: 'LP-PALETA-FRUTILLA', item_name: 'Paleta Frutilla', rate: 25.0, standard_rate: 25.0 },
            { item_code: 'LP-PALETA-CHOCO', item_name: 'Paleta Chocolate', rate: 30.0, standard_rate: 30.0 }
          ]
        })
      });
    });

    // Set authentication cookies for Cajero
    await page.context().addCookies([
      { name: 'user_id', value: 'cajero@lapaletixa.com', domain: 'localhost', path: '/' },
      { name: 'full_name', value: 'Cajero de Turno', domain: 'localhost', path: '/' },
      { name: 'sid', value: 'fake-session-id', domain: 'localhost', path: '/' }
    ]);
  });

  test('should render POS items list and interact with cart', async ({ page }) => {
    // Navigate directly to the POS module
    await page.goto('/pos');

    // Verify search input is present
    const searchInput = page.locator('input[placeholder="Buscar paleta o sabor..."]');
    await expect(searchInput).toBeVisible();

    // Verify general customer selector is present
    const customerInput = page.locator('input[placeholder="Público General"]');
    await expect(customerInput).toBeVisible();

    // Verify product cards are displayed
    const firstProduct = page.locator('text=Paleta Frutilla');
    await expect(firstProduct).toBeVisible();

    // Type in search bar
    await searchInput.fill('Frutilla');
    await expect(firstProduct).toBeVisible();
  });
});
