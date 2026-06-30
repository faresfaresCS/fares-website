# Connect faresfares.online to Vercel

Your site is deployed on Vercel (`fares-website`). Complete these steps at your domain registrar to go live on your custom domain.

## 1. Add domains in Vercel

1. Open [Vercel Dashboard](https://vercel.com) → **fares-website** → **Settings** → **Domains**
2. Add:
   - `faresfares.online`
   - `www.faresfares.online`
3. Vercel shows the DNS records you need

## 2. Configure DNS at your registrar

Typical setup (follow Vercel’s exact instructions if they differ):

| Type | Name | Value |
|------|------|-------|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

If the root domain uses a CNAME flattening provider, use the records Vercel suggests.

## 3. Wait for propagation

- DNS can take a few minutes to 48 hours
- Vercel issues HTTPS automatically once DNS is valid
- In Vercel → Domains, status should show **Valid**

## 4. Verify

After DNS is active:

```bash
curl -I https://www.faresfares.online/
python3 scripts/smoke-test.py https://www.faresfares.online
```

No code changes needed — [`js/config.js`](../js/config.js) already uses `https://www.faresfares.online`.

## Redirect apex → www (optional)

In Vercel Domains, set `faresfares.online` to redirect to `www.faresfares.online` so all links use one canonical URL.
