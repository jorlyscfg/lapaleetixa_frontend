import { expect, test } from "@playwright/test";

test.describe("PWA installability baseline", () => {
  test("serves generic installability metadata", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");

    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("application/manifest+json");

    const manifest = await response.json();

    expect(manifest).toMatchObject({
      name: "Plataforma SaaS",
      short_name: "SaaS",
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#020617",
      theme_color: "#0f172a",
    });
    expect(manifest.name).not.toMatch(/tenant|cliente|paletixa/i);
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/icon-192x192.png", sizes: "192x192", type: "image/png" }),
        expect.objectContaining({ src: "/icon-512x512.png", sizes: "512x512", type: "image/png" }),
        expect.objectContaining({ src: "/icon-maskable-512x512.png", sizes: "512x512", purpose: "maskable" }),
      ]),
    );
  });

  test("serves the root service worker with no-store headers and no data caching", async ({ request }) => {
    const response = await request.get("/sw.js");

    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("application/javascript");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["cache-control"]).toContain("must-revalidate");
    expect(response.headers()["service-worker-allowed"]).toBe("/");

    const source = await response.text();
    expect(source).toContain("event.respondWith(fetch(event.request))");
    expect(source).not.toMatch(/\bcaches\b|CacheStorage|\.put\(|\.addAll\(/);
    expect(source).not.toMatch(/indexedDB|localStorage|BackgroundSync|sync/);
  });

  test("does not show a disruptive update prompt on the current app", async ({ page }) => {
    await page.route("**/api/method/paletixa_saas.paletixa_saas.api.get_features", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          message: {
            client_name: "La Paletixa Test",
            colors: { primary: "#3498db" },
            features: { pos: true, production: true, logistics: true },
          },
        }),
      });
    });

    await page.goto("/");

    await expect(page.getByText("Actualización disponible")).toHaveCount(0);
  });
});
