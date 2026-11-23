# Store the Recipe Book as one record per Recipe

The Recipe Book's recipe edits used to be saved as one shared block (`book_parts` 'recipes'), which only Editors could write. Authors are coming: any Member will add Recipes and may change only their own, so the database has to tell who may change *which* Recipe. One block can only be allowed or refused as a whole, so we moved recipes to the `recipes` table, one record per Recipe (id, optional Author, body, deleted flag, timestamps), where row-level security can decide per Recipe. The original spreadsheet Recipes stay in the app as the base and records overlay them exactly as edits did: a record with a body is an edited original or an added Recipe, a record marked deleted is a removed Recipe, and no record means the original as it is ("Undo my changes" deletes the record). The migration carried every existing edit into records and retired the 'recipes' block. Product catalogue edits and categories stay in the shared 'catalog' block, since only Editors change them.

## Considered Options

- **Keep the shared block and check Authors in the app.** Rejected: the app can't be trusted to enforce rules, and any Member who could write the block could overwrite everyone's Recipes. It also makes every save rewrite the whole book, so two people editing different Recipes overwrite each other.
- **Store every Recipe in full, including the originals (seed the table from the spreadsheet).** Rejected for now: the originals and their cost-match tests live in `seed.json`, and copying them would split their source of truth. Overlaying keeps "Undo my changes" and "Removed recipes" working as before.
- **Normalise ingredient lines into their own table.** Rejected: nothing yet needs to query lines across Recipes, and the recipe editor saves a Recipe whole, so a JSON body is simpler.

## Consequences

- A deleted record keeps no body (the app's edits only remember that the Recipe was removed).
- Saving a record never changes its Author; who may write a record is decided by the database, not the client.
- The Claude-artifact and browser-only builds still keep recipe edits in one block; only the Supabase-hosted version uses records.
