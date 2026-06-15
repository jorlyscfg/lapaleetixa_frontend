import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

const files = {
  manifest: path.join(root, "src/app/manifest.ts"),
  serviceWorker: path.join(root, "public/sw.js"),
  nextConfig: path.join(root, "next.config.ts"),
  checklist: path.join(root, "docs/pwa-manual-validation.md"),
  icon192: path.join(root, "public/icon-192x192.png"),
  icon512: path.join(root, "public/icon-512x512.png"),
  iconMaskable: path.join(root, "public/icon-maskable-512x512.png"),
};

const failures = [];

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

async function readText(file) {
  return readFile(file, "utf8");
}

async function readPngSize(file) {
  const bytes = await readFile(file);
  const pngSignature = "89504e470d0a1a0a";

  expect(bytes.subarray(0, 8).toString("hex") === pngSignature, `${path.relative(root, file)} is not a PNG file`);

  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

const [manifest, serviceWorker, nextConfig, checklist] = await Promise.all([
  readText(files.manifest),
  readText(files.serviceWorker),
  readText(files.nextConfig),
  readText(files.checklist),
]);

expect(manifest.includes('name: "Plataforma SaaS"'), "Manifest must use the generic SaaS app name");
expect(manifest.includes('short_name: "SaaS"'), "Manifest must use the generic SaaS short name");
expect(manifest.includes('start_url: "/"'), "Manifest must start at the root URL");
expect(manifest.includes('scope: "/"'), "Manifest must use root scope");
expect(manifest.includes('display: "standalone"'), "Manifest must use standalone display");
expect(!/cliente|paletixa/i.test(manifest), "Manifest source must not contain customer-specific branding");

expect(serviceWorker.includes("event.respondWith(fetch(event.request))"), "Service worker must pass fetches through to the network");
expect(!/\bcaches\b|CacheStorage|\.put\(|\.addAll\(/.test(serviceWorker), "Service worker must not use Cache API writes");
expect(!/indexedDB|localStorage|BackgroundSync|sync/.test(serviceWorker), "Service worker must not queue or persist offline ERP data");

expect(nextConfig.includes("/sw.js"), "Next config must define /sw.js headers");
expect(/no-cache[^\n"]*no-store[^\n"]*must-revalidate/.test(nextConfig), "Service worker must be served with no-store headers");
expect(nextConfig.includes("Service-Worker-Allowed"), "Service worker must allow root scope");

for (const requiredHeading of [
  "4.1 Installability, Manifest, and Standalone Launch",
  "4.2 Offline/Online Messaging and No ERP Queueing",
  "4.3 Mobile Standalone Safe-Area Behavior",
]) {
  expect(checklist.includes(requiredHeading), `Manual checklist must include ${requiredHeading}`);
}

const icon192 = await readPngSize(files.icon192);
const icon512 = await readPngSize(files.icon512);
const iconMaskable = await readPngSize(files.iconMaskable);

expect(icon192.width === 192 && icon192.height === 192, "icon-192x192.png must be 192x192");
expect(icon512.width === 512 && icon512.height === 512, "icon-512x512.png must be 512x512");
expect(iconMaskable.width === 512 && iconMaskable.height === 512, "icon-maskable-512x512.png must be 512x512");

if (failures.length > 0) {
  console.error("PWA readiness check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("PWA readiness check passed. Manual browser/device validation is still required for Phase 4.");
