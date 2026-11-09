import { readFile, writeFile } from "node:fs/promises";

// All exports share the same path geometry; the plugin uses the monochrome
// master directly so host theme colors remain live CSS values.
const markUrl = new URL("../assets/logo-mark.svg", import.meta.url);
const master = await readFile(markUrl, "utf8");
const paths = master.replace(/<svg\b[^>]*>|<\/svg>/g, "").trim();

for (const [name, background, foreground] of [
  ["logo.svg", "#6D5BD0", "#FFFFFF"],
  ["logo-dark.svg", "#292335", "#C4B5FD"],
]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="Ask Your Notes">
  <rect x="16" y="16" width="480" height="480" rx="112" fill="${background}"/>
  <g transform="translate(99 81) scale(3.3)" fill="none" stroke="${foreground}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    ${paths}
  </g>
</svg>
`;
  await writeFile(new URL(`../assets/${name}`, import.meta.url), svg);
}
console.log("Updated logo.svg and logo-dark.svg from logo-mark.svg");
