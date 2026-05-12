# Consent System Architecture

This application implements a cookie consent system to comply with the Philippines Data Privacy Act (RA 10173) and the EU General Data Protection Regulation (GDPR).

## 1. Storage & State Management
Consent choices are stored in two places to provide a seamless cross-device experience:

- **Local Storage (`cookieConsent` cookie)**: The primary source of truth for the browser. It stores a JSON object with a 1-year expiry. The shape is:
  ```json
  {
    "essential": true,
    "analytics": boolean,
    "preferences": boolean,
    "timestamp": "ISO-string",
    "version": "1.0"
  }
  ```

- **Database (`User.consent` field)**: For authenticated users, the consent JSON is synced to their database profile via `PATCH /api/users/me/consent`. This ensures that if they log in on another device, their preferences persist.

## 2. Consent Utilities
All frontend code should interact with consent via the utility file located at `frontend/src/lib/consent.ts`.

Key functions:
- `getConsent(category: 'essential' | 'analytics' | 'preferences')`: Returns `true` or `false` based on the user's choice. Always returns `true` for `essential`.
- `setConsent(choices)`: Updates the cookie, forces `essential: true`, adds a timestamp/version, and automatically attempts to sync to the backend.
- `hasConsented()`: Checks if the user has made an explicit choice. Used by the `CookieBanner` component to decide whether it should display.

## 3. How to Add New Tracking Calls
Before logging telemetry, tracking pixels, or dispatching analytics events, you must verify the user has opted into the `analytics` tier.

**Correct Example:**
```typescript
import { getConsent } from '@/lib/consent'

function trackCustomEvent(eventName, data) {
  // Gate check
  if (!getConsent('analytics')) return;

  // Proceed with tracking
  api.post('/analytics/event', { eventType: eventName, ...data });
}
```

If you are saving UI state (e.g., sidebar expanded, dark mode, panel sizes) to `localStorage`, you should wrap it in the `preferences` tier:

```typescript
import { getConsent } from '@/lib/consent'

function saveSidebarState(isExpanded: boolean) {
  if (getConsent('preferences')) {
    localStorage.setItem('sidebar:expanded', String(isExpanded))
  }
}
```

## 4. Policy Versioning
If the company updates its data collection practices, users who accepted older versions of the policy must be prompted again.

To invalidate existing consent and force the banner to reappear:
1. Open `frontend/src/lib/consent.ts`.
2. Increment the `CONSENT_VERSION` constant (e.g., from `'1.0'` to `'1.1'`).

Because the `getConsent` and `hasConsented` functions enforce a strict version match, bumping this number automatically invalidates all `cookieConsent` payloads storing the older version string.
