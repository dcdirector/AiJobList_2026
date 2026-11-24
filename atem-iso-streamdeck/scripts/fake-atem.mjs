// A stand-in ATEM switcher for testing without hardware.
//
// It speaks just enough of the ATEM network protocol (UDP port 9910) to shake hands, send its
// starting state, and react to the handful of commands the tests press. It is a test double,
// not an emulator: real switchers send far more, and only real hardware is the final word.
import dgram from "node:dgram";

const FLAG_ACK_REQUEST = 0x01;
const FLAG_NEW_SESSION = 0x02;
const FLAG_ACK_REPLY = 0x10;
const SESSION = 0x8001;

/** Builds one command: 2 bytes length, 2 bytes padding, 4 letter name, then the payload. */
function command(name, payload = Buffer.alloc(0)) {
	const buf = Buffer.alloc(8 + payload.length);
	buf.writeUInt16BE(buf.length, 0);
	buf.write(name, 4, "ascii");
	payload.copy(buf, 8);
	return buf;
}

const u8 = (...bytes) => Buffer.from(bytes);

export class FakeAtem {
	program = 1;
	preview = 2;
	recording = false;
	iso = false;
	/** Names of every command received from the plugin, in order. */
	received = [];

	#socket;
	#client;
	#nextPacketId = 1;
	#keepAlive;

	async start(port = 9910, host = "127.0.0.1") {
		this.#socket = dgram.createSocket("udp4");
		this.#socket.on("message", (msg, rinfo) => this.#onPacket(msg, rinfo));
		await new Promise((resolve, reject) => {
			this.#socket.once("error", reject);
			this.#socket.bind(port, host, resolve);
		});
		// A real switcher pings constantly; the client drops the link after 5 quiet seconds.
		this.#keepAlive = setInterval(() => this.#client && this.#send([]), 400);
	}

	async stop() {
		clearInterval(this.#keepAlive);
		this.#client = undefined;
		await new Promise((resolve) => this.#socket.close(resolve));
	}

	#onPacket(msg, rinfo) {
		if (msg.length < 12) return;
		const flags = msg.readUInt8(0) >> 3;

		if (flags & FLAG_NEW_SESSION) {
			// Step 1 of the handshake: answer the hello. The client then acknowledges and we send our state.
			this.#client = rinfo;
			this.#nextPacketId = 1;
			const reply = Buffer.alloc(20);
			reply.writeUInt16BE((FLAG_NEW_SESSION << 11) | 20, 0);
			reply.writeUInt16BE(SESSION, 2);
			reply.writeUInt8(0x02, 12);
			this.#socket.send(reply, rinfo.port, rinfo.address);
			setTimeout(() => this.#sendInitialState(), 20);
			return;
		}

		if (flags & FLAG_ACK_REQUEST) {
			// Acknowledge, so the client does not keep resending.
			const ack = Buffer.alloc(12);
			ack.writeUInt16BE((FLAG_ACK_REPLY << 11) | 12, 0);
			ack.writeUInt16BE(SESSION, 2);
			ack.writeUInt16BE(msg.readUInt16BE(10), 4);
			this.#socket.send(ack, rinfo.port, rinfo.address);

			let rest = msg.subarray(12);
			while (rest.length >= 8) {
				const length = rest.readUInt16BE(0);
				if (length < 8 || length > rest.length) break;
				this.#onCommand(rest.toString("ascii", 4, 8), rest.subarray(8, length));
				rest = rest.subarray(length);
			}
		}
	}

	#onCommand(name, body) {
		this.received.push(name);
		switch (name) {
			case "CPgI":
				this.program = body.readUInt16BE(2);
				return this.#send([this.#programCmd()]);
			case "CPvI":
				this.preview = body.readUInt16BE(2);
				return this.#send([this.#previewCmd()]);
			case "DCut":
				[this.program, this.preview] = [this.preview, this.program];
				return this.#send([this.#programCmd(), this.#previewCmd()]);
			case "RcTM":
				this.recording = body.readUInt8(0) === 1;
				return this.#send([this.#recordStatusCmd()]);
			case "ISOi":
				this.iso = body.readUInt8(0) === 1;
				return this.#send([command("ISOi", u8(this.iso ? 1 : 0, 0, 0, 0))]);
			case "RMDR":
				// Recording clock: 0 hours, 0 minutes, 7 seconds.
				return this.#send([command("RTMR", u8(0, 0, 7, 0, 0, 0, 0, 0))]);
		}
	}

	#programCmd() {
		const b = Buffer.alloc(4);
		b.writeUInt16BE(this.program, 2);
		return command("PrgI", b);
	}

	#previewCmd() {
		const b = Buffer.alloc(8);
		b.writeUInt16BE(this.preview, 2);
		return command("PrvI", b);
	}

	#recordStatusCmd() {
		const b = Buffer.alloc(8);
		b.writeUInt16BE((this.recording ? 1 : 0) | 2, 0); // 2 = "no error"
		b.writeUInt32BE(7500, 4); // seconds of disk space left
		return command("RTMS", b);
	}

	#sendInitialState() {
		const version = Buffer.alloc(4);
		version.writeUInt32BE(131102, 0); // protocol 8.1.1, the first with recording and ISO

		// One mix effect bus, 14 sources, 1 downstream key, 1 output, 1 media player, 1 multiview.
		const topology = Buffer.alloc(28);
		topology.set([1, 14, 1, 1, 0, 1, 1]);

		const recordSettings = Buffer.alloc(140);
		recordSettings.write("Show", 0, "ascii");

		this.#send([command("_ver", version), command("_top", topology)]);
		this.#send([command("RMSu", recordSettings), this.#recordStatusCmd(), command("ISOi", u8(this.iso ? 1 : 0, 0, 0, 0))]);
		this.#send([this.#programCmd(), this.#previewCmd()]);
		this.#send([command("InCm", u8(1, 0, 0, 0))]);
	}

	#send(commands) {
		if (!this.#client) return;
		const body = Buffer.concat(commands);
		const packet = Buffer.alloc(12 + body.length);
		packet.writeUInt16BE((FLAG_ACK_REQUEST << 11) | packet.length, 0);
		packet.writeUInt16BE(SESSION, 2);
		packet.writeUInt16BE(this.#nextPacketId, 10);
		this.#nextPacketId = (this.#nextPacketId + 1) % 0x8000;
		body.copy(packet, 12);
		this.#socket.send(packet, this.#client.port, this.#client.address);
	}
}
