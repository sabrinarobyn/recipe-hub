# Keeping Woolworths and Checkers prices up to date

Research note, 22 November 2026. Question: how can Recipe Hub keep the shelf and regular prices of
its 207 products at Woolworths SA and their matched Checkers equivalents up to date without retyping
them by hand?

> **Read this first: what could and could not be verified.** This research ran in a cloud sandbox
> whose network policy allowed GitHub but blocked every retailer and legal host tried
> (`www.woolworths.co.za`, `www.checkers.co.za`, `products.checkers.co.za`, `www.shoprite.co.za`,
> `www.sixty60.co.za`, Constructor.io, `web.archive.org`, `www.gov.za`, `www.saflii.org`,
> `lawlibrary.org.za`, `schema.org` and others; each returned a proxy `403` or failed to resolve).
> So:
>
> - **Verified from primary sources**: this repo's own data and code, and the source code of
>   open-source SA grocery tools on GitHub (cloned and read at the commits listed under Sources).
> - **Not verified (marked ⚠)**: the text of both retailers' terms of use, their `robots.txt`
>   files, the markup of their live product pages, and the wording of the legislation. For these, the
>   URLs below are the primary sources, located by web search. What they say is reported from
>   search-engine summaries, not from reading the pages. Treat every ⚠ item as a lead to check, not a
>   quotation. Before building anything automated, a person should open those URLs and read them.

## Summary

