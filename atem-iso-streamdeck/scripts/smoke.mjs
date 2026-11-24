// End-to-end test with no hardware: boots the built plugin between a stand-in Stream Deck
// and a stand-in ATEM, presses keys, and checks what the switcher received and what the keys show.
// Run with: npm run smoke   (after npm run build)
import { spawn } from "node:child_process";
import { WebSocketServer } from "ws";

import { FakeAtem } from "./fake-atem.mjs";

const UUID = "com.dcdirector.atem-iso";
const RED = "#D8201A";
const GREEN = "#15903F";
const GOLD = "#E9B44C";

const results = [];
const check = (name, ok) => {
	results.push(ok);
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** Waits until the condition is true, giving up after the timeout. */
const until = async (condition, timeout = 4000) => {
	for (let waited = 0; waited < timeout; waited += 50) {
		if (condition()) return true;
		await wait(50);
	}
	return condition();
};

// ---- Stand-in Stream Deck app ----
const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
await new Promise((r) => server.once("listening", r));

const sent = [];
let socket;
let globalSettings = {};
server.on("connection", (ws) => {
	socket = ws;
	ws.on("message", (raw) => {
		const msg = JSON.parse(raw.toString());
		sent.push(msg);
		if (msg.event === "getGlobalSettings") {
			ws.send(JSON.stringify({ event: "didReceiveGlobalSettings", id: msg.id, payload: { settings: globalSettings } }));
		}
	});
});

const info = {
	application: { font: "Arial", language: "en", platform: "mac", platformVersion: "14.0", version: "7.1.0" },
	plugin: { uuid: UUID, version: "0.1.0.0" },
	devicePixelRatio: 2,
	colors: {},
	devices: [{ id: "dev1", name: "Stream Deck", size: { columns: 5, rows: 3 }, type: 0 }],
};
const plugin = spawn(
	process.execPath,
	["bin/plugin.js", "-port", String(server.address().port), "-pluginUUID", "smoke", "-registerEvent", "registerPlugin", "-info", JSON.stringify(info)],
	// Stream Deck starts a plugin from inside its own folder, so do the same.
	{ cwd: `${UUID}.sdPlugin`, stdio: ["ignore", "pipe", "pipe"] },
);
let stderr = "";
plugin.stderr.on("data", (d) => (stderr += d));
let exited = false;
plugin.on("exit", () => (exited = true));

const settingsByContext = {};
const keyEvent = (event, action, context) =>
	socket.send(
		JSON.stringify({
			event,
			action: `${UUID}.${action}`,
			context,
			device: "dev1",
			payload: {
				controller: "Keypad",
				coordinates: { column: 0, row: 0 },
				isInMultiAction: false,
				settings: settingsByContext[context] ?? {},
			},
		}),
	);
const appear = (action, context, settings = {}) => {
	settingsByContext[context] = settings;
	keyEvent("willAppear", action, context);
};
const tap = async (action, context) => {
	keyEvent("keyDown", action, context);
	await wait(80);
	keyEvent("keyUp", action, context);
};
/** The picture currently on a key, as SVG text. */
const face = (context) =>
	decodeURIComponent(sent.filter((m) => m.event === "setImage" && m.context === context).at(-1)?.payload.image ?? "");
const count = (event, context) => sent.filter((m) => m.event === event && m.context === context).length;

const finish = async (fake) => {
	if (stderr.trim()) console.log(`plugin stderr:\n${stderr}`);
	plugin.kill();
	server.close();
	await fake?.stop().catch(() => undefined);
	const failed = results.filter((ok) => !ok).length;
	console.log(failed ? `\n${failed} check(s) failed` : `\nAll ${results.length} checks passed`);
	process.exit(failed ? 1 : 0);
};

// ---- 1. Startup, before any switcher address is saved ----
console.log("Startup");
await until(() => sent.some((m) => m.event === "getGlobalSettings") || exited, 10000);
if (!socket) {
	check("plugin connects to Stream Deck", false);
	await finish();
}
check("plugin registers with Stream Deck", sent.some((m) => m.event === "registerPlugin"));

appear("program", "pgm1", { source: "1" });
appear("program", "pgm2", { source: "2" });
appear("preview", "pvw2", { source: "2" });
appear("cut", "cut");
appear("record", "rec");
appear("iso", "iso");
await until(() => face("pgm1").includes("SET IP"));
check("with no address saved, keys say SET IP", face("pgm1").includes("SET IP") && face("rec").includes("SET IP"));

// ---- 2. Address saved, switcher not answering yet ----
console.log("\nSwitcher offline");
globalSettings = { host: "127.0.0.1" };
socket.send(JSON.stringify({ event: "didReceiveGlobalSettings", payload: { settings: globalSettings } }));
await until(() => face("pgm1").includes("NO ATEM"));
check("keys say NO ATEM until the switcher answers", face("pgm1").includes("NO ATEM"));
await tap("program", "pgm2");
await until(() => count("showAlert", "pgm2") > 0);
check("pressing a key while offline flashes the alert", count("showAlert", "pgm2") === 1);

// ---- 3. Switcher powers on ----
console.log("\nSwitcher online");
let fake = new FakeAtem();
await fake.start();
await until(() => face("pgm1").includes(RED), 8000);
check("plugin finds the switcher by itself once it powers on", face("pgm1").includes(RED));
check("camera on program is red, the other is not", face("pgm1").includes(RED) && !face("pgm2").includes(RED));
check("camera on preview is green", face("pvw2").includes(GREEN));

await tap("program", "pgm2");
await until(() => face("pgm2").includes(RED));
check("Program key sends the cut to the switcher", fake.program === 2 && fake.received.includes("CPgI"));
check("tally follows: camera 2 red, camera 1 clear", face("pgm2").includes(RED) && !face("pgm1").includes(RED));
check("preview key stays green while selected, like a real panel", face("pvw2").includes(GREEN));

fake.preview = 1;
await tap("cut", "cut");
await until(() => fake.received.includes("DCut") && face("pgm1").includes(RED));
check("Cut key swaps program and preview", fake.program === 1 && fake.preview === 2 && face("pgm1").includes(RED));

// ---- 4. ISO and recording ----
console.log("\nRecording");
check("ISO key starts as program only", face("iso").includes("PGM ONLY"));
await tap("iso", "iso");
await until(() => face("iso").includes("ALL CAMS"));
check("ISO key turns ISO recording on", fake.iso === true && face("iso").includes("ALL CAMS") && face("iso").includes(GOLD));

check("Record key shows disk time left when idle", face("rec").includes("2h 05m"));
await tap("record", "rec");
await until(() => face("rec").includes(RED) && face("rec").includes("0:07"));
check("Record key starts recording", fake.recording === true);
check("Record key turns red with a running clock", face("rec").includes(RED) && face("rec").includes("0:07"));
check("Record key warns that stopping needs a hold", face("rec").includes("HOLD = STOP"));

const alertsBefore = count("showAlert", "iso");
await tap("iso", "iso");
await until(() => count("showAlert", "iso") > alertsBefore);
check("ISO key is locked while recording", fake.iso === true && count("showAlert", "iso") > alertsBefore && face("iso").includes("LOCKED"));

await tap("record", "rec");
await wait(1300);
check("a quick tap does NOT stop the recording", fake.recording === true);

keyEvent("keyDown", "record", "rec");
await wait(1250);
keyEvent("keyUp", "record", "rec");
await until(() => fake.recording === false);
check("holding for one second stops the recording", fake.recording === false);
await until(() => count("showOk", "rec") > 0 && !face("rec").includes(RED));
check("key confirms the stop and clears", count("showOk", "rec") === 1 && !face("rec").includes(RED));

// ---- 5. Switcher loses power mid-show, then comes back ----
console.log("\nPower loss and recovery");
await fake.stop();
await until(() => face("pgm1").includes("NO ATEM"), 9000);
check("keys go to NO ATEM when the switcher drops", face("pgm1").includes("NO ATEM") && face("rec").includes("NO ATEM"));

fake = new FakeAtem();
fake.program = 2;
fake.preview = 1;
await fake.start();
await until(() => face("pgm2").includes(RED), 12000);
check("plugin reconnects by itself and shows the new tally", face("pgm2").includes(RED) && !face("pgm1").includes(RED));
check("plugin never crashed", !exited);

await finish(fake);
