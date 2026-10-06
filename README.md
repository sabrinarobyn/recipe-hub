# Recipe Hub

Choose meals, plan your week and get a Woolworths shopping list with a price estimate. It's built from
`data/Jade_Seeliger_Recipes_Woolworths_Costed.xlsx`: 67 recipes, 207 Woolworths products and 558
costed ingredient lines, with prices from woolworths.co.za on 6 October 2026.

## What it does

- **Recipes**: browse, search by recipe or ingredient, filter by category and sort by cost. Each
  recipe shows its **cost per make** (only the share of each pack it uses) and its
  **shop-from-scratch** cost (full packs), along with substitutes and items Woolworths doesn't sell.
- **Plan**: a week view (Monday to Sunday) with breakfast, lunch, dinner and extras. Make a recipe
  ×½, ×2 and so on, move meals between days, copy last week, and see the week's estimate.
- **Shopping list**: every planned meal merged into one list, grouped by shop section. Packs are
  rounded up across the whole week, so two recipes that each use half a bag of spinach share one
  bag. Mark items you **already have** to take them off the estimate, tick items off as you shop,
  add extras, then copy the list (to paste into WhatsApp or Notes) or download a CSV.
- **Prices**: edit any shelf or regular price inline and every recipe, plan and list updates
  straight away. Switch between shelf prices (with promotions) and regular prices. Add or edit
  products, or do a bulk update: **Export CSV**, change the prices in Excel, then **Import CSV**.
- **New and edited recipes**: add your own meals, or edit, duplicate or delete existing ones. Match
  each ingredient to a Woolworths product and amount; the editor suggests products and guesses
  amounts from the text (e.g. "500 g spinach" or "2 eggs"). A recipe can use another recipe as an
  ingredient, the way the mince dishes use one batch of *5 Veg Mince*.

Your changes are stored as edits on top of the spreadsheet data, so "Undo my changes" can restore
any recipe or product. **Settings** (the gear icon) has backup download and restore, and a full
reset.

### Where data is saved

- Run locally or on GitHub Pages, data is saved in the browser (`localStorage`). Use
  **Settings → Download backup / Restore from backup** to move it to another device.
- Hosted as a Claude artifact, it's saved privately to your Claude account, so it follows you
  across devices.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # costing tests, including a check against every recipe total in the spreadsheet
npm run build      # static site in dist/
npm run build:single  # one self-contained HTML page in dist-single/
```

### Publishing on GitHub Pages

`.github/workflows/deploy.yml` tests, builds and deploys every push to `main`. To turn it on, go to
**Settings → Pages** in the repository and set **Source** to **GitHub Actions**.

## Updating from the spreadsheet

If the spreadsheet changes (new recipes, re-costed lines), regenerate the built-in data:

```bash
pip install openpyxl
npm run import-xlsx   # or: python3 scripts/import_xlsx.py path/to/workbook.xlsx
```

The script reads the cached values, so open and save the workbook in Excel first. Shop sections for
new products are set in the `SECTIONS` table at the top of `scripts/import_xlsx.py`. Edits made in
the app are kept on top of the new data.

## How the costs are worked out

- **Cost per make** = Σ (amount used ÷ pack size × pack price).
- **Shop from scratch / shopping list** = Σ (packs needed, rounded up × pack price), where amounts
  for the same product are added together first.
- Salt, pepper and water aren't costed. Items not sold at Woolworths are listed separately.
- 1 cup = 250 ml, 1 Tbsp = 15 ml, 1 tsp = 5 ml. More assumptions are under **Settings → How the
  costs work**.

## Project layout

```
data/                 the source spreadsheet
scripts/import_xlsx.py   spreadsheet → src/data/seed.json
src/lib/costing.ts    costing and shopping-list maths (unit tested)
src/lib/store.tsx     app state: seed data + your edits
src/lib/storage.ts    browser storage, Claude account storage, file downloads
src/components/       the screens
```
