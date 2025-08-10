# ebay_total_cost_display
Continuation of an extension I use to display eBay costs. Updated for Manifest V3

Original Extension here (MANIFEST V2): [Chrome Web Store listing](https://chromewebstore.google.com/detail/ebay-total-cost-display/heneliofimmlbokhbapdppelcohehpam)

### Changelog

#### 2.0.1 — 2025-08-10
- Fix: Total Cost now displays reliably on new eBay `s-card` layouts (broadened selectors and smarter insertion points).
- Fix: Prevent duplicate injections with an `ebtc-processed` marker and stricter checks.
- Fix: More robust number parsing; safer handling when price/shipping text is missing.
- Change: Inject as `span.ebay-total-cost` and improved styling to ensure visibility.
- Dev: Debug logging disabled by default; toggle with `localStorage.setItem('ebtc_debug','1')`.
