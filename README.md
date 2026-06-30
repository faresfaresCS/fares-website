# פארס פארס — חנות אונליין

חנות סטטית, מותאמת לנייד (RTL), עם **838 מוצרים** מהקטלוג של Wix.

## הרצה מקומית

דפדפן לא טוען `fetch` מקבצי `file://` — צריך שרת קטן:

```bash
cd /Users/faresfares/projects/fares-website
python3 -m http.server 8080
```

פתחו: http://localhost:8080

## לפני עלייה לאוויר

ערכו `js/config.js` אם צריך לעדכן פרטים:

- `siteUrl` — כתובת האתר הסופית (ל-SEO)
- `whatsapp` — מספר עם קידומת 972 (למשל `972585675411`)
- `phone` — טלפון לתצוגה
- `wixStoreUrl` — קישור לחנות Wix (אופציונלי)

## בדיקות לפני פריסה

```bash
python3 -m http.server 8080 &
python3 scripts/smoke-test.py http://127.0.0.1:8080
```

## פריסה (חינם)

**Netlify:** חברו ל-GitHub או גררו את התיקייה. קובץ `netlify.toml` כבר מוגדר (ללא build).

**Vercel:** חברו ל-repo, ללא פקודת build — publish directory = שורש הפרויקט.

**GitHub Pages:** דחפו לענף `main`. Workflow ב-`.github/workflows/deploy.yml` מפרסם אוטומטית.

לאחר הפריסה — הפנו את הדומיין `faresfares.online` ל-hosting (DNS).

## תשלומים מקוונים (Hyp Pay)

- **עכשיו:** הזמנות בוואטסאפ (Phase 1)
- **מחר:** הוסיפו משתני סביבה ב-Vercel לפי [`.env.example`](.env.example) — ראו [`docs/HYP-PREP-CHECKLIST.md`](docs/HYP-PREP-CHECKLIST.md)
- **פרטים טכניים:** [`docs/HYP-INTEGRATION.md`](docs/HYP-INTEGRATION.md)

## חיבור דומיין

ראו [`docs/DOMAIN-SETUP.md`](docs/DOMAIN-SETUP.md) לחיבור `faresfares.online` ל-Vercel.

## עדכון מוצרים מ-Wix

1. ב-Wix: **Dashboard → Store Products → ⋮ → Export**
2. שמרו את הקובץ כ-`data/catalog_products.csv` (או העתיקו לתיקייה)
3. הריצו:

```bash
python3 scripts/build-products.py data/catalog_products.csv
```

## Wix לעומת אתר זה

| | **Wix** | **אתר זה** |
|---|---------|------------|
| ניהול מוצרים | ממשק ויזואלי, תשלומים מובנים | עדכון דרך ייצוא/ייבוא CSV |
| עלות | מנוי חודשי | אחסון חינמי (GitHub Pages / Netlify) |
| התאמה | מוגבלת לתבנית | עיצוב מלא בשליטתכם |

**המלצה:** אם אתם כבר ב-Wix — המשיכו לנהל שם את הקטלוג והמלאי, וייצאו CSV מדי פעם לעדכון האתר. הקובץ `data/catalog_products.csv` הוא בדיוק פורמט הייבוא/ייצוא של Wix.

### ייבוא חזרה ל-Wix

1. Wix → **Store Products → Import**
2. בחרו `data/catalog_products.csv`
3. מיפוי עמודות אוטומטי

תמונות נטענות מ-`static.wixstatic.com` — כל עוד החנות ב-Wix פעילה, הקישורים ימשיכו לעבוד.

## תכונות

- חיפוש וסינון לפי קטגוריה
- עגלת קניות (שמירה בדפדפן)
- הזמנה בוואטסאפ
- עמודים (24 מוצרים בעמוד)
- תמיכה מלאה בעברית ו-RTL
- favicon, תגיות Open Graph, `robots.txt`, `sitemap.xml`
- סימון מוצרים שאזלו מהמלאי
