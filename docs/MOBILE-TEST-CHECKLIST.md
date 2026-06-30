# Mobile test checklist

Run these on a real phone after deploy (or use your Vercel preview URL).

## Automated (run on desktop)

```bash
python3 -m http.server 8080 &
python3 scripts/smoke-test.py http://127.0.0.1:8080
```

Against production after DNS is connected:

```bash
python3 scripts/smoke-test.py https://www.faresfares.online
```

## Manual (phone)

- [ ] Home page loads in Hebrew RTL
- [ ] Search finds products
- [ ] Tap a product → **פרטים** opens modal
- [ ] Close modal (✕ or tap outside) → buttons on page still work
- [ ] Add in-stock item to cart → badge updates
- [ ] Out-of-stock item shows **אזל מהמלאי** and cannot be added
- [ ] Open cart → quantities and total look correct
- [ ] **שליחת הזמנה בוואטסאפ** opens WhatsApp with order text to `972585675411`
- [ ] **תשלום מאובטח** shows friendly “available tomorrow” message until Hyp env vars are set

## Share preview

- [ ] Send site link in WhatsApp → preview shows red **פארס פארס** image (requires `og-image.png` deployed)
