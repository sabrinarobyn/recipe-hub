/**
 * AI-generated stand-in photos for the built-in recipes, keyed by recipe id
 * (src/assets/mockups/<id>.jpg; data/mockups.csv lists the Canva source of each).
 * A recipe shows its mockup until someone adds a real photo.
 */
const files = import.meta.glob<string>("../assets/mockups/*.jpg", { eager: true, query: "?url", import: "default" });

const mockups: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf("/") + 1, -".jpg".length), url]),
);

export function mockupFor(recipeId: string): string | undefined {
  return mockups[recipeId];
}
