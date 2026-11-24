# Recipe Hub

Choose meals, plan your week and get a Woolworths shopping list with a price estimate. It's built from
`data/Jade_Seeliger_Recipes_Woolworths_Costed.xlsx`: 67 recipes, 207 Woolworths products and 558
costed ingredient lines, with prices from woolworths.co.za on 6 October 2026. Each product also has
a researched Checkers equivalent (checkers.co.za, 8 October 2026) so you can compare the two stores.

## What it does

- **Recipes**: a list grouped by category, with a small photo, kcal and cost on each row. Search by
  recipe or ingredient, filter by category and sort by cost. Remove a recipe with the bin on its row
  (tap twice); **Removed recipes** at the bottom of the list brings a built-in one back. Each
  recipe shows its **cost per make** (only the share of each pack it uses) and its
  **shop-from-scratch** cost (full packs), along with substitutes and items Woolworths doesn't sell.
- **Plan**: a week view (Monday to Sunday) with breakfast, lunch, dinner and extras. Make a recipe
  ×½, ×2 and so on, move meals between days, copy last week, and see the week's estimate.
- **Shopping list**: every planned meal merged into one list, grouped by shop section. Packs are
  rounded up across the whole week, so two recipes that each use half a bag of spinach share one
  bag. What your **Pantry** already covers comes off the list and the estimate (see below). Tick
  items **Got** as you shop, add extras, then copy the list (to paste into WhatsApp or Notes) or
  download a CSV.
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
- **Photos**: add a photo to any recipe from the recipe page or the editor (on a phone this offers
  the camera or photo library; on a computer you can also drop or paste an image). Photos are shrunk
  to about 720 px before saving. Until a recipe has a real photo, it shows an **AI mockup** (labelled
  as such) from `src/assets/mockups/<recipe id>.jpg`; adding a photo replaces it, and removing that
  photo brings the mockup back. New recipes without a photo show an illustration tile.

### Pantry

Each Member has a private **Pantry**: the Products they have at home and how much of each is left.

- **Got**: ticking an item Got on the Shopping List puts its packs into the Pantry; un-ticking takes
  them out again. You can also add a Product by hand on the **Pantry** screen.
- **Cooked**: marking a Planned Meal Cooked takes the amounts its Recipe uses out of the Pantry
  (scaled, and through sub-recipes). Un-marking it, or removing the meal from the Plan, puts them
  back. Meals that aren't Cooked don't use anything up.
- **Corrections**: set a Pantry Item to what's really there (food thrown out, used outside the Plan or
  miscounted), or clear it.
- **Shopping List netting**: the Shopping List, and the Plan's week estimate, cost only what's still
  to buy: what the Pantry covers comes off, and a part-covered item buys the rest in whole packs.
  Press **Buy anyway** on an item to buy its full amount whatever the Pantry holds.
- The Plan suggests Recipes that use what's in your Pantry, best match first.

### Reviews, Recipe Authors and Profiles

- **Reviews**: each Member can give a Recipe 1 to 5 stars, with an optional comment and photos; one
  Review per Member per Recipe. Recipes show their average stars and can be sorted **Best reviewed
  first**. Every Member sees all Reviews; you change your own, and Editors and Admins can delete
  any. A Review stays after its Member leaves the invite list.
- **Recipe Authors**: any Member can add a Recipe and becomes its Author. Authors edit their own
  Recipes and choose their Main Photo (also from Review photos); Editors and Admins can edit any.
- **Profiles**: each Member sets a display name and photo, shown on their Reviews and on the Recipes
  they authored. Other Members never see their email.

Your changes are stored as edits on top of the spreadsheet data, so "Undo my changes" can restore
any recipe or product. **Settings** (the gear icon) has backup download and restore, and a full
reset.

### Where data is saved

