import { type AtemState, Enums } from "atem-connection";

export type SourceOption = { label: string; value: string };

/**
 * Sources offered in the settings panel before the switcher is reachable.
 * These numbers are the switcher's own source IDs, which are the same across the ATEM Mini family.
 */
export const FALLBACK_SOURCES: SourceOption[] = [
	{ label: "Camera 1", value: "1" },
	{ label: "Camera 2", value: "2" },
	{ label: "Camera 3", value: "3" },
	{ label: "Camera 4", value: "4" },
	{ label: "Black", value: "0" },
	{ label: "Color Bars", value: "1000" },
	{ label: "Color 1", value: "2001" },
	{ label: "Color 2", value: "2002" },
	{ label: "Media Player 1", value: "3010" },
];

/** Sources offered for the HDMI output before the switcher is reachable. */
export const FALLBACK_OUTPUT_SOURCES: SourceOption[] = [
	{ label: "Multiview", value: "9001" },
	{ label: "Program", value: "10010" },
	{ label: "Preview", value: "10011" },
	...FALLBACK_SOURCES,
];

/** Which bus a list of sources is for: the main mix (program and preview) or the HDMI output. */
export type SourceKind = "mix" | "output";

/**
 * Lists the sources the connected switcher allows on the given bus, falling back to the standard Mini list.
 * The switcher itself says where each source may be used, so the list is always right for the model in use.
 */
export function listSources(state: AtemState | undefined, kind: SourceKind = "mix"): SourceOption[] {
	const inputs = state ? Object.values(state.inputs) : [];
	const options = inputs
		.filter((input): input is NonNullable<typeof input> => !!input)
		.filter((input) =>
			kind === "mix"
				? (input.meAvailability & Enums.MeAvailability.Me1) !== 0
				: (input.sourceAvailability & Enums.SourceAvailability.Auxiliary) !== 0,
		)
		.sort((a, b) => a.inputId - b.inputId)
		.map((input) => ({ label: `${input.longName} (${input.inputId})`, value: String(input.inputId) }));
	if (options.length > 0) return options;
	return kind === "mix" ? FALLBACK_SOURCES : FALLBACK_OUTPUT_SOURCES;
}

/** Short on-key name for a source, preferring the name set on the switcher. */
export function sourceName(state: AtemState | undefined, id: number): string {
	const fromSwitcher = state?.inputs[id]?.shortName?.trim();
	if (fromSwitcher) return fromSwitcher.toUpperCase();

	const fallback = FALLBACK_OUTPUT_SOURCES.find((s) => s.value === String(id));
	if (id >= 1 && id <= 20) return `CAM ${id}`;
	return (fallback?.label ?? `SRC ${id}`).toUpperCase();
}

/** Reads a number out of a setting that may be stored as text, using a default when missing or invalid. */
export function toNumber(value: unknown, fallback: number): number {
	if (value === undefined || value === null || value === "") return fallback;
	const n = Number(value);
	return Number.isFinite(n) ? n : fallback;
}