- **There is no official price API or product feed** for either retailer that this research could
  find. Searches for a Woolworths SA developer API, a Shoprite/Checkers developer portal or a
  Sixty60 partner feed turned up only third-party scrapers (⚠ [search results](#4-third-party-services-datasets-and-open-source-scrapers)).
  An affiliate directory lists a "Woolworths Supermarkets" affiliate programme, but it could not be
  traced back to Woolworths SA and may be the Australian company (⚠).
- **Both sites can technically be read by a program, but only through undocumented interfaces.**
  Open-source tools show that Woolworths search runs on a public Constructor.io index and the
  Woolworths Dash app's private API, and that Checkers prices come from the Sixty60 catalogue API,
  which is tied to a store and location ([source code](#3-how-the-sites-expose-prices)). Their own
  authors call these "private, undocumented APIs reverse-engineered" from the Android apps.
  Woolworths' own `llms-full.txt` reportedly tells automated agents not to use "undocumented
  internal endpoints as stable public interfaces" (⚠).
- **Prices differ by place.** Checkers prices are per store: the Sixty60 API resolves "store
  contexts" from a latitude and longitude, and older Checkers scrapers set a
  `checkersZA-preferredStore` cookie. A third-party Woolworths scraper says it covers "all three
  Woolworths price zones" (⚠). Any automatic price is a price *somewhere*, not necessarily at the
  members' own shops.
- **Legal position, from primary sources as far as they could be read:** South Africa has no
  separate database right, but the Copyright Act counts "tables and compilations" (including data
  in a computer) as literary works. The ECT Act (s 86) and the Cybercrimes Act (s 2) make access
  "without authority" an offence. Website terms may bind users as a contract. POPIA matters only
  for what the app records about members, not for prices. All ⚠; this is not legal advice.

### Recommendation

For a small, private, invite-only app with 207 products, **don't run an unattended scraper.** Use
three things together, cheapest first:

1. **Shelf prices from members (build this).** When someone ticks an item off the shopping list,
   let them type the price on the shelf (one optional field, prefilled with the current price).
   Save it as a dated observation for that store and let editors accept it into the catalogue, or
   accept it automatically when it is close to the current price. This needs no retailer data at
   all, gives the price at the shops members actually use (which an online price may not be), and
   updates the items that matter most: the ones people buy.
2. **Keep the CSV round trip (already built).** **Prices → Export CSV / Import CSV** already updates
   `today`, `regular`, the Checkers columns and the `updated` date, and only changes the date when
   a price really changed (`src/components/PricesView.tsx`). Use it for a quarterly sweep of items
   nobody has bought lately.
3. **Optional: a helper a person runs on their own computer.** A local script that opens the 207
   links already stored in the catalogue, at a human pace, in a normal browser, with the user's own
   store selected, and writes the existing CSV format for a person to check and import. Only build
   this after someone has read both retailers' current terms and `robots.txt` (see §2) and decided
   it is acceptable. It should never run on Vercel or Supabase on a schedule.

Trade-offs: (1) is slower to cover all 207 items and relies on members bothering, but it is
accurate for local stores and carries no terms-of-use risk. (3) is fast but brittle (both sites
have changed their front ends since 2025, see §3), may breach the terms, and gives online prices
that may not match the shelf. Paid third-party scraping APIs (Apify actors and similar) move the
work but not the terms-of-use question, and cost money.

---

## 1. Official APIs, data feeds and affiliate programmes

**Woolworths SA.** No public developer API, product feed or partner programme for catalogue or
price data was found.

- A web search for a Woolworths SA developer API, product feed or affiliate programme returned only
  paid third-party wrappers ([RapidAPI "Woolworths Products API"](https://rapidapi.com/data-holdings-group-data-holdings-group-default/api/woolworths-products-api),
  [parse.bot woolworths.co.za API](https://parse.bot/marketplace/94630827-cc4b-4199-91d9-1bf19c8132c3/woolworths-co-za-api),
  [Apify Woolworths scraper](https://apify.com/sleepmodesystems/woolworths-scraper/api/openapi)).
  None of them is run by Woolworths. ⚠ Not opened.
- An affiliate directory lists a ["Woolworths Supermarkets" affiliate program](https://www.affiliate-toolkit.com/program/woolworths-supermarkets/).
  "Woolworths Supermarkets" is the Australian company's name, and nothing ties this listing to
  woolworths.co.za. ⚠ Unverified; check with Woolworths SA.
- Woolworths SA publishes [`llms.txt`](https://www.woolworths.co.za/llms.txt) and
  [`llms-full.txt`](https://www.woolworths.co.za/llms-full.txt) for automated agents. According
  to search summaries, the full file says it does not override `robots.txt`, access controls, rate
  limits or legal terms; tells agents not to use undocumented internal endpoints as stable public
  interfaces; and says not to automate checkout, account or loyalty actions without an authorised
  integration (⚠ not fetched; read it directly). This is the nearest thing to an official
  statement on automated use, and it doesn't offer a data feed.

**Shoprite / Checkers / Sixty60.** No developer portal, partner API or affiliate programme was
found.

- Searches returned only third-party Apify actors for Sixty60 and Checkers/Shoprite
  ([sa-sixty60-search](https://apify.com/sirgrant11788/sa-sixty60-search),
  [checkers-shoprite-scraper](https://apify.com/moggedhq/checkers-shoprite-scraper)). ⚠ Not opened.
- The APIs the Sixty60 app uses (`catalog.sixty60.co.za`, `api.shopritegroup.co.za/dsl/...`,
  `orders-api.sixty60.co.za` and others) exist, but they are private: they need hard-coded app API
  keys, device headers and a bearer token from a bootstrap call
  ([grocery-mcp `retailer-recon.md`](https://github.com/langabi/grocery-mcp/blob/4c44c71986c92e65a42f0aab210fa1f0dbeba31a/docs/retailer-recon.md),
  [`sixty60/client.py`](https://github.com/langabi/grocery-mcp/blob/4c44c71986c92e65a42f0aab210fa1f0dbeba31a/src/grocery_mcp/retailers/sixty60/client.py)).
  The checkers60-cli README says: "Not affiliated with Checkers, Sixty60, or the Shoprite Group.
  This tool talks to private, undocumented APIs reverse-engineered from the Sixty60 Android app"
  ([README](https://github.com/yashiels/checkers60-cli/blob/1e4c5d10cdb3a854104b8852150c525b46bc4f5e/README.md)).
  None of this is a sanctioned interface.

**Conclusion:** if an official route exists, it isn't public. Writing to each retailer's online
customer service or partnerships contact is free and settles it; a hobby app is unlikely to get a
feed, but a written "yes, that's fine" for low-volume reading would settle §2 as well.

## 2. Terms of use and robots.txt

⚠ **None of these documents could be fetched from this sandbox.** The URLs are the primary sources;
the descriptions come from search-engine summaries and must be checked against the live pages.

### Woolworths SA

| Document | URL | What search summaries report (⚠ unverified) |
| --- | --- | --- |
| robots.txt | <https://www.woolworths.co.za/robots.txt> | General rules disallow `/dashboard`, `/checkout`, `/login`, `/registration` and some tracking-parameter patterns; several named crawlers (Baiduspider, Yandex, Sogou) are disallowed entirely; declares a sitemap index. Product pages (`/prod/...`) were **not** reported as disallowed. |
| llms-full.txt | <https://www.woolworths.co.za/llms-full.txt> | "Do not use undocumented internal endpoints as stable public interfaces"; says it does not override robots.txt, authentication, access controls, rate limits, security systems or legal terms. |
| Terms and conditions | <https://www.woolworths.co.za/corporate/fol110048> (linked from `llms.txt` per search summary) | Text not found in search results. Whether it prohibits robots, spiders or data mining is **unknown**. |

The Woolworths *Australia* terms prohibit using "any robot, spider, site search and retrieval
application or other mechanism to retrieve or index any portion of the Site"
([woolworths.com.au T&Cs](https://www.woolworths.com.au/shop/services/terms-and-conditions), ⚠ via
search). That is a different company (Woolworths Group, Australia) and **does not apply** to
woolworths.co.za; it is mentioned only because search results often mix the two up.

### Checkers / Shoprite

| Document | URL | What search summaries report (⚠ unverified) |
| --- | --- | --- |
| robots.txt | <https://www.checkers.co.za/robots.txt> | Allows Googlebot, several AI crawlers and SEO tools; disallows named "spam/scraper bots" such as MJ12bot and dotbot; disallows `/login/` and `/my-profile/` for all user agents. |
| robots.txt (old catalogue host) | <https://products.checkers.co.za/robots.txt> | Not found in search results. |
| robots.txt (Shoprite) | <https://www.shoprite.co.za/robots.txt> | An open-source scraper's README says this file sets a 10-second crawl delay and an allowed visit time of 04:00–08:45 UTC ([retailer-scrapers README](https://github.com/JoshuaVanStraaten/retailer-scrapers/blob/c8d7bf597217f2e168367b33e91ceec84cd304d9/README.md)); the same repo's code applies those values to Pick n Pay, so which site they belong to is unclear. ⚠ |
| Website terms of use | Not located. Shoprite Group hosts many terms at <https://www.termsconditions.co.za/>; the closest found was the [Xtra Savings Plus terms](https://www.checkers.co.za/terms-and-conditions/legal-terms-and-conditions-xtrasavingsplus), described as "a binding legal agreement between you and Shoprite Checkers (Pty) Ltd. that governs your use of the Services". | Whether the site terms forbid automated access is **unknown**. |

**What to do before automating anything:** open the four URLs above in a browser, search each
for "robot", "spider", "scrape", "automated", "data mining", "commercial" and "personal use", and
record the date and wording in this file.

## 3. How the sites expose prices

⚠ **Live product pages could not be fetched** (proxy `403` for both retailers), so whether they
carry schema.org `Product`/`Offer` JSON-LD, and what bot protection sits in front of them, was
**not observed**. What follows comes from the source code of tools that do read these sites; the
dates show how recently each approach worked for its author.

### Woolworths SA

- **Product URLs in this repo.** All 207 products link to `https://www.woolworths.co.za/prod/_/A-<id>`
  (`src/data/seed.json`). 147 ids are 13-digit barcodes (e.g. `A-6009195030636`) and 60 are
  8-digit internal codes (e.g. `A-20008758`). Either way, the id is a stable key to match on.
- **Search API (Constructor.io, public key).** Woolworths search is served by Constructor.io at
  `https://wpkmgeuco-zone.cnstrc.com/search/{query}` with a public key; it needs no login and
  returns SKU, name, price, image and URL. Two independent tools use it:
  [woolworths-cli `lib/api-client.js`](https://github.com/yashiels/woolworths-cli/blob/b28c254d76e5095505525af696136a289ab94b77/lib/api-client.js)
  (comment: "Constructor.io (wpkmgeuco-zone.cnstrc.com) — product search (public key, no auth)")
  and [grocery-mcp `woolworths/client.py`](https://github.com/langabi/grocery-mcp/blob/4c44c71986c92e65a42f0aab210fa1f0dbeba31a/src/grocery_mcp/retailers/woolworths/client.py).
  grocery-mcp's reconnaissance (13 Sept 2026) warns that this result has "no proven store
  availability or normalized pack/unit information" and that "search price and availability must
  therefore be treated as provisional until checked in a selected delivery context"
  ([retailer-recon.md](https://github.com/langabi/grocery-mcp/blob/4c44c71986c92e65a42f0aab210fa1f0dbeba31a/docs/retailer-recon.md)).
- **App API (private).** Product, cart and delivery data for the Woolworths Dash app come from
  `wfs-appserver.wigroup.co/wfs/app/v4`, authenticated through AWS Cognito with hard-coded Android
  app headers (same recon document). woolworths-cli says it was "reverse-engineered from the
  Woolworths Dash Android app (v10.11.0)" ([README](https://github.com/yashiels/woolworths-cli/blob/b28c254d76e5095505525af696136a289ab94b77/README.md)).
- **Website embedded JSON.** A June 2026 price-comparison tool drives a real Chrome via Selenium to
  `/browse?searchterm=...` and reads product data from the page's `__NEXT_DATA__` script
  (`props.pageProps.dehydratedState.queries[].state.data.pages[0].productCatalogItems.items`, with
  `price.amount`), which implies the storefront is a Next.js app
  ([price-compare `woolworths.ts`](https://github.com/SirGrant11788/price-compare/blob/000200b55259325e9bd0218695e0c29e88b43596/src/lib/scrapers/woolworths.ts)).
  The same code hides the WebDriver flag and sets a desktop user agent, so its author expected bot
  checks.
- **Older JSON endpoint.** A 2025 scraper called `https://www.woolworths.co.za/server/searchCategory`
  with Endeca-style parameters (`N-…`, `No`, `Nrpp`) and read `startingPrice.p_pl10`
  ([retailer-scrapers `scrape_woolworths.py`](https://github.com/JoshuaVanStraaten/retailer-scrapers/blob/c8d7bf597217f2e168367b33e91ceec84cd304d9/scripts/scrape_woolworths.py)).
  Whether this still works after the apparent move to Next.js is unknown.
- **Regional pricing.** An Apify actor advertises "prices in all three Woolworths price zones"
  ([zaiq/woolworths-sa-scraper](https://apify.com/zaiq/woolworths-sa-scraper.md), ⚠ via search
  summary). If true, one online price doesn't fit every member.
- **Bot protection.** Not observed. A scraping vendor's page claims woolworths.co.za ranks low on
  its success rate ([Crawlbase](https://crawlbase.com/cookbook/woolworths), ⚠ vendor claim). No
  primary evidence of Akamai or Cloudflare was found.

### Checkers

- **Two URL shapes in this repo.** Of the 207 rows in `data/checkers.csv`, 103 link to
  `https://www.checkers.co.za/product/<slug>-<24-hex id>`, 46 to the older
  `https://products.checkers.co.za/.../p/<number>EA` catalogue, and 58 have no link. The 24-hex ids
  look the same as Sixty60 catalogue product ids (e.g. `617ac38078b00cc626391824` in
  [checkers60-cli tests](https://github.com/yashiels/checkers60-cli/tree/1e4c5d10cdb3a854104b8852150c525b46bc4f5e/src/__tests__)),
  which suggests the new checkers.co.za runs on the Sixty60 catalogue. *This is an inference, not
  verified.* One row notes "Staffords Artichoke Hearts 400g listed but no price shown", which fits
  prices being store-dependent.
- **Sixty60 catalogue API (private).** Search is `POST https://catalog.sixty60.co.za/api/v3/products/filter`
  with a JSON body that includes `userContext.storeContexts` and a `location`; prices come back in
  cents (`priceWithoutDecimal`) with promotion flags
  ([checkers60-cli `src/lib/api.ts`](https://github.com/yashiels/checkers60-cli/blob/1e4c5d10cdb3a854104b8852150c525b46bc4f5e/src/lib/api.ts)).
  Store contexts are resolved from a latitude/longitude; grocery-mcp says it "live-verified" an
  anonymous store lookup and search ("A generic Cape Town location returned five store contexts")
  and warns to "treat store IDs and product availability as location-specific"
  ([retailer-recon.md](https://github.com/langabi/grocery-mcp/blob/4c44c71986c92e65a42f0aab210fa1f0dbeba31a/docs/retailer-recon.md)).
  Headers include hard-coded app versions, a device id and `storeids`
  ([`sixty60/client.py`](https://github.com/langabi/grocery-mcp/blob/4c44c71986c92e65a42f0aab210fa1f0dbeba31a/src/grocery_mcp/retailers/sixty60/client.py)).
- **Website, rendered.** The June 2026 price-compare tool loads `https://www.checkers.co.za/search?Search=…`
  in Selenium Chrome and reads CSS-module classes such as `p.product-card_product-name__8wxGT` and
  `span.price-display_full__ngphI` ([`checkers.ts`](https://github.com/SirGrant11788/price-compare/blob/000200b55259325e9bd0218695e0c29e88b43596/src/lib/scrapers/checkers.ts)).
  Hashed class names like these change with each front-end build. Its comment "Non-headless for
  better bot-detection evasion" suggests bot checks.
- **Older Hybris site.** A 2025 scraper parsed `products.checkers.co.za` HTML (`.item-product__name`,
  `.now`, `.before`) and posted to `/populateProductsWithHeavyAttributes` for promotions, sending a
  `checkersZA-preferredStore` cookie, a CSRF token and session cookies copied from a browser
  ([`scrape_checkers.py`](https://github.com/JoshuaVanStraaten/retailer-scrapers/blob/c8d7bf597217f2e168367b33e91ceec84cd304d9/scripts/scrape_checkers.py)).
  It logs "Headers/cookies may need updating" when the call fails.

### What this means for Recipe Hub

- Every working approach above depends on something the retailer can change without notice
  (private API keys, app versions, hashed CSS classes, a page's JSON shape). Both sites seem to have
  changed front end between 2025 and 2026.
- Prices depend on a store (Checkers, verified in code) or a price zone (Woolworths, ⚠ claimed).
- The browser-based tools disguise automation; that is exactly the kind of thing terms of use and
  the "without authority" wording in §5 are about.
- Whether a plain HTTP fetch of a product page returns a price in JSON-LD is **still open**. A
  quick manual check: open one product page from the catalogue, View Source, search for
  `application/ld+json` and `"price"`.

## 4. Third-party services, datasets and open-source scrapers

### Consumer price-comparison services (⚠ not opened; self-described)

| Service | What it says | API? |
| --- | --- | --- |
| [Grocify](https://play.google.com/store/apps/details?id=com.grocifyza.app&hl=en_US) | Free app comparing Checkers, Pick n Pay, Woolworths, SPAR, Shoprite, Clicks, Dis-Chem; [MyBroadband](https://mybroadband.co.za/news/smartphones/661269-south-african-grocery-price-comparison-app-adds-takealot-and-makro.html) reports Takealot and Makro added | None found |
| [Save My Basket](https://www.savemybasket.co.za/) | Claims 50+ stores; "not affiliated with or endorsed by the retailers" | None found |
| [Troli](https://www.troli.co.za/) | Compares Checkers, Pick n Pay and Woolworths | None found |

None offers a public API or data licence that was found, and their data presumably comes from the
same scraping, so building on them inherits the same questions plus their own terms.

### Paid scraping APIs (⚠ not opened)

Apify actors for [Woolworths SA](https://apify.com/zaiq/woolworths-sa-scraper.md),
[Sixty60](https://apify.com/sirgrant11788/sa-sixty60-search) and
[Checkers/Shoprite](https://apify.com/moggedhq/checkers-shoprite-scraper); parse.bot listings for
[woolworths.co.za](https://parse.bot/marketplace/94630827-cc4b-4199-91d9-1bf19c8132c3/woolworths-co-za-api)
and [checkers.co.za](https://parse.bot/marketplace/aba8c6dd-64c9-4cda-bb5b-f294ac126540/checkers-co-za-api);
and a new [south-africa-retail-price-api](https://github.com/MJ2006/south-africa-retail-price-api)
(MIT, pushed 14 Nov 2026, "R50 free credit"). These are pay-per-use; the retailer's terms still
apply to the underlying scraping.

### Open datasets

- **PMBEJD Household Affordability Index**: monthly prices of 44 basic foods from 47 supermarkets
  and 32 butcheries in six cities, published with Heinrich Böll Stiftung
  ([archive](https://za.boell.org/en/node/2491), ⚠ via search). It's a basket index, not product
  prices, so it can't price Recipe Hub's specific products. At most it could flag "prices have risen
  about X% since October".
- No open, licensed product-level price dataset for Woolworths or Checkers was found.

### Open-source code (read at the commits listed under Sources)

| Repo | Approach | Licence | Last push |
| --- | --- | --- | --- |
| [yashiels/woolworths-cli](https://github.com/yashiels/woolworths-cli) | Constructor.io search + Dash app API | MIT | Sept 2026 |
| [yashiels/checkers60-cli](https://github.com/yashiels/checkers60-cli) | Sixty60 app API | MIT | Nov 2026 |
| [stephancill/checkers-sixty60](https://github.com/stephancill/checkers-sixty60) | Sixty60 app API | none | Jul 2026 |
| [langabi/grocery-mcp](https://github.com/langabi/grocery-mcp) | Python clean-room adapters for both; good recon notes | none in repo | Oct 2026 |
| [SirGrant11788/price-compare](https://github.com/SirGrant11788/price-compare) | Selenium Chrome on both websites | none | Jun 2026 |
| [JoshuaVanStraaten/retailer-scrapers](https://github.com/JoshuaVanStraaten/retailer-scrapers) | HTML + JSON endpoints (older sites) | none | Sept 2025 |

"No licence" means you may read the code but have no right to copy it (grocery-mcp's recon
reaches the same conclusion about stephancill/checkers-sixty60). The two MIT CLIs are the clearest
technical references.

## 5. Legal and ethical considerations (South Africa)

⚠ **None of the legislation could be opened from this sandbox.** The links are the official or
standard sources; descriptions come from search summaries and are not quotations. This is a map of
what to read, not legal advice.

- **Contract through website terms.** If a retailer's terms forbid automated access and a user
  accepts them, breaking them is a contract question rather than a crime by itself. The ECT Act
  gives data messages legal effect (Chapter III), which is how online terms come to bind
  ([ECT Act 25 of 2002, SAFLII PDF](https://www.saflii.org/za/legis/num_act/ecata2002427.pdf)).
  Whether "browsewrap" terms bind someone who never clicked "I agree" is not settled here.
- **ECT Act s 86** ("Unauthorised access to, interception of or interference with data") makes it
  an offence to intentionally access data "without authority or permission"; s 86(4) covers
  devices used to get past security measures
  ([acts.co.za s 86](https://www.acts.co.za/electronic-communications-and-transactions-act-2002/86__unauthorised_access_to_interception_of_or_interference_with_data)).
  Check whether the Cybercrimes Act amended or replaced it.
- **Cybercrimes Act 19 of 2020 s 2** ("Unlawful access"): an offence to "unlawfully and
  intentionally" perform an act in respect of a computer system or data storage medium that gives
  access to it ([gov.za Gazette 44651](https://www.gov.za/sites/default/files/gcis_document/202106/44651gon324.pdf),
  [acts.co.za s 2](https://www.acts.co.za/cybercrimes-act-2020/2__unlawful_access)). Reading a
  public page is very different from getting round a block, a login or bot protection, or using
  app keys taken from an APK. Those last are where the risk is.
- **Copyright Act 98 of 1978.** South Africa has no separate "database right" like the EU's. But
  section 1 defines "literary work" to include "tables and compilations, including tables and
  compilations of data stored in a computer"
  ([acts.co.za s 1](https://www.acts.co.za/copyright-act-1978/1_definitions),
  [SAFLII consolidation](https://www.saflii.org/za/legis/consol_act/ca1978133/)). Individual
  prices are facts, but copying a retailer's catalogue wholesale (names, descriptions, images)
  could touch copyright in the compilation. Recipe Hub already holds its own 207-row list made by
  hand, and needs only a number per row.
- **POPIA (Act 4 of 2013).** Prices aren't personal information. It applies to what Recipe Hub
  records about **members**: if shelf prices are attributed to the member who entered them, that
  is personal information processed by the app's operator
  ([gov.za POPIA page](https://www.gov.za/documents/protection-personal-information-act),
  [acts.co.za s 1](https://acts.co.za/protection-of-personal-information-/1__definitions)). Keep it
  minimal (member id and date, no location trail) and say so on the sign-in or settings page.
- **Ethics and courtesy.** Even where allowed: identify the client honestly, keep request rates
  low, obey `robots.txt`, don't hide automation, and don't republish the data. A law firm's general
  overview says scraping "is not illegal in South Africa" but depends on content and use, and lists
  copyright, POPIA and breach of terms as the main risks
  ([Mondaq / ENS](https://www.mondaq.com/southafrica/trademark/1508276/navigating-the-legalities-of-web-scraping-in-south-africa),
  ⚠ secondary source, not opened).

## 6. Fallbacks and partial automation

### a. Shelf prices entered by members (recommended)

The shopping list already has a tick-off step ("All ticked off", "Untick all" in
`src/components/ShoppingListView.tsx`) and each person already chooses a store. A small addition:

- When ticking an item, show its current price in a small editable field. Typing a different
  number records an **observation**: `{ productKey, store: "woolworths" | "checkers", price,
  promo?: boolean, observedAt, observedBy }`.
- Store observations separately from the catalogue, for example a new `price_observations` table
  with row-level security like `book_parts` (members insert their own; editors read all). The
  shared catalogue is the `catalog` part of `book_parts` (`supabase/migrations/20261117000000_init.sql`),
  so accepting a price is an ordinary edit to `productEdits`.
- Apply rules: an editor accepts it on **Prices** (filter "New shelf prices"), or it applies
  automatically when it is within, say, ±25% of the current price and two members agree. Set
  `updated` to the observation date so "last checked" stays honest.
- Because Checkers prices depend on the store and Woolworths may have price zones, a shelf price
  from the members' own shops is arguably *more* correct for this app than any online price.

Costs: one form field, one table, one review filter. Coverage grows with use and stays thin on
items nobody buys.

### b. Periodic CSV (already built)

**Prices → Export CSV** writes `Key, Product, Section, Pack size, Unit, Shelf price (R), Regular
price (R), Price checked, Link, Note, Checkers product, Checkers pack size, Checkers price (R),
Checkers regular (R), Checkers match, Checkers link, Checkers note`; **Import CSV** matches on
`Key` and only resets the date when a price changes (`src/components/PricesView.tsx`). Sort by
"Price checked" (oldest first) and refresh the oldest 30 items each month: about an hour, no
tooling needed.

### c. Assisted refresh run by a person on their own machine (optional)

If, after reading §2, the terms allow it:

- Input: the exported CSV. Output: the same CSV with new prices filled in plus a "changed" column,
  for the person to review and import. No change to the app.
- Fetch only the stored `Link` for each row (207 + about 150 pages), one at a time with several
  seconds between requests, from the person's own computer and browser session with their store
  chosen. Prefer reading JSON-LD or visible prices on the product page over private app APIs.
- Don't use app API keys extracted from APKs, don't evade bot checks, and stop on any block or
  CAPTCHA rather than retrying.
- Expect it to break whenever a site changes, and budget for that.

### d. Not recommended here

- **Scheduled server-side scraping** (Vercel cron, Supabase Edge Function): runs from cloud IP
  ranges that bot protection usually treats with suspicion, runs unattended without a person
  reading the terms, and gives prices with no store context.
- **Private mobile-app APIs** (Sixty60, Woolworths Dash): need extracted keys and device headers,
  Woolworths' own agent guidance reportedly says not to rely on undocumented endpoints (⚠), and
  they are the hardest to defend under "without authority".

## 7. Recommendation and trade-offs

| Option | Freshness | Local accuracy | Effort to build | Upkeep | Terms / legal risk |
| --- | --- | --- | --- | --- | --- |
| Members' shelf prices | Items people buy: high; others: low | High (their stores) | Small | Very low | None found |
| Periodic CSV (exists) | As often as someone does it | Depends on who checks | None | Manual time | Low (manual browsing) |
| Local assisted script | High when run | Medium (one store/zone) | Medium | Breaks when sites change | ⚠ depends on unread terms |
| Paid scraping API | High | Medium/unknown | Small–medium | Low, costs money | ⚠ shifted, not removed |
| Server-side cron scraper / private APIs | High until blocked | Medium | Medium–large | High | Highest |

**Recommended:** build (a) members' shelf prices now, keep (b) for the long tail, and decide on (c)
only after a person has read the live terms and `robots.txt` for both retailers and recorded them in
§2. Separately, a short email to each retailer asking whether a hobby app may read prices for 207
products a month costs nothing and may settle the question.

### Open items to verify by hand

1. Text of the Woolworths SA terms (<https://www.woolworths.co.za/corporate/fol110048>) and
   Checkers' website terms (footer of checkers.co.za / termsconditions.co.za).
2. The live `robots.txt` for www.woolworths.co.za, www.checkers.co.za and products.checkers.co.za.
3. Whether a product page carries schema.org JSON-LD with a price.
4. Whether Woolworths SA has price zones, and which one applies to members.
5. Whether the "Woolworths Supermarkets" affiliate listing is Woolworths SA.

## Sources

**This repository** (read 22 Nov 2026): `README.md`, `src/types.ts` (`Product`, `StoreOffer`),
`data/checkers.csv`, `src/data/seed.json`, `src/components/PricesView.tsx`,
`src/components/ShoppingListView.tsx`, `supabase/migrations/20261117000000_init.sql`.

**Open-source code, cloned and read** (primary for their own behaviour):

- yashiels/woolworths-cli @ `b28c254d76e5095505525af696136a289ab94b77` — <https://github.com/yashiels/woolworths-cli>
- yashiels/checkers60-cli @ `1e4c5d10cdb3a854104b8852150c525b46bc4f5e` — <https://github.com/yashiels/checkers60-cli>
- langabi/grocery-mcp @ `4c44c71986c92e65a42f0aab210fa1f0dbeba31a` — <https://github.com/langabi/grocery-mcp> (esp. `docs/retailer-recon.md`)
- SirGrant11788/price-compare @ `000200b55259325e9bd0218695e0c29e88b43596` — <https://github.com/SirGrant11788/price-compare>
- JoshuaVanStraaten/retailer-scrapers @ `c8d7bf597217f2e168367b33e91ceec84cd304d9` — <https://github.com/JoshuaVanStraaten/retailer-scrapers>
- stephancill/checkers-sixty60 @ `f20114850f15b1d276124c294ad826866595d7c9` — <https://github.com/stephancill/checkers-sixty60>
- Also found by GitHub search, not read in depth: keanu-001/checkers-price-fetch, rijff24/MealBudgetScraper (AGPL-3.0), lukanyonani/ZA-Grocery-API, MJ2006/south-africa-retail-price-api.

**Retailer documents** (⚠ blocked from this sandbox; described from search summaries):

- <https://www.woolworths.co.za/robots.txt>
- <https://www.woolworths.co.za/llms.txt>, <https://www.woolworths.co.za/llms-full.txt>
- <https://www.woolworths.co.za/corporate/fol110048> (terms)
- <https://www.checkers.co.za/robots.txt>
- <https://www.checkers.co.za/terms-and-conditions/legal-terms-and-conditions-xtrasavingsplus>
- <https://www.termsconditions.co.za/>
- <https://www.shoprite.co.za/robots.txt>

**Legislation** (⚠ blocked; described from search summaries):

- ECT Act 25 of 2002 — <https://www.saflii.org/za/legis/num_act/ecata2002427.pdf>; s 86 — <https://www.acts.co.za/electronic-communications-and-transactions-act-2002/86__unauthorised_access_to_interception_of_or_interference_with_data>
- Cybercrimes Act 19 of 2020 — <https://www.gov.za/sites/default/files/gcis_document/202106/44651gon324.pdf>; s 2 — <https://www.acts.co.za/cybercrimes-act-2020/2__unlawful_access>
- Copyright Act 98 of 1978 — <https://www.saflii.org/za/legis/consol_act/ca1978133/>; s 1 — <https://www.acts.co.za/copyright-act-1978/1_definitions>
- POPIA 4 of 2013 — <https://www.gov.za/documents/protection-personal-information-act>; s 1 — <https://acts.co.za/protection-of-personal-information-/1__definitions>

**Third-party and secondary** (⚠ not opened; used only for leads):

- Apify: <https://apify.com/zaiq/woolworths-sa-scraper.md>, <https://apify.com/sleepmodesystems/woolworths-scraper/api/openapi>, <https://apify.com/sirgrant11788/sa-sixty60-search>, <https://apify.com/moggedhq/checkers-shoprite-scraper>
- parse.bot: <https://parse.bot/marketplace/94630827-cc4b-4199-91d9-1bf19c8132c3/woolworths-co-za-api>, <https://parse.bot/marketplace/aba8c6dd-64c9-4cda-bb5b-f294ac126540/checkers-co-za-api>
- RapidAPI: <https://rapidapi.com/data-holdings-group-data-holdings-group-default/api/woolworths-products-api>
- Affiliate directory: <https://www.affiliate-toolkit.com/program/woolworths-supermarkets/>
- Crawlbase: <https://crawlbase.com/cookbook/woolworths>
- Grocify: <https://play.google.com/store/apps/details?id=com.grocifyza.app&hl=en_US>; MyBroadband: <https://mybroadband.co.za/news/smartphones/661269-south-african-grocery-price-comparison-app-adds-takealot-and-makro.html>
- Save My Basket: <https://www.savemybasket.co.za/>; Troli: <https://www.troli.co.za/>
- PMBEJD index: <https://za.boell.org/en/node/2491>
- Mondaq / ENS: <https://www.mondaq.com/southafrica/trademark/1508276/navigating-the-legalities-of-web-scraping-in-south-africa>
- Woolworths Australia T&Cs (different company): <https://www.woolworths.com.au/shop/services/terms-and-conditions>
