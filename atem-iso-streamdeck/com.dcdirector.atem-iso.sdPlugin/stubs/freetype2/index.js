// Stand-in for @julusian/freetype2.
//
// atem-connection uses the real library, a compiled add-on, for one thing only: drawing custom
// multiview label images. This plugin never does that, so the add-on is swapped for this stub.
// That keeps the plugin pure JavaScript, which means nothing for macOS to block and a much smaller download.
"use strict";

function unavailable() {
	throw new Error("Multiview label drawing is not included in this plugin.");
}

module.exports = { NewMemoryFace: unavailable, NewFace: unavailable };
