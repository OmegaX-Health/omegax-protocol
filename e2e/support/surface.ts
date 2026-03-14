// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export type ProtocolContractInstruction = {
  name: string;
  discriminator: number[];
};

export type ProtocolContractSurface = {
  instructions: ProtocolContractInstruction[];
};

export type IdlEventField = {
  name: string;
  type: string | { array: [string, number] };
};

export type IdlEvent = {
  name: string;
  discriminator: number[];
  fields: IdlEventField[];
};

export type IdlError = {
  code: number;
  name: string;
  msg?: string;
};

export type IdlTypeDefinition = {
  name: string;
  type?: {
    kind?: string;
    fields?: IdlEventField[];
  };
};

export type ProtocolIdl = {
  events: Array<{
    name: string;
    discriminator?: number[];
  }>;
  errors: IdlError[];
  types?: IdlTypeDefinition[];
};

const contract = JSON.parse(
  readFileSync(new URL("../../shared/protocol_contract.json", import.meta.url), "utf8"),
) as ProtocolContractSurface;
const idl = JSON.parse(
  readFileSync(new URL("../../idl/omegax_protocol.json", import.meta.url), "utf8"),
) as ProtocolIdl;

function bytesToHex(bytes: Uint8Array | number[]): string {
  return Buffer.from(bytes).toString("hex");
}

export function instructionSurface(): ProtocolContractInstruction[] {
  return contract.instructions.map((instruction) => ({
    ...instruction,
    discriminator: [...instruction.discriminator],
  }));
}

export function instructionNameByDiscriminatorHex(): Map<string, string> {
  return new Map(
    instructionSurface().map((instruction) => [
      bytesToHex(instruction.discriminator),
      instruction.name,
    ]),
  );
}

export function idlEvents(): IdlEvent[] {
  const fieldsByTypeName = new Map(
    (idl.types ?? []).map((type) => [
      type.name,
      type.type?.kind === "struct" ? [...(type.type.fields ?? [])] : [],
    ]),
  );

  return idl.events.map((event) => ({
    name: event.name,
    discriminator: [...(event.discriminator ?? [])],
    fields: fieldsByTypeName.get(event.name) ?? [],
  }));
}

export function idlErrors(): IdlError[] {
  return idl.errors.map((error) => ({ ...error }));
}

export function eventDiscriminator(name: string): Buffer {
  return createHash("sha256").update(`event:${name}`).digest().subarray(0, 8);
}

export function hex(bytes: Uint8Array | number[]): string {
  return bytesToHex(bytes);
}