- **On Vercel with Supabase (the main site)**: Recipe Hub is invite only. People sign in with a
  6-digit code emailed to them (no passwords); the email also has a sign-in link. Admins manage the invite list under **Settings → People** and give
  each person a role: *viewer* (sees the recipe book, plans their own meals), *editor* (also changes
  recipes, prices and photos) or *admin* (also manages who's invited). The recipe book and photos are
  one shared copy that updates live; each person's plan, shopping lists and store choice are private
  to their account. The database refuses sign-ups from emails that aren't on the list, and row-level
  security enforces the roles. Each Recipe is its own record (`docs/adr/0001-one-record-per-recipe.md`).
  Schema: `supabase/migrations/`.

- Run locally or on GitHub Pages, data is saved in the browser (`localStorage`, with photos in
  IndexedDB). Use **Settings → Download backup / Restore from backup** to move it to another device.
- Hosted as a Claude artifact, the **recipe book** (recipes, prices, categories, photos) is one
  shared copy under `data/book` in the artifact's store. Everyone the page is shared with reads it
  and sees changes live; only the owner and people given Editor access can change it (a `db` rule
  sets `write: "admin"` on `data/book`). Each person's **meal plan, shopping lists and price
  setting** are private to them under `data/users/<id>`, or in their browser if their access is
  view-only.

## Brand

A lively market: bold and playful on the main screens, calm and editorial on recipe pages.

- **Colour**: cream paper (`#fbf1e6`) with deep tomato red (`#a0141e`) for headings and main actions,
  papaya orange (`#e8622a`) for highlights and burnt orange (`#b04e1f`) behind the sign-in page. The
  illustrations add leaf green, cobalt, lemon, pumpkin and radish pink. Tokens are at the top of
  `src/styles.css`; dark mode is a deep plum-brown with papaya headings.
- **Type**: Archivo, heavy and condensed, in capitals for headings, tabs, labels and buttons. EB
  Garamond for recipe names and recipe pages. DM Sans for reading, DM Mono for small figures.
- **Illustrations**: flat, cut-paper style produce (tomato, lemon, radish, pumpkin, aubergine, pear,
  papaya, chilli, fennel, flower), drawn as inline SVG in `src/components/Brand.tsx`. They spill
  beside the big home heading and over the top of the sign-in card, and fill the tile for recipes
  without a photo. The logo is a papaya half and a tomato.
- **Shapes**: soft pills for buttons, chips and inputs, and generously rounded cards.
- **Mockups**: the stand-in photos were generated with Canva's AI image tool in October 2026.
  `data/mockups.csv` maps each recipe to its Canva media id. They're small (about 200 × 150 px), so swap
  in real photos, or drop a bigger file with the same name into `src/assets/mockups/`.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # costing tests, including a check against every recipe total in the spreadsheet
npm run build      # static site in dist/
npm run build:single  # one self-contained HTML page in dist-single/
```

`npm test` needs no database.

### Database tests

The access rules in `supabase/migrations/` are tested against a local copy of the Supabase
database. You need Docker running; then:

```bash
npm run test:db              # start local Supabase with the migrations, run supabase/tests, stop it
npm run test:db -- photos    # extra arguments go to vitest, e.g. only test files matching "photos"
```

`scripts/test-db.sh` starts only the services the tests use (database, auth, API) and stops them
afterwards. If a local stack is already running (`npx supabase start`), it is reset to the
migrations instead, which wipes its data, and left running. The first run downloads the Supabase
Docker images.

The tests sign in as a fresh Admin, Editor, Viewer or uninvited person and check what each can read
and change: the Recipe Book, photos, each Member's private data (Plan, Shopping Lists) and the
invite list. To add a case, write a `*.test.ts` file in `supabase/tests/` and use the helpers in
`supabase/tests/members.ts`:

- `signInAs("viewer" | "editor" | "admin")`: a new Member with that role, signed in. Returns
  `{ client, email, userId }`; `client` is a Supabase client acting as them.
- `signInNotInvited()`: a signed-in person who has been removed from the invite list.
- `anonymous()`: someone who hasn't signed in.
- `service`: bypasses row-level security, for arranging data a test needs. Check results as a
  signed-in Member, not through `service`.

Test files run one at a time against the same database, so a file that relies on shared rows (like
the Recipe records) sets them up in `beforeEach` or `beforeAll`. `recipe-records-migration.test.ts`
resets the database to an earlier migration to check the move to records, then migrates it again.

### Publishing on Vercel with Supabase

1. Create a Supabase project and run the files in `supabase/migrations/` in order (SQL editor), then
   add yourself as the first admin (`supabase/seed-admin.example.sql`).
2. In Supabase, **Authentication → URL Configuration**: set **Site URL** to the Vercel address and add
   it under **Redirect URLs**.
3. In Supabase, **Authentication → Emails → SMTP Settings**: add your own email sender. Supabase's
   built-in sender only emails members of your Supabase team, so invited people get no sign-in link
   without it. A Gmail account with an app password works (host `smtp.gmail.com`, port 465).
4. In Supabase, **Authentication → Emails**: paste `supabase/email-templates/magic-link.html` into the
   **Magic Link** template and `confirm-signup.html` into **Confirm signup** (first sign-in uses that
   one). They include the `{{ .Token }}` code; the subject line to use is at the top of each file.
5. In Vercel, import the repository and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` (see
   `.env.example`). Every push to `main` deploys.

Without those two variables the app builds exactly as before, saving to the browser.

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
data/                 the source spreadsheet, nutrition, servings, Checkers equivalents (checkers.csv)
                      and the Canva source of each mockup photo (mockups.csv)
src/assets/mockups/   AI mockup photo for each built-in recipe
supabase/migrations/  database schema and access rules for the Supabase-hosted version
supabase/tests/       database tests of those rules (npm run test:db)
scripts/import_xlsx.py   spreadsheet → src/data/seed.json
src/lib/costing.ts    costing and shopping-list maths (unit tested)
src/lib/store.tsx     app state: seed data + your edits
src/lib/storage.ts    browser storage, Claude account storage, file downloads
src/lib/supabase.ts   sign-in, invite list and data for the Supabase-hosted version
src/components/       the screens (Brand.tsx: logo and illustrations)
docs/brand/           the original brand board (superseded by the palette in this README)
```
