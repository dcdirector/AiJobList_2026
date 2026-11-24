import { action } from "@elgato/streamdeck";
import { type Atem, type AtemState, Enums } from "atem-connection";

import { AtemKey } from "../atem-key";
import { formatClock, formatRemaining, type KeyFace } from "../render";
import { toNumber } from "../sources";

type HoldSettings = { holdToStop?: boolean };

/** Hold-to-stop is on unless it has been switched off in the settings panel. */
function holdEnabled(settings: HoldSettings): boolean {
	return settings.holdToStop !== false;
}

/**
 * Starts and stops recording to the USB disk. Shows the running clock while recording.
 * Stopping needs a one second hold by default, so a stray tap cannot end a recording.
 */
@action({ UUID: "com.dcdirector.atem-iso.record" })
export class RecordKey extends AtemKey<HoldSettings> {
	protected readonly offlineLabel = "REC";

	protected face(settings: HoldSettings, state: AtemState): KeyFace {
		const rec = state.recording;
		if (!rec) return { caption: "N/A", label: "REC", tone: "offline" };

		switch (rec.status?.state) {
			case Enums.RecordingStatus.Recording:
				return {
					caption: holdEnabled(settings) ? "HOLD = STOP" : "RECORDING",
					label: "REC",
					footer: formatClock(rec.duration),
					tone: "program",
				};
			case Enums.RecordingStatus.Stopping:
				return { label: "REC", footer: "STOPPING", tone: "coral" };
			default:
				return { label: "REC", footer: formatRemaining(rec.status?.recordingTimeAvailable) ?? "READY", tone: "idle" };
		}
	}

	protected override needsHold(settings: HoldSettings, state: AtemState): boolean {
		return holdEnabled(settings) && state.recording?.status?.state === Enums.RecordingStatus.Recording;
	}

	protected async press(_settings: HoldSettings, atem: Atem, state: AtemState): Promise<void> {
		if (!state.recording) throw new Error("This switcher cannot record");
		if (state.recording.status?.state === Enums.RecordingStatus.Recording) {
			await atem.stopRecording();
		} else {
			await atem.startRecording();
		}
	}
}

type NoSettings = Record<string, never>;

/**
 * Turns ISO recording on or off. With ISO on, the switcher records every camera as its own
 * file alongside the program, plus a DaVinci Resolve project, so the show can be re-cut later.
 * The switcher will not change this mid-recording, so the key locks while recording.
 */
@action({ UUID: "com.dcdirector.atem-iso.iso" })
export class IsoKey extends AtemKey<NoSettings> {
	protected readonly offlineLabel = "ISO";

	protected face(_settings: NoSettings, state: AtemState): KeyFace {
		const rec = state.recording;
		if (!rec || rec.recordAllInputs === undefined) return { caption: "N/A", label: "ISO", tone: "offline" };

		const recording = rec.status?.state === Enums.RecordingStatus.Recording;
		const footer = rec.recordAllInputs ? "ALL CAMS" : "PGM ONLY";
		if (recording) {
			return { caption: "LOCKED", label: "ISO", footer, tone: rec.recordAllInputs ? "program" : "offline" };
		}
		return { label: "ISO", footer, tone: rec.recordAllInputs ? "gold" : "idle" };
	}

	protected async press(_settings: NoSettings, atem: Atem, state: AtemState): Promise<void> {
		const rec = state.recording;
		if (!rec || rec.recordAllInputs === undefined) throw new Error("This switcher does not support ISO recording");
		if (rec.status?.state === Enums.RecordingStatus.Recording) {
			throw new Error("ISO recording cannot be changed while recording");
		}
		await atem.setEnableISORecording(!rec.recordAllInputs);
	}
}

/**
 * Starts and stops the live stream. Shows the running clock while on air.
 * Stopping needs a one second hold by default.
 */
@action({ UUID: "com.dcdirector.atem-iso.stream" })
export class StreamKey extends AtemKey<HoldSettings> {
	protected readonly offlineLabel = "LIVE";

	protected face(settings: HoldSettings, state: AtemState): KeyFace {
		const stream = state.streaming;
		if (!stream) return { caption: "N/A", label: "LIVE", tone: "offline" };

		switch (stream.status?.state) {
			case Enums.StreamingStatus.Streaming:
				return {
					caption: holdEnabled(settings) ? "HOLD = STOP" : "ON AIR",
					label: "LIVE",
					footer: formatClock(stream.duration),
					tone: "program",
				};
			case Enums.StreamingStatus.Connecting:
				return { label: "LIVE", footer: "CONNECTING", tone: "coral" };
			case Enums.StreamingStatus.Stopping:
				return { label: "LIVE", footer: "STOPPING", tone: "coral" };
			default:
				return { label: "LIVE", footer: "OFF AIR", tone: "idle" };
		}
	}

	protected override needsHold(settings: HoldSettings, state: AtemState): boolean {
		const status = state.streaming?.status?.state;
		const active = status === Enums.StreamingStatus.Streaming || status === Enums.StreamingStatus.Connecting;
		return holdEnabled(settings) && active;
	}

	protected async press(_settings: HoldSettings, atem: Atem, state: AtemState): Promise<void> {
		if (!state.streaming) throw new Error("This switcher cannot stream");
		const status = state.streaming.status?.state;
		if (status === Enums.StreamingStatus.Streaming || status === Enums.StreamingStatus.Connecting) {
			await atem.stopStreaming();
		} else {
			await atem.startStreaming();
		}
	}
}

type MacroSettings = { macro?: string | number; label?: string };

/**
 * Runs a macro saved on the switcher (a recorded string of button presses).
 * Lights red while it runs; pressing again stops it.
 */
@action({ UUID: "com.dcdirector.atem-iso.macro" })
export class MacroKey extends AtemKey<MacroSettings> {
	protected readonly offlineLabel = "MACRO";

	protected face(settings: MacroSettings, state: AtemState): KeyFace {
		const index = toNumber(settings.macro, 1) - 1;
		const macro = state.macro.macroProperties[index];
		const player = state.macro.macroPlayer;
		const running = player.isRunning && player.macroIndex === index;
		const caption = `MACRO ${index + 1}`;

		if (!macro?.isUsed) return { caption, label: "EMPTY", tone: "offline" };
		const label = settings.label?.trim() || macro.name?.trim() || `M${index + 1}`;
		if (running) return { caption, label, footer: player.isWaiting ? "WAITING" : "RUNNING", tone: "program" };
		return { caption, label, tone: "idle" };
	}

	protected async press(settings: MacroSettings, atem: Atem, state: AtemState): Promise<void> {
		const index = toNumber(settings.macro, 1) - 1;
		const player = state.macro.macroPlayer;
		if (player.isRunning && player.macroIndex === index) {
			await atem.macroStop();
			return;
		}
		if (!state.macro.macroProperties[index]?.isUsed) throw new Error(`Macro ${index + 1} is empty`);
		await atem.macroRun(index);
	}
}
