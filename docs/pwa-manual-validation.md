# PWA Manual Validation Checklist

Use this checklist on a production-like HTTPS origin after deploying the frontend PWA slice. The current baseline is installability-first only: it must not provide offline ERP workflows, offline queues, background sync, or authenticated/dynamic data caching.

## Preconditions

- Deploy the frontend to an HTTPS origin that matches the production routing shape.
- Start from a clean browser profile or clear existing site data for the origin.
- Confirm the backend/API routes used by the frontend are available for signed-in smoke checks.
- Keep DevTools open on the Application, Network, and Lighthouse panels.

## 4.1 Installability, Manifest, and Standalone Launch

1. Open the deployed frontend in Chrome.
2. In DevTools → Application → Manifest, confirm:
   - App name is `Plataforma SaaS` and short name is `SaaS`.
   - `start_url` is `/` and scope is `/`.
   - Display mode is `standalone`.
   - Theme color is `#0f172a` and background color is `#020617`.
   - Icons include `192x192`, `512x512`, and maskable `512x512` PNG assets.
   - No tenant-specific names, logos, colors, or customer identifiers appear.
3. Run Lighthouse in the same browser profile and verify the PWA/installability checks report the app as installable.
4. Install the app from Chrome and launch it from the installed shortcut.
5. Confirm the installed app opens at `/` in standalone mode and uses the generic SaaS icon/name.

## 4.2 Offline/Online Messaging and No ERP Queueing

1. Sign in or open a screen that performs live ERP/API work.
2. In DevTools → Network, switch throttling to Offline or use the OS network toggle.
3. Confirm the global banner appears with the Spanish wait-for-connection message: `Sin conexión` and the instruction to wait before continuing live ERP operations.
4. Attempt a safe ERP action that would require live data, without submitting irreversible business data.
5. Confirm the UI does not report success, queue the action, replay the action, or simulate a completed ERP transaction while offline.
6. In DevTools → Application → Cache Storage and IndexedDB, confirm no PWA-created storage contains API, file, tenant, credentialed, or ERP response data.
7. Return the device/browser online.
8. Confirm the offline banner clears and normal live operations can resume only after network connectivity returns.

## 4.3 Mobile Standalone Safe-Area Behavior

1. Install the PWA on a notched mobile device or emulator using the same HTTPS origin.
2. Launch the installed app in portrait orientation.
3. Confirm readable content and primary actions are not obscured by the status bar, home indicator, rounded corners, or bottom safe area.
4. Confirm global fixed controls, including PWA banners and scroll controls, sit above the safe-area inset.
5. Rotate to landscape orientation and repeat the overlap check.
6. Open the same origin in a normal mobile browser tab.
7. Confirm browser mode remains usable and does not show excessive top/bottom padding when safe-area insets are absent or minimal.

## Pass/Fail Recording Template

Record the exact deployment URL, device/browser, and evidence for each task before marking Phase 4 complete in OpenSpec.

| Task | Result | Evidence | Notes |
|------|--------|----------|-------|
| 4.1 Installability and standalone launch | Pending |  |  |
| 4.2 Offline/online and no ERP queueing | Pending |  |  |
| 4.3 Mobile standalone safe areas | Pending |  |  |
