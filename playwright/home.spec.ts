import { test, expect } from '@playwright/test';

test.describe('SaaS Portal Home Page E2E', () => {
  test('should load the home page and render the login form', async ({ page }) => {
    // Navigate to the local Next.js frontend
    await page.goto('/');

    // Wait for the main container or headings to be rendered
    const brandHeading = page.locator('h2');
    await expect(brandHeading).toBeVisible();

    // Verify email and password fields exist
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    // Verify the login button is present
    const loginButton = page.locator('button[type="submit"]');
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toHaveText('Entrar a la Plataforma');
  });
});
