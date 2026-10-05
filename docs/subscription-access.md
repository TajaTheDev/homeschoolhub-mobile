# Subscription access levels (client)

The app uses `accessLevel` on `SubscriptionInfo` from `store/subscriptionStore.ts`:

| Level | `canEnterApp` | `canEdit` | Typical user |
|-------|---------------|-----------|--------------|
| `full` | yes | yes | Active trial, RevenueCat `pro`, or `user_trials.status = converted` |
| `readonly` | yes | no | Trial expired (`expired` or past `expires_at`) |
| `locked` | no | no | Not signed in, or trial status could not be resolved |

Routing sends **`locked`** users to `/subscribe`. **`readonly`** users reach `/(tabs)` and may export; writes are gated in the UI (`requireEdit` + store guards) and at call sites (Phase 4).

## UI gating (Phase 4)

- **`hooks/useSubscriptionAccess`** — `requireEdit('<action>')` with short action labels; **`SubscribeToEditNudge`** renders `Subscribe to {action}`.
- **Always allowed in readonly:** export (`app/export.tsx`), Settings → Export, parent profile (`settings/profile.tsx`), notification toggles (`settings/notifications.tsx`), delete account, sign out, subscribe/IAP.
- **Blocked in readonly:** lesson/student/subject/attendance/schedule/break/curriculum/reading-log/photo writes (see Phase 4 checklist in PR notes).
- **Readonly UX (Phase 5):** `ReadonlyModeBanner` on `app/(tabs)/_layout.tsx` when `accessLevel === 'readonly'`. No post-expiry `TrialExpiringModal` wall — trial-ending modal only for active trials (≤7 days left, still `full`).

## Known client leak — default schedule row (Phase 6 / RLS)

**`useScheduleStore.fetchSchedule()`** inserts a default `school_schedule` row when none exists (first fetch). That runs on read for users opening schedule-dependent screens and is **not** blocked by `requireEdit`. Readonly users can therefore get a schedule row created without an explicit “save schedule” action.

**Follow-up:** move default creation to signup/onboarding only, or gate the insert behind `canEdit`, and enforce with RLS so expired trials cannot INSERT into `school_schedule`.

## TODO — Server-side enforcement (follow-up)

**Client-only gating in v1.** Expired/read-only users can still mutate data via direct Supabase API calls until RLS is added.

Follow-up: add Supabase RLS policies (or RPC checks) that **deny INSERT/UPDATE/DELETE** on homeschool tables when the caller's `user_trials` row is expired and not `converted`, while allowing SELECT. Mirror the same rules for storage uploads if needed. Track in issue/backlog before treating readonly as a security boundary.
