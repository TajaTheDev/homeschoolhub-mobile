/**
 * Founding lifetime offer — shared marketing copy.
 *
 * IMPORTANT: Deadline strings here are DISPLAY-ONLY. They do NOT control whether
 * the offer appears in the app. Availability is controlled solely by the RevenueCat
 * "founding" offering toggle (see getFoundingLifetimePackage in lib/revenuecat.ts).
 * Editing this date does not turn the offer off.
 */

/** Shown in urgency lines and banner copy (e.g. "ends October 31 or while available"). */
export const FOUNDING_DEADLINE_DISPLAY = 'October 31';

/** Shared suffix after price or "Founding pricing" lines. */
export const FOUNDING_ENDS_OR_WHILE_AVAILABLE = `ends ${FOUNDING_DEADLINE_DISPLAY} or while available`;

/** Subscribe screen lifetime card urgency line. */
export const FOUNDING_PRICING_URGENCY_COPY = `Founding pricing — ${FOUNDING_ENDS_OR_WHILE_AVAILABLE}.`;

/**
 * Home dashboard founding banner message. Price must come from RevenueCat (formatPackagePrice).
 */
export function foundingLifetimeBannerMessage(priceString: string): string {
  return `Founding Lifetime — one-time ${priceString}, ${FOUNDING_ENDS_OR_WHILE_AVAILABLE}.`;
}
