import { describe, expect, it } from "vitest";

import { isValidHost } from "../src/hub";
import { formatClock, formatRemaining, offlineFace, renderSvg, splitLabel } from "../src/render";
import { FALLBACK_SOURCES, listSources, sourceName, toNumber } from "../src/sources";

describe("key faces", () => {
	it("escapes names typed on the switcher so they cannot break the image", () => {
		const svg = renderSvg({ label: `A<B & "C"`, tone: "idle" });
		expect(svg).toContain("A&lt;B");
		expect(svg).not.toContain(`A<B`);
	});

	it("splits long names over two lines and trims what will not fit", () => {
		expect(splitLabel("CAM 1")).toEqual(["CAM 1"]);
		expect(splitLabel("MEDIA PLAYER 1")).toEqual(["MEDIA", "PLAYER 1"]);
		expect(splitLabel("SUPERCALIFRAGILISTIC")).toEqual(["SUPERCAL…"]);
	});

	it("tells the operator what is wrong while offline", () => {
		expect(offlineFace("REC", false).caption).toBe("SET IP");
		expect(offlineFace("REC", true).caption).toBe("NO ATEM");
	});
});

describe("clocks", () => {
	it("formats the record clock", () => {
		expect(formatClock(undefined)).toBe("0:00");
		expect(formatClock({ hours: 0, minutes: 4, seconds: 9 })).toBe("4:09");
		expect(formatClock({ hours: 1, minutes: 4, seconds: 9 })).toBe("1:04:09");
	});

	it("formats disk time left", () => {
		expect(formatRemaining(7500)).toBe("2h 05m");
		expect(formatRemaining(600)).toBe("10m left");
		expect(formatRemaining(0)).toBeUndefined();
		expect(formatRemaining(undefined)).toBeUndefined();
	});
});

describe("sources", () => {
	it("falls back to the standard Mini list while offline", () => {
		expect(listSources(undefined)).toBe(FALLBACK_SOURCES);
		expect(listSources(undefined, "output")[0]).toEqual({ label: "Multiview", value: "9001" });
	});

	it("names sources sensibly without a switcher", () => {
		expect(sourceName(undefined, 3)).toBe("CAM 3");
		expect(sourceName(undefined, 1000)).toBe("COLOR BARS");
		expect(sourceName(undefined, 4242)).toBe("SRC 4242");
	});

	it("reads numbers from settings that arrive as text", () => {
		expect(toNumber("3", 1)).toBe(3);
		expect(toNumber(undefined, 1)).toBe(1);
		expect(toNumber("", 1)).toBe(1);
		expect(toNumber("abc", 1)).toBe(1);
	});
});

describe("switcher address", () => {
	it("accepts real addresses and rejects half-typed ones", () => {
		expect(isValidHost("192.168.10.240")).toBe(true);
		expect(isValidHost("atem-mini.local")).toBe(true);
		expect(isValidHost("192.168.10.")).toBe(false);
		expect(isValidHost("192.168.10.999")).toBe(false);
		expect(isValidHost("")).toBe(false);
		expect(isValidHost("not an address")).toBe(false);
	});
});
