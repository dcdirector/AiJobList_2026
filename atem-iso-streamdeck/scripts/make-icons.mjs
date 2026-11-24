// Generates the static images the manifest points at. Run with: npm run icons
// Live keys are drawn at runtime by src/render.ts; these are what shows in the action list
// and on a key before the plugin has painted it.
import { mkdirSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

import { COLORS, renderSvg } from "../src/render.ts";

const root = "com.dcdirector.atem-iso.sdPlugin/imgs";
mkdirSync(`${root}/actions`, { recursive: true });
mkdirSync(`${root}/plugin`, { recursive: true });

const W = `fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`;
const F = `fill="#FFFFFF"`;

/** name -> [default key face, 20x20 list glyph] */
const actions = {
	program: [{ caption: "PGM", label: "CAM 1", tone: "idle" }, `<rect x="3" y="5" width="14" height="10" rx="2" ${F}/>`],
	preview: [{ caption: "PVW", label: "CAM 1", tone: "idle" }, `<rect x="3" y="5" width="14" height="10" rx="2" ${W}/>`],
	cut: [{ label: "CUT", tone: "idle" }, `<rect x="3" y="5" width="6" height="10" rx="1" ${F}/><rect x="11" y="5" width="6" height="10" rx="1" ${W}/>`],
	auto: [{ label: "AUTO", tone: "idle" }, `<path d="M3 10h13M12 6l4 4-4 4" ${W}/>`],
	ftb: [{ label: "FTB", tone: "idle" }, `<rect x="3" y="5" width="14" height="10" rx="2" ${W}/><path d="M10 5h5a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-5z" ${F}/>`],
	"transition-style": [{ caption: "STYLE", label: "MIX", tone: "idle" }, `<rect x="3" y="4" width="9" height="9" rx="1.5" ${W}/><rect x="8" y="7" width="9" height="9" rx="1.5" ${W}/>`],
	"upstream-key": [{ label: "KEY 1", footer: "OFF", tone: "idle" }, `<rect x="3" y="4" width="14" height="12" rx="2" ${W}/><rect x="10" y="9" width="5" height="5" rx="1" ${F}/>`],
	"downstream-key": [{ label: "DSK 1", footer: "OFF", tone: "idle" }, `<rect x="3" y="4" width="14" height="12" rx="2" ${W}/><rect x="5" y="12" width="10" height="2" rx="1" ${F}/>`],
	output: [{ caption: "OUT", label: "PGM", tone: "idle" }, `<path d="M9 4H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4M8 10h9M13.5 6.5 17 10l-3.5 3.5" ${W}/>`],
	record: [{ label: "REC", footer: "READY", tone: "idle" }, `<circle cx="10" cy="10" r="6.5" ${W}/><circle cx="10" cy="10" r="3.2" ${F}/>`],
	iso: [{ label: "ISO", footer: "PGM ONLY", tone: "idle" }, `<rect x="3" y="3" width="6" height="6" rx="1" ${F}/><rect x="11" y="3" width="6" height="6" rx="1" ${F}/><rect x="3" y="11" width="6" height="6" rx="1" ${F}/><rect x="11" y="11" width="6" height="6" rx="1" ${F}/>`],
	stream: [{ label: "LIVE", footer: "OFF AIR", tone: "idle" }, `<circle cx="10" cy="10" r="2" ${F}/><path d="M6.2 6.2a5.4 5.4 0 0 0 0 7.6M13.8 6.2a5.4 5.4 0 0 1 0 7.6M3.6 3.9a8.6 8.6 0 0 0 0 12.2M16.4 3.9a8.6 8.6 0 0 1 0 12.2" ${W}/>`],
	macro: [{ caption: "MACRO 1", label: "M1", tone: "idle" }, `<path d="M6 4.5v11l9-5.5z" ${F}/>`],
};

for (const [name, [face, glyph]] of Object.entries(actions)) {
	writeFileSync(`${root}/actions/${name}-key.svg`, renderSvg(face));
	writeFileSync(
		`${root}/actions/${name}-icon.svg`,
		`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">${glyph}</svg>`,
	);
}

// Category icon: a 2x2 multiview grid with one tile live.
writeFileSync(
	`${root}/plugin/category-icon.svg`,
	`<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><rect x="4" y="5" width="9" height="8" rx="1.5" fill="#FFFFFF"/><rect x="15" y="5" width="9" height="8" rx="1.5" fill="none" stroke="#FFFFFF" stroke-width="1.6"/><rect x="4" y="15" width="9" height="8" rx="1.5" fill="none" stroke="#FFFFFF" stroke-width="1.6"/><rect x="15" y="15" width="9" height="8" rx="1.5" fill="none" stroke="#FFFFFF" stroke-width="1.6"/></svg>`,
);

// Marketplace icon has to be a PNG, so draw it as SVG and convert it.
const tile = (x, y, fill, stroke) =>
	`<rect x="${x}" y="${y}" width="150" height="112" rx="20" fill="${fill}" stroke="${stroke}" stroke-width="8"/>`;
const marketplace =
	`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" font-family="Inter, 'Helvetica Neue', Arial, sans-serif">` +
	`<rect width="512" height="512" rx="96" fill="${COLORS.idle}"/>` +
	tile(90, 96, COLORS.program, "#FF6A60") +
	tile(272, 96, COLORS.preview, "#5FD48A") +
	tile(90, 236, "#1F4379", COLORS.idleEdge) +
	tile(272, 236, "#1F4379", COLORS.idleEdge) +
	`<text x="256" y="440" font-size="84" font-weight="800" fill="${COLORS.cream}" text-anchor="middle" letter-spacing="6">ISO</text>` +
	`<circle cx="398" cy="412" r="16" fill="${COLORS.coral}"/>` +
	`</svg>`;

for (const [file, size] of [["marketplace.png", 256], ["marketplace@2x.png", 512]]) {
	const png = new Resvg(marketplace, { fitTo: { mode: "width", value: size }, font: { loadSystemFonts: true } }).render().asPng();
	writeFileSync(`${root}/plugin/${file}`, png);
}
console.log(`Wrote icons for ${Object.keys(actions).length} actions`);
