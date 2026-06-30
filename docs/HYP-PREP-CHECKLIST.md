# Hyp Pay prep checklist (before integration day)

Use this list when you connect your Hyp merchant account. Everything here can be done **without** writing code.

## From Hyp

- [ ] Merchant account activated
- [ ] API username + password (for `HYP_API_USER`, `HYP_API_PASSWORD`)
- [ ] Terminal number (`HYP_TERMINAL_NUMBER`)
- [ ] Merchant ID / MID (`HYP_MID`)
- [ ] MAC key for verifying payment redirects (`HYP_MAC_KEY`)
- [ ] Hyp environment base URL (`HYP_API_URL`, e.g. `https://…/xpo/Relay`)
- [ ] API docs bookmark: https://developers.hyp.co.il/

Hyp uses a **hosted payment page + redirect** flow (not traditional webhooks). After payment, the customer returns to your site and you verify the MAC in the query string.

## Redirect URLs to register with Hyp

| Purpose | URL |
|---------|-----|
| Success | `https://www.faresfares.online/api/hyp/return?status=success` |
| Error | `https://www.faresfares.online/api/hyp/return?status=error` |
| Cancel | `https://www.faresfares.online/checkout/error.html` |

## Email alerts (Resend)

1. Create a free account at https://resend.com/
2. Verify your sending domain (or use Resend’s test domain for staging)
3. Create an API key → `RESEND_API_KEY`
4. Choose the inbox that receives paid-order alerts → `NOTIFY_EMAIL`

## Vercel environment variables

In Vercel → **fares-website** → **Settings** → **Environment Variables**, add all values from [`.env.example`](../.env.example).

Apply to **Production** (and Preview if you want to test).

## Decisions (recommended defaults)

| Question | Recommendation |
|----------|----------------|
| Keep WhatsApp checkout after Hyp? | **Yes** — phone orders and fallback |
| Where to store orders? | Start with email alerts only; add Supabase later if needed |
| Test mode first? | **Yes** — use Hyp sandbox credentials before live charges |

## After credentials are ready

The repo already has scaffolded endpoints:

- `POST /api/checkout` — validate cart, create Hyp payment page
- `GET /api/hyp/return` — verify MAC, send order email

Fill in Vercel env vars and redeploy. The **תשלום מאובטח** button in the cart will become active automatically.

See also [`HYP-INTEGRATION.md`](HYP-INTEGRATION.md).
