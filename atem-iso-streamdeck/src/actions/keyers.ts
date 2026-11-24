import { action } from "@elgato/streamdeck";
import type { Atem, AtemState } from "atem-connection";

import { AtemKey } from "../atem-key";
import type { KeyFace } from "../render";
import { sourceName, toNumber } from "../sources";

const ME = 0;

type KeyerSettings = { keyer?: string | number; label?: string };

/**
 * Turns the upstream keyer on or off air. On an ATEM Mini this is the layer used for
 * picture-in-picture and green screen, so this is the classic "PiP on/off" button.
 */
@action({ UUID: "com.dcdirector.atem-iso.upstream-key" })
export class UpstreamKeyKey extends AtemKey<KeyerSettings> {
	protected readonly offlineLabel = "KEY";

	protected face(settings: KeyerSettings, state: AtemState): KeyFace {
		const index = toNumber(settings.keyer, 1) - 1;
		const keyer = state.video.mixEffects[ME]?.upstreamKeyers[index];
		const label = settings.label?.trim() || `KEY ${index + 1}`;
		if (!keyer) return { caption: "N/A", label, tone: "offline" };
		return { label, footer: keyer.onAir ? "ON AIR" : "OFF", tone: keyer.onAir ? "program" : "idle" };
	}

	protected async press(settings: KeyerSettings, atem: Atem, state: AtemState): Promise<void> {
		const index = toNumber(settings.keyer, 1) - 1;
		const keyer = state.video.mixEffects[ME]?.upstreamKeyers[index];
		if (!keyer) throw new Error(`Upstream keyer ${index + 1} is not available on this switcher`);
		await atem.setUpstreamKeyerOnAir(!keyer.onAir, ME, index);
	}
}

/** Turns the downstream keyer on or off air. This is the top layer, normally a logo or lower third. */
@action({ UUID: "com.dcdirector.atem-iso.downstream-key" })
export class DownstreamKeyKey extends AtemKey<KeyerSettings> {
	protected readonly offlineLabel = "DSK";

	protected face(settings: KeyerSettings, state: AtemState): KeyFace {
		const index = toNumber(settings.keyer, 1) - 1;
		const keyer = state.video.downstreamKeyers[index];
		const label = settings.label?.trim() || `DSK ${index + 1}`;
		if (!keyer) return { caption: "N/A", label, tone: "offline" };
		return { label, footer: keyer.onAir ? "ON AIR" : "OFF", tone: keyer.onAir ? "program" : "idle" };
	}

	protected async press(settings: KeyerSettings, atem: Atem, state: AtemState): Promise<void> {
		const index = toNumber(settings.keyer, 1) - 1;
		const keyer = state.video.downstreamKeyers[index];
		if (!keyer) throw new Error(`Downstream keyer ${index + 1} is not available on this switcher`);
		await atem.setDownstreamKeyOnAir(!keyer.onAir, index);
	}
}

type OutputSettings = { source?: string | number; output?: string | number };

/**
 * Chooses what the HDMI output shows, for example multiview for you or clean program for a projector.
 * Lights teal while that source is the one going out.
 */
@action({ UUID: "com.dcdirector.atem-iso.output" })
export class OutputKey extends AtemKey<OutputSettings> {
	protected readonly offlineLabel = "OUT";

	protected face(settings: OutputSettings, state: AtemState): KeyFace {
		const bus = toNumber(settings.output, 1) - 1;
		const id = toNumber(settings.source, 10010);
		const current = state.video.auxilliaries[bus];
		if (current === undefined) return { caption: "N/A", label: "OUT", tone: "offline" };
		return { caption: "OUT", label: sourceName(state, id), tone: current === id ? "teal" : "idle" };
	}

	protected async press(settings: OutputSettings, atem: Atem): Promise<void> {
		await atem.setAuxSource(toNumber(settings.source, 10010), toNumber(settings.output, 1) - 1);
	}
}
