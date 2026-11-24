/**
 * Draws the picture shown on each Stream Deck key.
 *
 * Keys are drawn as small vector images (SVG) on the fly, so one button can show
 * tally colour, a label, and a running clock without shipping hundreds of image files.
 */

/** Colours. Red and green follow broadcast tally convention: red is on air, green is next. */
export const COLORS = {
	idle: "#16335F",
	idleEdge: "#2B5391",
	cream: "#FBF3E4",
	gold: "#E9B44C",
	coral: "#F26B5B",
	teal: "#2A9D8F",
	program: "#D8201A",
	preview: "#15903F",
	offline: "#3A3F4A",
	offlineText: "#9AA3B2",
} as const;

export type Tone = "idle" | "program" | "preview" | "gold" | "teal" | "coral" | "offline";

export type KeyFace = {
	/** Small text across the top, for example "PGM". */
	caption?: string;
	/** Big text in the middle, for example "CAM 1". */
	label: string;
	/** Small text across the bottom, for example a clock. */
	footer?: string;
	tone: Tone;
};

const TONES: Record<Tone, { fill: string; edge: string; text: string; sub: string }> = {
	idle: { fill: COLORS.idle, edge: COLORS.idleEdge, text: COLORS.cream, sub: COLORS.gold },
	program: { fill: COLORS.program, edge: "#FF6A60", text: "#FFFFFF", sub: "#FFE3E0" },
	preview: { fill: COLORS.preview, edge: "#5FD48A", text: "#FFFFFF", sub: "#DFF7E7" },
	gold: { fill: COLORS.gold, edge: "#F6D58F", text: "#1B2433", sub: "#1B2433" },
	teal: { fill: COLORS.teal, edge: "#6FCFC3", text: "#FFFFFF", sub: "#E2F6F3" },
	coral: { fill: COLORS.coral, edge: "#F9A79C", text: "#FFFFFF", sub: "#FFE9E5" },
	offline: { fill: COLORS.offline, edge: "#555C6B", text: COLORS.offlineText, sub: COLORS.offlineText },
};

/** The face every key shows while the switcher cannot be reached. */
export function offlineFace(label: string, hasHost: boolean): KeyFace {
	return { caption: hasHost ? "NO ATEM" : "SET IP", label, tone: "offline" };
}

/** Builds the SVG for a key face. */
export function renderSvg(face: KeyFace): string {
	const tone = TONES[face.tone];
	const lines = splitLabel(face.label);
	const size = labelSize(lines);
	const lineHeight = size * 1.05;
	const centre = 72 + (face.caption && !face.footer ? 6 : 0) - (face.footer && !face.caption ? 6 : 0);
	const firstBaseline = centre - ((lines.length - 1) * lineHeight) / 2 + size * 0.35;

	const text = lines
		.map(
			(line, i) =>
				`<text x="72" y="${round(firstBaseline + i * lineHeight)}" font-size="${size}" font-weight="800" fill="${tone.text}" text-anchor="middle">${escapeXml(line)}</text>`,
		)
		.join("");

	const caption = face.caption
		? `<text x="72" y="30" font-size="${smallSize(face.caption, 20)}" font-weight="700" fill="${tone.sub}" text-anchor="middle" letter-spacing="1.5">${escapeXml(face.caption)}</text>`
		: "";
	const footer = face.footer
		? `<text x="72" y="128" font-size="${smallSize(face.footer, 22)}" font-weight="700" fill="${tone.sub}" text-anchor="middle">${escapeXml(face.footer)}</text>`
		: "";

	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144" font-family="Inter, 'Helvetica Neue', Arial, sans-serif">` +
		`<rect x="4" y="4" width="136" height="136" rx="18" fill="${tone.fill}" stroke="${tone.edge}" stroke-width="4"/>` +
		caption +
		text +
		footer +
		`</svg>`
	);
}

/** Turns an SVG into the data URL format Stream Deck accepts. */
export function toDataUrl(svg: string): string {
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Splits a label over at most two lines so longer names stay readable. */
export function splitLabel(label: string): string[] {
	const clean = label.trim().replace(/\s+/g, " ");
	if (clean.length <= 6 || !clean.includes(" ")) {
		return [truncate(clean, 9)];
	}

	// Break at the space closest to the middle.
	const middle = clean.length / 2;
	let best = -1;
	for (let i = 0; i < clean.length; i++) {
		if (clean[i] === " " && (best === -1 || Math.abs(i - middle) < Math.abs(best - middle))) {
			best = i;
		}
	}
	return [truncate(clean.slice(0, best), 9), truncate(clean.slice(best + 1), 9)];
}

function labelSize(lines: string[]): number {
	const longest = Math.max(...lines.map((l) => l.length), 1);
	const byWidth = Math.floor(170 / longest);
	const cap = lines.length > 1 ? 34 : 50;
	return Math.max(18, Math.min(cap, byWidth));
}

/** Shrinks caption and footer text so longer wording stays inside the key. */
function smallSize(text: string, base: number): number {
	return Math.max(13, Math.min(base, Math.floor(175 / Math.max(text.length, 1))));
}

function truncate(text: string, max: number): string {
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function round(n: number): number {
	return Math.round(n * 10) / 10;
}

function escapeXml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Formats a switcher clock as H:MM:SS, dropping the hours while they are zero. */
export function formatClock(time: { hours: number; minutes: number; seconds: number } | undefined): string {
	if (!time) return "0:00";
	const mm = String(time.minutes).padStart(2, "0");
	const ss = String(time.seconds).padStart(2, "0");
	return time.hours > 0 ? `${time.hours}:${mm}:${ss}` : `${time.minutes}:${ss}`;
}

/** Formats a number of seconds of disk space left, for example "2h 05m left". */
export function formatRemaining(seconds: number | undefined): string | undefined {
	if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return undefined;
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m left`;
}
