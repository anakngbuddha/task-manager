# Cookie and Storage Audit Report

This document outlines all cookies, local storage, and session storage entries used across the application. They are categorized into three tiers for consent management in compliance with the Philippines Data Privacy Act (RA 10173) and GDPR.

## Tier 1: Essential (Strictly Necessary)
These are required for the core application to function securely (authentication, security, session management) and **do not require user consent**. They cannot be disabled.

| Name | Type | Purpose | Expiry/Duration | Code Location |
|------|------|---------|-----------------|---------------|
| `better-auth.session_token`<br>`__Secure-better-auth.session_token` | Cookie | Secure HTTP-only session token for server-side authentication. | Managed by Better-Auth | `backend/src/lib/auth.ts`<br>`backend/src/routes/analytics.routes.ts` |
| `__better-auth-session` | LocalStorage / SessionStorage | Client-side authentication session data used to persist auth state in the browser. | Session/Managed | `frontend/src/hooks/useAnalytics.ts` (Lines 7, 13) |

## Tier 2: Analytics & Tracking
These are used to track user behavior, page visits, click events, system performance, device info, and session durations to improve the application. **Requires user consent**.

| Name | Type | Purpose | Expiry/Duration | Code Location |
|------|------|---------|-----------------|---------------|
| `__analytics_session_started` | SessionStorage | Tracks if a `SESSION_START` event has already been sent for the current active browser session. | End of Session | `frontend/src/hooks/useAnalytics.ts` (Lines 48-49) |

*Note: The application tracks `PAGE_VIEW`, `SESSION_START`, `CLICK`, `ERROR`, and `PERFORMANCE` events to the backend `/analytics/event` endpoint. These events collect device metadata (userAgent), timezone, and detailed DOM interaction paths. These must be conditionally blocked if Tier 2 consent is rejected.*

## Tier 3: Preferences & Customization
These are used to remember the user's customized UI layout and interactions. **Requires user consent**.

| Name | Type | Purpose | Expiry/Duration | Code Location |
|------|------|---------|-----------------|---------------|
| `sidebar:expanded` | LocalStorage | Remembers whether the main navigation sidebar is expanded or collapsed. | Persistent | `frontend/src/components/layout/Sidebar.tsx` (Lines 51, 56) |
| `vfs-terminal-geometry` | LocalStorage | Stores the floating window coordinates and dimensions (x, y, width, height) of the terminal panel. | Persistent | `frontend/src/components/terminal/TerminalPanel.tsx` (Lines 18, 37, 44) |
| `vfs-terminal-pinned-height` | LocalStorage | Stores the height dimension of the pinned terminal panel. | Persistent | `frontend/src/components/terminal/TerminalPanel.tsx` (Lines 32, 78, 84) |

---
**Audit Date:** May 12, 2026
**Next Steps:** Proceed to Phase 2 to implement the consent banner, consent state management, and conditional execution of Tier 2 and Tier 3 storage mechanisms.
