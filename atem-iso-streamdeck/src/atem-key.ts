import streamDeck, {
	type DidReceiveSettingsEvent,
	type KeyAction,
	type KeyDownEvent,
	type KeyUpEvent,
	type SendToPluginEvent,
	SingletonAction,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import type { Atem, AtemState } from "atem-connection";

import { type AtemHub, hub as sharedHub } from "./hub";
import { type KeyFace, offlineFace, renderSvg, toDataUrl } from "./render";
import { listSources } from "./sources";

/** How long a key must be held to stop a recording or stream, in milliseconds. */
export const HOLD_TO_STOP_MS = 1000;

/**
 * Shared behaviour for every button in this plugin.
 *
 * Each button type only has to answer two questions:
 *   1. face()  - what should I look like right now?
 *   2. press() - what do I tell the switcher when pressed?
 * Everything else (offline handling, repainting on tally changes, error flashes) lives here.
 */
export abstract class AtemKey<S extends JsonObject> extends SingletonAction<S> {
	/** Text shown on the key while the switcher is offline. */
	protected abstract readonly offlineLabel: string;

	private readonly settingsById = new Map<string, S>();
	private readonly lastImageById = new Map<string, string>();
	private readonly holdTimers = new Map<string, NodeJS.Timeout>();

	constructor(protected readonly hub: AtemHub = sharedHub) {
		super();
		this.hub.on("change", () => this.repaintAll());
	}

	/** Describes how the key should look for the given switcher state. */
	protected abstract face(settings: S, state: AtemState): KeyFace;

	/** Sends the command for a key press. */
	protected abstract press(settings: S, atem: Atem, state: AtemState): Promise<void>;

	/**
	 * When this returns true the key is "armed and running" (recording, streaming), and
	 * the press only goes through after the key has been held, so a stray tap cannot stop a show.
	 */
	protected needsHold(_settings: S, _state: AtemState): boolean {
		return false;
	}

	public override async onWillAppear(ev: WillAppearEvent<S>): Promise<void> {
		if (!ev.action.isKey()) return;
		this.settingsById.set(ev.action.id, ev.payload.settings);
		this.lastImageById.delete(ev.action.id);
		await this.paint(ev.action, ev.payload.settings);
	}

	public override onWillDisappear(ev: WillDisappearEvent<S>): void {
		this.settingsById.delete(ev.action.id);
		this.lastImageById.delete(ev.action.id);
		this.cancelHold(ev.action.id);
	}

	public override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<S>): Promise<void> {
		if (!ev.action.isKey()) return;
		this.settingsById.set(ev.action.id, ev.payload.settings);
		await this.paint(ev.action, ev.payload.settings);
	}

	public override async onKeyDown(ev: KeyDownEvent<S>): Promise<void> {
		const settings = ev.payload.settings;
		this.settingsById.set(ev.action.id, settings);

		const state = this.hub.state;
		if (!state || !this.hub.device) {
			await ev.action.showAlert();
			return;
		}

		if (this.needsHold(settings, state)) {
			this.cancelHold(ev.action.id);
			const timer = setTimeout(() => {
				this.holdTimers.delete(ev.action.id);
				void this.run(ev.action, settings, true);
			}, HOLD_TO_STOP_MS);
			this.holdTimers.set(ev.action.id, timer);
			return;
		}

		await this.run(ev.action, settings, false);
	}

	public override onKeyUp(ev: KeyUpEvent<S>): void {
		// Letting go early cancels a hold, so nothing is sent.
		this.cancelHold(ev.action.id);
	}

	/** Answers the settings panel when it asks for the list of sources on the switcher. */
	public override async onSendToPlugin(ev: SendToPluginEvent<JsonObject, S>): Promise<void> {
		const payload = ev.payload;
		const event = payload && typeof payload === "object" && "event" in payload ? payload.event : undefined;
		if (event === "getSources" || event === "getOutputSources") {
			const kind = event === "getSources" ? "mix" : "output";
			await streamDeck.ui.sendToPropertyInspector({ event, items: listSources(this.hub.state, kind) });
		}
	}

	private async run(action: KeyAction<S>, settings: S, confirm: boolean): Promise<void> {
		const state = this.hub.state;
		const atem = this.hub.device;
		if (!state || !atem) {
			await action.showAlert();
			return;
		}

		try {
			await this.press(settings, atem, state);
			if (confirm) await action.showOk();
		} catch (err) {
			streamDeck.logger.error(`${this.manifestId} failed: ${err}`);
			await action.showAlert();
		}
	}

	private cancelHold(id: string): void {
		const timer = this.holdTimers.get(id);
		if (timer) {
			clearTimeout(timer);
			this.holdTimers.delete(id);
		}
	}

	private repaintAll(): void {
		for (const action of this.actions) {
			if (!action.isKey()) continue;
			const settings = this.settingsById.get(action.id);
			if (settings) void this.paint(action, settings);
		}
	}

	private async paint(action: KeyAction<S>, settings: S): Promise<void> {
		const state = this.hub.state;
		const face = state ? this.safeFace(settings, state) : offlineFace(this.offlineLabel, !!this.hub.host);
		const image = toDataUrl(renderSvg(face));

		// Tally can change many times a second during a transition; skip repaints that would look identical.
		if (this.lastImageById.get(action.id) === image) return;
		this.lastImageById.set(action.id, image);

		try {
			await action.setImage(image);
		} catch (err) {
			this.lastImageById.delete(action.id);
			streamDeck.logger.warn(`Could not paint ${this.manifestId}: ${err}`);
		}
	}

	private safeFace(settings: S, state: AtemState): KeyFace {
		try {
			return this.face(settings, state);
		} catch (err) {
			streamDeck.logger.error(`${this.manifestId} could not read state: ${err}`);
			return { label: this.offlineLabel, tone: "offline" };
		}
	}
}
