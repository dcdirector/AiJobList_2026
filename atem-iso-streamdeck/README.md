# ISO Director for ATEM

A Stream Deck plugin that runs a Blackmagic ATEM Mini Pro ISO: switching with live red and green tally, transitions, keyers, the HDMI output, macros, streaming, and recording with ISO control.

Built by DC Director. Not affiliated with or endorsed by Blackmagic Design or Elgato.

> **Status: version 0.1.0, tested against a stand-in switcher, not yet on real hardware.**
> Every button passes an automated end-to-end test (see [How it was tested](#how-it-was-tested)).
> The first run on a real ATEM Mini Pro ISO is the last check, and it has not happened yet.

## Install

1. Double-click `release/com.dcdirector.atem-iso.streamDeckPlugin`. Stream Deck opens and asks to install it.
2. In Stream Deck, find **ISO Director for ATEM** in the action list on the right and drag any button onto a key.
3. Click that key. In the settings panel at the bottom, type your switcher's IP address into **ATEM IP address**.

You only type the address once. Every button shares it.

**Where to find the IP address:** open ATEM Software Control, click the gear, and look under the Switcher or Network settings. Your Mac and the ATEM must be on the same network (the ATEM's Ethernet port, not just USB).

Needs Stream Deck 7.1 or later, and macOS 12 or later. Windows 10 and up should work but is untested.

## The buttons

| Button | What it does | What it shows |
| --- | --- | --- |
| **Program** | Cuts a source straight to air | Red while that source is live |
| **Preview** | Lines a source up as next | Green while selected |
| **Cut** | Swaps preview and program instantly | |
| **Auto** | Runs the selected transition | Red while moving, plus the style name |
| **Fade to Black** | Fades program to black; press again to come back | Red while in black |
| **Transition Style** | Picks Mix, Dip, Wipe or DVE for Auto | Gold while that style is selected |
| **Upstream Key (PiP)** | Puts picture-in-picture or green screen on or off air | Red while on air |
| **Downstream Key** | Puts a logo or lower third on or off air | Red while on air |
| **HDMI Output** | Chooses what the HDMI out shows: multiview, program, a camera | Teal while that source is going out |
| **Record** | Starts and stops recording | Red with a running clock; disk time left when idle |
| **ISO Recording** | Records every camera as its own file | Gold when on; locks while recording |
| **Stream** | Starts and stops the live stream | Red with a running clock |
| **Macro** | Runs a macro saved on the switcher; press again to stop it | The macro's name; red while running |

### Two safety features worth knowing

- **Hold to stop.** Once you are recording or streaming, a tap does nothing. You hold the key for one full second to stop. A stray finger can't end your show. You can turn this off per key.
- **Honest keys.** If the switcher is off or the cable is out, every key goes grey and says `NO ATEM`. If no address is saved, it says `SET IP`. A key never shows tally it can't confirm. When the switcher comes back, the plugin reconnects by itself.

## How it works, in TV terms

There are three players:

1. **Stream Deck is the button panel.** It has no idea what an ATEM is. It only knows "key 3 was pressed" and "paint this picture on key 3."
2. **The plugin is the technical director.** It is a small program that Stream Deck runs in the background. It turns "key 3 was pressed" into "cut to camera 2."
3. **The ATEM is the switcher.** It listens on the network for commands and announces every change it makes.

The clever part is that the ATEM **announces** changes. The plugin never assumes a cut happened just because you pressed a key. It sends the request, the switcher does the cut, the switcher announces "camera 2 is now live," and only then does the key turn red. This is the same as real tally: the light comes from the switcher, not from the button. So if someone cuts from the ATEM's own buttons or from ATEM Software Control, your Stream Deck keys still follow along.

All the buttons share one connection to the switcher, like a party-line intercom. One announcement, and every key that cares repaints itself.

The record and stream clocks are the one thing the ATEM doesn't announce by itself, so the plugin asks for the time once a second while they run.

## Where things live

```
atem-iso-streamdeck/
├── README.md                          this file
├── release/                           the installer you double-click
├── src/                               the plugin's source code
│   ├── plugin.ts                      startup: registers buttons, connects to Stream Deck
│   ├── hub.ts                         the one shared connection to the switcher
│   ├── atem-key.ts                    behaviour every button shares (offline, hold-to-stop, repainting)
│   ├── render.ts                      draws the picture on each key
│   ├── sources.ts                     camera and source names
│   └── actions/                       the 13 buttons
│       ├── switching.ts               Program, Preview, Cut, Auto, FTB, Transition Style
│       ├── keyers.ts                  Upstream Key, Downstream Key, HDMI Output
│       └── transport.ts               Record, ISO, Stream, Macro
├── com.dcdirector.atem-iso.sdPlugin/  the plugin as Stream Deck sees it
│   ├── manifest.json                  the button list Stream Deck reads
│   ├── ui/                            the settings panels
│   └── imgs/                          icons
├── scripts/                           icon maker, stand-in switcher, end-to-end test
└── test/                              unit tests
```

## How it was tested

There was no switcher on hand when this was written, so the tests use stand-ins:

- **A stand-in Stream Deck** that starts the real, built plugin and presses keys.
- **A stand-in ATEM** (`scripts/fake-atem.mjs`) that speaks enough of the real ATEM network protocol to shake hands, send its state, and react to commands.

`npm run smoke` runs 24 checks through both, including: tally follows a cut, a quick tap does not stop a recording, a one second hold does, ISO locks while recording, keys go grey when the switcher loses power, and the plugin reconnects by itself when it comes back.

What the stand-in can't prove is how a real Mini Pro ISO behaves in every corner. The stand-in covers Program, Preview, Cut, Record and ISO. Auto, Fade to Black, the keyers, HDMI Output, Stream and Macro use the same tested plumbing but have only been checked against the library's documented commands, not exercised end to end.

### First run on real hardware: the checklist

1. Keys leave `NO ATEM` and show tally within a couple of seconds of saving the IP.
2. Cut on the ATEM's own buttons. Do the Stream Deck keys follow?
3. Program, Preview, Cut, Auto, Fade to Black.
4. PiP and DSK on and off.
5. HDMI Output: flip between multiview and program.
6. With a USB disk attached: ISO on, Record, check the clock runs, tap (should not stop), hold (should stop).
7. Stream key, only if you have a stream destination set up that is safe to test.
8. Pull the Ethernet cable. Keys should go grey within about five seconds, and recover when it is plugged back in.

## Working on the code

You need Node.js 20 or later.

```bash
npm install
```

```bash
npm run check
```

`npm run check` type-checks, runs the unit tests, builds, runs Elgato's validator, and runs the end-to-end test.

```bash
npm run pack
```

`npm run pack` rebuilds the installer in `release/`.

To develop live on a Mac with Stream Deck installed, link the plugin folder once and then use watch mode, which rebuilds and restarts the plugin on every save:

```bash
npx streamdeck link com.dcdirector.atem-iso.sdPlugin
```

```bash
npm run watch
```

## Not in this version

- Stream Deck + dials (T-bar, audio faders)
- Audio mixer controls
- SuperSource, media player stills, camera control, HyperDeck
- More than one switcher at a time

## Credits

- [atem-connection](https://github.com/Sofie-Automation/sofie-atem-connection) by the Sofie TV Automation team (MIT) does the talking to the switcher.
- [Stream Deck SDK](https://github.com/elgatosf/streamdeck) and [sdpi-components](https://sdpi-components.dev) by Elgato (MIT).

MIT licensed. See `LICENSE`.
