import { addIcon } from "obsidian";
import mark from "../assets/logo-mark.svg";

export const BRAND_ICON = "ask-your-notes-logo";

export function registerBrandIcon(): void {
	// Obsidian custom icons use a 100 × 100 viewBox. Keep the vector master
	// in assets and retain its presentation attributes inside the icon wrapper.
	const content = mark.replace(/<svg\b[^>]*>|<\/svg>/g, "").trim();
	addIcon(BRAND_ICON, `<g fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${content}</g>`);
}
