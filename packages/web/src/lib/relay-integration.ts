/**
 * Relay Integration Helper
 * Drop-in script for static sites to integrate with Relay affiliate tracking.
 *
 * Usage:
 *   <script src="/relay-integration.js"></script>
 *   <script>
 *     RelayIntegration.init({ relayBaseUrl: 'https://relay.edgeiqlabs.com' });
 *   </script>
 */

interface RelayConfig {
  relayBaseUrl: string;
  cookieName?: string;
  cookieMaxAge?: number;
}

const DEFAULT_COOKIE_NAME = '_relay_vid';
const DEFAULT_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAge: number, domain?: string): void {
  let cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`;
  if (domain) cookie += `;domain=${domain}`;
  document.cookie = cookie;
}

/**
 * Reads referral code from URL params (?ref=CODE) and stores in cookie.
 * Returns the referral code if found.
 */
export function getReferralCode(): string | null {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) {
    setCookie('_relay_ref', ref, DEFAULT_COOKIE_MAX_AGE);
  }
  return ref || getCookie('_relay_ref');
}

/**
 * Builds a checkout URL with the Relay visitor ID appended as client_reference_id.
 * If no visitor cookie exists, returns the base URL unchanged.
 */
export function buildRelayLink(baseCheckoutUrl: string, _relayBaseUrl?: string): string {
  const vid = getCookie(DEFAULT_COOKIE_NAME);
  if (!vid) return baseCheckoutUrl;

  try {
    const url = new URL(baseCheckoutUrl);
    url.searchParams.set('client_reference_id', vid);
    return url.toString();
  } catch {
    // Fallback for malformed URLs
    const separator = baseCheckoutUrl.includes('?') ? '&' : '?';
    return `${baseCheckoutUrl}${separator}client_reference_id=${encodeURIComponent(vid)}`;
  }
}

/**
 * Rewrites all buy.stripe.com links on the page to include the visitor ID.
 */
export function rewriteCheckoutLinks(): void {
  const links = document.querySelectorAll<HTMLAnchorElement>('a[href*="buy.stripe.com"]');
  links.forEach((link) => {
    const href = link.getAttribute('href');
    if (href && !href.includes('client_reference_id')) {
      link.setAttribute('href', buildRelayLink(href));
    }
  });
}

/**
 * Initialize Relay integration on the page.
 */
export function init(config: RelayConfig): void {
  // Capture referral code from URL if present
  getReferralCode();

  // Rewrite existing checkout links
  rewriteCheckoutLinks();

  // Observe DOM changes to rewrite dynamically added links
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => rewriteCheckoutLinks());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  console.log('[Relay] Integration initialized', config.relayBaseUrl);
}

// Export as global for IIFE usage
if (typeof window !== 'undefined') {
  (window as any).RelayIntegration = { init, buildRelayLink, getReferralCode, rewriteCheckoutLinks };
}
