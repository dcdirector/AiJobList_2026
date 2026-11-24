import streamDeck from "@elgato/streamdeck";

import { DownstreamKeyKey, OutputKey, UpstreamKeyKey } from "./actions/keyers";
import { AutoKey, CutKey, FadeToBlackKey, PreviewKey, ProgramKey, TransitionStyleKey } from "./actions/switching";
import { IsoKey, MacroKey, RecordKey, StreamKey } from "./actions/transport";
import { hub } from "./hub";

type GlobalSettings = { host?: string };

streamDeck.logger.setLevel("info");
hub.on("log", (message: string) => streamDeck.logger.warn(message));

let wasConnected = false;
hub.on("change", () => {
	if (hub.connected !== wasConnected) {
		wasConnected = hub.connected;
		streamDeck.logger.info(hub.connected ? `Connected to ATEM at ${hub.host}` : `Lost ATEM at ${hub.host}`);
	}
});

for (const key of [
	new ProgramKey(),
	new PreviewKey(),
	new CutKey(),
	new AutoKey(),
	new FadeToBlackKey(),
	new TransitionStyleKey(),
	new UpstreamKeyKey(),
	new DownstreamKeyKey(),
	new OutputKey(),
	new RecordKey(),
	new IsoKey(),
	new StreamKey(),
	new MacroKey(),
]) {
	streamDeck.actions.registerAction(key);
}

// The switcher's address is a plugin-wide setting: type it once and every button uses it.
streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((ev) => {
	void hub.setHost(ev.settings.host);
});

await streamDeck.connect();

const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
await hub.setHost(settings.host);
