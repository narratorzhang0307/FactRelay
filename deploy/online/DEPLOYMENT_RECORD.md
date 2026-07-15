# Production deployment record

Deployment date: 2026-07-15 (Asia/Shanghai)

## Public endpoints

- Canonical product: <https://fact-atlas.throughtheglass.art>
- Compatibility redirect: `http://fact_atlas.throughtheglass.art` → canonical HTTPS host
- Health: <https://fact-atlas.throughtheglass.art/api/health>

The canonical A record resolves to `43.98.248.74`. The Let's Encrypt certificate covers only the DNS-valid hyphenated hostname and expires on 2026-10-13; Certbot renewal is scheduled on the host.

## Isolation

| Resource | Value |
| --- | --- |
| Directory | `/root/fact-atlas` |
| Process | `fact-atlas` |
| Listener | `127.0.0.1:3013` |
| Nginx file | `/etc/nginx/conf.d/fact-atlas.conf` |
| Environment | `/root/fact-atlas/.env`, mode `0600` |

The deployment added one PM2 process with zero restarts. All 12 pre-existing PM2 processes retained their original PID, restart count, and online status before and after the release.

## Production checks

- HTTPS root: HTTP/2 `200`
- Manifest: `application/manifest+json`, `display: standalone`
- Service worker: `no-cache`, root scope allowed
- Mapbox runtime configuration: enabled with a browser-safe public token
- Gonka health: live-ready with Kimi-K2.6 and MiniMax-M2.7
- Mobile viewport: 390×844 with safe-area install sheet and three-tab navigation
- Atlas: Mapbox dark globe loaded
- Signals: topic selector, edition date, and bounded agent pipeline loaded
- Existing public virtual hosts: 14 checked, all returned HTTP `200`

## Live verification smoke result

The public API completed the built-in Great Wall/Moon claim as a real Gonka run:

| Field | Result |
| --- | --- |
| Mode | `live` |
| Verdict | `refuted` |
| Truth Score | `18` |
| Decision confidence | `89` |
| Retrieved sources | `5` |
| Model request IDs | present for both roles |
| Trace steps | three `complete` steps |

No credential values are stored in this record.
