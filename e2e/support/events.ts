// SPDX-License-Identifier: AGPL-3.0-or-later

import { PublicKey } from "@solana/web3.js";

import { eventDiscriminator, idlEvents, type IdlEvent, type IdlEventField } from "./surface.ts";

type DecodedEvent = {
  name: string;
  data: Record<string, bigint | boolean | number | string>;
};

class BufferCursor {
  #offset = 0;

  constructor(private readonly buffer: Buffer) {}

  readU8(): number {
    const value = this.buffer.readUInt8(this.#offset);
    this.#offset += 1;
    return value;
  }

  readBool(): boolean {
    return this.readU8() !== 0;
  }

  readU16(): number {
    const value = this.buffer.readUInt16LE(this.#offset);
    this.#offset += 2;
    return value;
  }

  readU64(): bigint {
    const value = this.buffer.readBigUInt64LE(this.#offset);
    this.#offset += 8;
    return value;
  }

  readI64(): bigint {
    const value = this.buffer.readBigInt64LE(this.#offset);
    this.#offset += 8;
    return value;
  }

  readBytes(size: number): Buffer {
    const value = this.buffer.subarray(this.#offset, this.#offset + size);
    this.#offset += size;
    return value;
  }
}

function decodeField(cursor: BufferCursor, field: IdlEventField) {
  if (field.type === "pubkey") {
    return new PublicKey(cursor.readBytes(32)).toBase58();
  }
  if (field.type === "bool") {
    return cursor.readBool();
  }
  if (field.type === "u8") {
    return cursor.readU8();
  }
  if (field.type === "u16") {
    return cursor.readU16();
  }
  if (field.type === "u64") {
    return cursor.readU64();
  }
  if (field.type === "i64") {
    return cursor.readI64();
  }
  if (typeof field.type === "object" && "array" in field.type) {
    const [kind, size] = field.type.array;
    if (kind === "u8" && size === 32) {
      return cursor.readBytes(32).toString("hex");
    }
  }
  throw new Error(`Unsupported event field type for ${field.name}: ${JSON.stringify(field.type)}`);
}

export function decodeAnchorEventsFromLogs(logs: string[] | null | undefined): DecodedEvent[] {
  if (!logs || logs.length === 0) {
    return [];
  }

  const eventIndex = new Map<string, IdlEvent>(
    idlEvents().map((event) => [
      (
        event.discriminator.length > 0
          ? Buffer.from(event.discriminator)
          : eventDiscriminator(event.name)
      ).toString("hex"),
      event,
    ]),
  );

  const decoded: DecodedEvent[] = [];
  for (const line of logs) {
    const match = /^Program data: (.+)$/.exec(line.trim());
    if (!match) {
      continue;
    }
    const payload = Buffer.from(match[1], "base64");
    if (payload.length < 8) {
      continue;
    }
    const discriminatorHex = payload.subarray(0, 8).toString("hex");
    const event = eventIndex.get(discriminatorHex);
    if (!event) {
      continue;
    }
    const cursor = new BufferCursor(payload.subarray(8));
    const data = Object.fromEntries(
      event.fields.map((field) => [field.name, decodeField(cursor, field)]),
    );
    decoded.push({ name: event.name, data });
  }
  return decoded;
}
