// Turns the single-file build (dist-single/index.html) into a page body for
// hosting as a Claude artifact, which supplies its own <html>/<head>/<body>.
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("dist-single/index.html", "utf8");
const head = html.match(/<head>([\s\S]*?)<\/head>/i)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/i)[1];
const keepHead = head
  .replace(/<meta charset[^>]*>/i, "")
  .replace(/<meta name="viewport"[^>]*>/i, "")
  .trim();
// Title first so it's found in the first 8 KB.
const title = keepHead.match(/<title>[\s\S]*?<\/title>/i)[0];
writeFileSync("dist-single/recipe-hub.html", `${title}\n${keepHead.replace(title, "")}\n${body.trim()}\n`);
console.log("Wrote dist-single/recipe-hub.html");
