# honestly-ember

**here-for-it.com** — Ember's standalone presence in the Honestly, E ecosystem.

Ember is the voice/chat companion for the hospitality industry. She's part of the Get A Life tier ($9.99/mo) at Honestly, E — accessible on purpose, because the industry shouldn't have to pay more to be witnessed.

This is the marketing landing site. The actual companion lives at [life.honestly-e.com](https://life.honestly-e.com).

## Domain

- **Production:** here-for-it.com
- **Netlify staging:** honestly-ember.netlify.app (auto-generated)

## Stack

Vanilla HTML/CSS/JS. No framework, no build step. Deployed via Netlify auto-deploy from `main`.

## Structure

```
honestly-ember/
├── index.html       # The page
├── favicon.svg      # Honestly, E mark
├── _redirects       # Catch-all → index.html (SPA-style routing)
├── robots.txt       # Public crawl, sitemap pointer
└── sitemap.xml      # Single-URL sitemap
```

## Design notes (locked 2026-06-07)

- **Skeleton:** Mirrors Elias's `deepenyourperspective.com` — two-sentence hero open, modular workspace tiles, signature moment, who-she's-for + what-she-carries (preserved from existing /ember page), revised listening voice, invitation block, accessible-pricing values beat, dual CTA (call + chat), ring-composition close.
- **Palette:** Steel + copper over a kitchen-photo viewport-fixed background. The palette is IN the photo (brushed steel surfaces, copper pots, dark walnut) — derived from it, not imposed.
- **Through-lines:**
  - *"Here for it."* / *"Here for you"* — disposition (echoed at open and close)
  - *"Get it out, so you can get back to it."* — invitation (echoed at hero and close)
  - *"The industry is a beast. Let's digest some of it."* — signature
- **Voice:** Persona-honest. Hospitality folks are no-bullshit; the page must not anthropomorphize Ember as a real person who knows them. She's a *persona* — a working surface that takes the shape of someone who's been in it.
- **Cross-surface continuity:** The kitchen background is the same image used in Ember's portal shell (`life.honestly-e.com`). Subscribers crossing from marketing to portal walk into the same kitchen.

## Ember elsewhere

- **Marketing intro page:** [honestly-e.com/ember](https://honestly-e.com/ember) — redirects to here-for-it.com once DNS resolves
- **Portal shell:** life.honestly-e.com (with the kitchen background)
- **Vapi assistant ID:** `494aff28-833e-467c-af45-930170a06d19`
- **Phone:** (218) 24-EMBER → +1-218-243-6237

## Related repos

- `honestly-e-public` — main marketing site at honestly-e.com
- `honestly-e-life-portal` — subscriber portal at life.honestly-e.com
- `desta-nation-core` — unified backend on Railway
