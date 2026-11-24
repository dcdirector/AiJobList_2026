import { EventEmitter } from "node:events";

import { Atem, type AtemState, Enums } from "atem-connection";

/**
 * The hub is the one shared line to the switcher.
 *
 * TV comparison: think of it as the party-line intercom. Every button on the Stream Deck
 * listens to the same line, and when the switcher says "camera 2 is live", every button
 * hears it at once and repaints itself.
 */
export class AtemHub extends EventEmitter {
	private atem?: Atem;
	private timecodeTimer?: NodeJS.Timeout;

	/** IP address we are currently pointed at. */
	public host = "";

	/** True once the switcher has answered and sent its full state. */
	public connected = false;

	constructor(private readonly createAtem: () => Atem = () => new Atem({ disableMultithreaded: true })) {
		super();
		this.setMaxListeners(50);
	}

	/** The latest picture of the switcher, or undefined while offline. */
	public get state(): AtemState | undefined {
		return this.connected ? this.atem?.state : undefined;
	}

	/** The connection used to send commands, or undefined while offline. */
	public get device(): Atem | undefined {
		return this.connected ? this.atem : undefined;
	}

	/**
	 * Points the hub at a switcher. Safe to call repeatedly; it only reconnects when the address changes.
	 */
	public async setHost(host: string | undefined): Promise<void> {
		const next = (host ?? "").trim();
		if (next === this.host) {
			return;
		}

		await this.teardown();
		this.host = next;
		this.emit("change");

		if (!isValidHost(next)) {
			return;
		}

		const atem = this.createAtem();
		this.atem = atem;

		atem.on("connected", () => {
			if (this.atem !== atem) return;
			this.connected = true;
			this.emit("change");
		});
		atem.on("disconnected", () => {
			if (this.atem !== atem) return;
			this.connected = false;
			this.emit("change");
		});
		atem.on("stateChanged", () => {
			if (this.atem !== atem) return;
			this.emit("change");
		});
		atem.on("error", (err) => this.emit("log", `ATEM error: ${err}`));

		// The library keeps retrying by itself, so a switcher that is powered on later still gets picked up.
		atem.connect(next).catch((err) => this.emit("log", `ATEM connect failed: ${err}`));

		// Record and stream clocks are only sent when asked for, so ask once a second while they run.
		this.timecodeTimer = setInterval(() => this.pollTimecode(), 1000);
		this.timecodeTimer.unref?.();
	}

	/** Closes the connection. */
	public async teardown(): Promise<void> {
		clearInterval(this.timecodeTimer);
		this.timecodeTimer = undefined;

		const atem = this.atem;
		this.atem = undefined;
		this.connected = false;
		if (atem) {
			atem.removeAllListeners();
			// Keep an error listener so a late socket error cannot crash the plugin.
			atem.on("error", () => undefined);
			await atem.destroy().catch(() => undefined);
		}
	}

	private pollTimecode(): void {
		const state = this.state;
		const atem = this.device;
		if (!state || !atem) return;

		if (state.recording?.status?.state === Enums.RecordingStatus.Recording) {
			atem.requestRecordingDuration().catch(() => undefined);
		}
		if (state.streaming?.status?.state === Enums.StreamingStatus.Streaming) {
			atem.requestStreamingDuration().catch(() => undefined);
		}
	}
}

/**
 * Loose check that the text looks like an IP address or a host name, so we do not try to dial half-typed input.
 */
export function isValidHost(host: string): boolean {
	if (!host) return false;
	const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
	if (ipv4) {
		return ipv4.slice(1).every((part) => Number(part) <= 255);
	}
	// Anything made only of digits and dots is a half-typed IP, not a host name.
	if (/^[\d.]+$/.test(host)) return false;
	return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(host);
}

/** The single hub shared by every action. */
export const hub = new AtemHub();
