# Recipe Hub

Choose meals, plan your week and get a Woolworths shopping list with a price estimate. It's built from
`data/Jade_Seeliger_Recipes_Woolworths_Costed.xlsx`: 67 recipes, 207 Woolworths products and 558
costed ingredient lines, with prices from woolworths.co.za on 6 October 2026. Each product also has
a researched Checkers equivalent (checkers.co.za, 8 October 2026) so you can compare the two stores.

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

- **Calories and macros**: every recipe shows kcal, protein, carbs, fat and fibre per serving (and for
  the whole recipe), with a calorie-per-ingredient column. The plan shows each meal's kcal per
  serving and a per-person total for each day (one serving of each planned meal). Sort recipes by
  calories or protein. Values are estimates from typical food-composition figures per 100 g in
  `data/nutrition.csv`, not Woolworths labels: edit any product (Prices → pencil) to enter the label
  values (kJ or kcal). Portions per recipe are in `data/servings.csv` and editable in the app.
- **Woolworths vs Checkers**: the **Woolworths | Checkers** switch in the top bar picks which
  store's prices every recipe, plan and list uses (each person picks their own). The shopping list
  receipt totals the same list at both stores and a "cheapest of each" split, and each item shows
  the other store's cost. Each recipe page shows its cost at both stores. On **Prices**, the Checkers
  column has the matched product, its price (editable) and how close the match is; filter by
  *Cheaper at Checkers* or *No Checkers match*. Products with no Checkers equivalent are costed at
  the Woolworths price and flagged.
- **Photos**: add a photo to any recipe from the card, the recipe page or the editor (on a phone
  this offers the camera or photo library; on a computer you can also drop or paste an image).
  Photos are shrunk to about 720 px before saving. Recipes without one show a lettered tile.

Your changes are stored as edits on top of the spreadsheet data, so "Undo my changes" can restore
any recipe or product. **Settings** (the gear icon) has backup download and restore, and a full
reset.

### Where data is saved

- Run locally or on GitHub Pages, data is saved in the browser (`localStorage`, with photos in
  IndexedDB). Use **Settings → Download backup / Restore from backup** to move it to another device.
- Hosted as a Claude artifact, the **recipe book** (recipes, prices, categories, photos) is one
  shared copy under `data/book` in the artifact's store. Everyone the page is shared with reads it
  and sees changes live; only the owner and people given Editor access can change it (a `db` rule
  sets `write: "admin"` on `data/book`). Each person's **meal plan, shopping lists and price
  setting** are private to them under `data/users/<id>`, or in their browser if their access is
  view-only.

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

The script reads the cached values, so open and save the workbook in Excel first. It also reads
`data/nutrition.csv` (every product needs a row), `data/servings.csv` and `data/checkers.csv`. Shop sections for
new products are set in the `SECTIONS` table at the top of `scripts/import_xlsx.py`. Edits made in
the app are kept on top of the new data.

## How the costs are worked out

- **Cost per make** = Σ (amount used ÷ pack size × pack price).
- **Shop from scratch / shopping list** = Σ (packs needed, rounded up × pack price), where amounts
  for the same product are added together first.
- At Checkers, the same formulas use the matched Checkers product's price and pack size (stored in
  the Woolworths product's unit, so a 1 kg bag of a product measured in g is 1000). Loose produce
  sold per kg is priced for the Woolworths pack weight.
- Salt, pepper and water aren't costed. Items not sold at Woolworths are listed separately.
- 1 cup = 250 ml, 1 Tbsp = 15 ml, 1 tsp = 5 ml. More assumptions are under **Settings → How the
  costs work**.

## Project layout

```
data/                 the source spreadsheet, nutrition, servings and Checkers equivalents (checkers.csv)
scripts/import_xlsx.py   spreadsheet → src/data/seed.json
src/lib/costing.ts    costing and shopping-list maths (unit tested)
src/lib/store.tsx     app state: seed data + your edits
src/lib/storage.ts    browser storage, Claude account storage, file downloads
src/components/       the screens
```
