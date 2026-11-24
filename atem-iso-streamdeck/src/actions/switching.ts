import { action } from "@elgato/streamdeck";
import { type Atem, type AtemState, Enums } from "atem-connection";

import { AtemKey } from "../atem-key";
import type { KeyFace } from "../render";
import { sourceName, toNumber } from "../sources";

type SourceSettings = { source?: string | number };
type NoSettings = Record<string, never>;

/** The main mix bus. The ATEM Mini family has one, numbered 0. */
const ME = 0;

/** Puts a source straight on air (a hot cut on the program bus). Lights red while that source is live. */
@action({ UUID: "com.dcdirector.atem-iso.program" })
export class ProgramKey extends AtemKey<SourceSettings> {
	protected readonly offlineLabel = "PGM";

	protected face(settings: SourceSettings, state: AtemState): KeyFace {
		const id = toNumber(settings.source, 1);
		const live = state.video.mixEffects[ME]?.programInput === id;
		return { caption: "PGM", label: sourceName(state, id), tone: live ? "program" : "idle" };
	}

	protected async press(settings: SourceSettings, atem: Atem): Promise<void> {
		await atem.changeProgramInput(toNumber(settings.source, 1), ME);
	}
}

/** Lines a source up as next (the preview bus). Lights green while selected, red if it is already live. */
@action({ UUID: "com.dcdirector.atem-iso.preview" })
export class PreviewKey extends AtemKey<SourceSettings> {
	protected readonly offlineLabel = "PVW";

	protected face(settings: SourceSettings, state: AtemState): KeyFace {
		const id = toNumber(settings.source, 1);
		const me = state.video.mixEffects[ME];
		const tone = me?.previewInput === id ? "preview" : me?.programInput === id ? "program" : "idle";
		return { caption: "PVW", label: sourceName(state, id), tone };
	}

	protected async press(settings: SourceSettings, atem: Atem): Promise<void> {
		await atem.changePreviewInput(toNumber(settings.source, 1), ME);
	}
}

/** Swaps preview and program instantly. */
@action({ UUID: "com.dcdirector.atem-iso.cut" })
export class CutKey extends AtemKey<NoSettings> {
	protected readonly offlineLabel = "CUT";

	protected face(): KeyFace {
		return { label: "CUT", tone: "idle" };
	}

	protected async press(_settings: NoSettings, atem: Atem): Promise<void> {
		await atem.cut(ME);
	}
}

/** Runs the selected transition (mix, dip or wipe). Lights red while the transition is moving. */
@action({ UUID: "com.dcdirector.atem-iso.auto" })
export class AutoKey extends AtemKey<NoSettings> {
	protected readonly offlineLabel = "AUTO";

	protected face(_settings: NoSettings, state: AtemState): KeyFace {
		const me = state.video.mixEffects[ME];
		const style = me ? STYLE_NAMES[me.transitionProperties.nextStyle] : undefined;
		return { label: "AUTO", footer: style, tone: me?.transitionPosition.inTransition ? "program" : "idle" };
	}

	protected async press(_settings: NoSettings, atem: Atem): Promise<void> {
		await atem.autoTransition(ME);
	}
}

/** Fades the whole program to black, and back again on the next press. */
@action({ UUID: "com.dcdirector.atem-iso.ftb" })
export class FadeToBlackKey extends AtemKey<NoSettings> {
	protected readonly offlineLabel = "FTB";

	protected face(_settings: NoSettings, state: AtemState): KeyFace {
		const ftb = state.video.mixEffects[ME]?.fadeToBlack;
		if (ftb?.inTransition) return { label: "FTB", footer: "FADING", tone: "coral" };
		if (ftb?.isFullyBlack) return { label: "FTB", footer: "IN BLACK", tone: "program" };
		return { label: "FTB", tone: "idle" };
	}

	protected async press(_settings: NoSettings, atem: Atem): Promise<void> {
		await atem.fadeToBlack(ME);
	}
}

const STYLE_NAMES: Partial<Record<Enums.TransitionStyle, string>> = {
	[Enums.TransitionStyle.MIX]: "MIX",
	[Enums.TransitionStyle.DIP]: "DIP",
	[Enums.TransitionStyle.WIPE]: "WIPE",
	[Enums.TransitionStyle.DVE]: "DVE",
	[Enums.TransitionStyle.STING]: "STING",
};

const STYLE_BY_SETTING: Record<string, Enums.TransitionStyle> = {
	mix: Enums.TransitionStyle.MIX,
	dip: Enums.TransitionStyle.DIP,
	wipe: Enums.TransitionStyle.WIPE,
	dve: Enums.TransitionStyle.DVE,
};

type StyleSettings = { style?: string };

/** Chooses which transition the Auto button will run. Lights gold while that style is selected. */
@action({ UUID: "com.dcdirector.atem-iso.transition-style" })
export class TransitionStyleKey extends AtemKey<StyleSettings> {
	protected readonly offlineLabel = "STYLE";

	protected face(settings: StyleSettings, state: AtemState): KeyFace {
		const style = STYLE_BY_SETTING[settings.style ?? "mix"] ?? Enums.TransitionStyle.MIX;
		const selected = state.video.mixEffects[ME]?.transitionProperties.nextStyle === style;
		return { caption: "STYLE", label: STYLE_NAMES[style] ?? "MIX", tone: selected ? "gold" : "idle" };
	}

	protected async press(settings: StyleSettings, atem: Atem): Promise<void> {
		const style = STYLE_BY_SETTING[settings.style ?? "mix"] ?? Enums.TransitionStyle.MIX;
		await atem.setTransitionStyle({ nextStyle: style }, ME);
	}
}
