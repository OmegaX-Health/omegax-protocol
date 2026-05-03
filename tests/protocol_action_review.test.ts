import assert from "node:assert/strict";
import test from "node:test";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";

import protocolActionModule from "../frontend/lib/protocol-action.ts";

const {
  buildProtocolTransactionReview,
  executeProtocolTransaction,
} = protocolActionModule as typeof import("../frontend/lib/protocol-action.ts");

function createTransferTx() {
  const from = Keypair.generate().publicKey;
  const to = Keypair.generate().publicKey;
  return new Transaction({
    feePayer: from,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
  }).add(SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: 1 }));
}

test("transaction review records a successful fee estimate and simulation", async () => {
  const tx = createTransferTx();
  const review = await buildProtocolTransactionReview({
    connection: {
      rpcEndpoint: "https://rpc.test",
      getFeeForMessage: async () => ({ context: { slot: 1 }, value: 5000 }),
      simulateTransaction: async () => ({ value: { err: null, logs: ["ok"] } }),
    } as never,
    tx,
    label: "Review transfer",
    metadata: {
      authority: tx.feePayer?.toBase58(),
      feePayer: tx.feePayer?.toBase58(),
      affectedObject: "Test transfer",
      economicEffect: "Moves one lamport in a test transaction.",
    },
  });

  assert.equal(review.estimatedFeeLamports, 5000);
  assert.equal(review.simulation.ok, true);
  assert.deepEqual(review.simulation.logs, ["ok"]);
});

test("transaction review surfaces simulation errors before signing", async () => {
  const tx = createTransferTx();
  const review = await buildProtocolTransactionReview({
    connection: {
      rpcEndpoint: "https://rpc.test",
      getFeeForMessage: async () => ({ context: { slot: 1 }, value: 5000 }),
      simulateTransaction: async () => ({
        value: {
          err: { InstructionError: [0, "Custom"] },
          logs: ["failed"],
        },
      }),
    } as never,
    tx,
    label: "Broken transfer",
  });

  assert.equal(review.simulation.ok, false);
  assert.match(review.simulation.error ?? "", /Broken transfer simulation failed/);
  assert.deepEqual(review.simulation.logs, ["failed"]);
});

test("transaction review formats RPC failures while keeping review available", async () => {
  const tx = createTransferTx();
  const review = await buildProtocolTransactionReview({
    connection: {
      rpcEndpoint: "https://rpc.test",
      getFeeForMessage: async () => {
        throw new Error("429 too many requests retry-after: 2");
      },
      simulateTransaction: async () => ({ value: { err: null, logs: [] } }),
    } as never,
    tx,
    label: "Fee warning transfer",
  });

  assert.equal(review.estimatedFeeLamports, null);
  assert.match(review.warnings.join(" "), /rate-limiting/i);
});

test("executeProtocolTransaction returns the confirmed review explorer link", async () => {
  const tx = new Transaction({ feePayer: Keypair.generate().publicKey }).add(
    SystemProgram.transfer({
      fromPubkey: Keypair.generate().publicKey,
      toPubkey: Keypair.generate().publicKey,
      lamports: 1,
    }),
  );
  let sent = false;
  let reviewShown = false;
  const result = await executeProtocolTransaction({
    connection: {
      rpcEndpoint: "https://rpc.test",
      getLatestBlockhash: async () => ({
        blockhash: Keypair.generate().publicKey.toBase58(),
        lastValidBlockHeight: 123,
      }),
      getFeeForMessage: async () => ({ context: { slot: 1 }, value: 5000 }),
      simulateTransaction: async () => ({ value: { err: null, logs: ["ok"] } }),
      confirmTransaction: async () => ({ context: { slot: 2 }, value: { err: null } }),
    } as never,
    sendTransaction: async () => {
      sent = true;
      return "5EYqLmmG6rFZQ7kQK4s1Qk6S7NQjnNnsf7vYd1nEJtDN2ZJJv6i31mucPZQ9hkTgN7K1VwvHZQqjQkR3mR4z9m2v";
    },
    tx,
    label: "Confirm transfer",
    confirmReview: async (review) => {
      reviewShown = true;
      assert.equal(review.label, "Confirm transfer");
      return true;
    },
    review: {
      authority: tx.feePayer?.toBase58(),
      feePayer: tx.feePayer?.toBase58(),
      affectedObject: "Confirmed test transfer",
      economicEffect: "Confirms the shared review is attached to success results.",
    },
  });

  assert.equal(sent, true);
  assert.equal(reviewShown, true);
  assert.equal(result.ok, true);
  assert.match(result.ok ? result.review?.explorerUrl ?? "" : "", /explorer\.solana\.com\/tx/);
});

test("executeProtocolTransaction refuses reviewed transactions without a pre-sign confirmation", async () => {
  const tx = createTransferTx();
  let sent = false;
  const result = await executeProtocolTransaction({
    connection: {
      rpcEndpoint: "https://rpc.test",
      getLatestBlockhash: async () => ({
        blockhash: Keypair.generate().publicKey.toBase58(),
        lastValidBlockHeight: 123,
      }),
      getFeeForMessage: async () => ({ context: { slot: 1 }, value: 5000 }),
      simulateTransaction: async () => ({ value: { err: null, logs: ["ok"] } }),
      confirmTransaction: async () => ({ context: { slot: 2 }, value: { err: null } }),
    } as never,
    sendTransaction: async () => {
      sent = true;
      return "5EYqLmmG6rFZQ7kQK4s1Qk6S7NQjnNnsf7vYd1nEJtDN2ZJJv6i31mucPZQ9hkTgN7K1VwvHZQqjQkR3mR4z9m2v";
    },
    tx,
    label: "Unsigned reviewed transfer",
    review: {
      authority: tx.feePayer?.toBase58(),
      feePayer: tx.feePayer?.toBase58(),
      affectedObject: "Reviewed test transfer",
      economicEffect: "Must be shown before wallet signing.",
    },
  });

  assert.equal(sent, false);
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /pre-sign review/i);
});

test("executeProtocolTransaction refuses default transactions without a pre-sign confirmation", async () => {
  const tx = createTransferTx();
  let sent = false;
  const result = await executeProtocolTransaction({
    connection: {
      rpcEndpoint: "https://rpc.test",
      getLatestBlockhash: async () => ({
        blockhash: Keypair.generate().publicKey.toBase58(),
        lastValidBlockHeight: 123,
      }),
      getFeeForMessage: async () => ({ context: { slot: 1 }, value: 5000 }),
      simulateTransaction: async () => ({ value: { err: null, logs: ["ok"] } }),
      confirmTransaction: async () => ({ context: { slot: 2 }, value: { err: null } }),
    } as never,
    sendTransaction: async () => {
      sent = true;
      return "5EYqLmmG6rFZQ7kQK4s1Qk6S7NQjnNnsf7vYd1nEJtDN2ZJJv6i31mucPZQ9hkTgN7K1VwvHZQqjQkR3mR4z9m2v";
    },
    tx,
    label: "Unsigned default transfer",
  });

  assert.equal(sent, false);
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /pre-sign review/i);
});

test("executeProtocolTransaction permits explicit skipReview transactions", async () => {
  const tx = createTransferTx();
  let sent = false;
  const result = await executeProtocolTransaction({
    connection: {
      rpcEndpoint: "https://rpc.test",
      getLatestBlockhash: async () => ({
        blockhash: Keypair.generate().publicKey.toBase58(),
        lastValidBlockHeight: 123,
      }),
      getFeeForMessage: async () => ({ context: { slot: 1 }, value: 5000 }),
      simulateTransaction: async () => ({ value: { err: null, logs: ["ok"] } }),
      confirmTransaction: async () => ({ context: { slot: 2 }, value: { err: null } }),
    } as never,
    sendTransaction: async () => {
      sent = true;
      return "5EYqLmmG6rFZQ7kQK4s1Qk6S7NQjnNnsf7vYd1nEJtDN2ZJJv6i31mucPZQ9hkTgN7K1VwvHZQqjQkR3mR4z9m2v";
    },
    tx,
    label: "Explicit skip review transfer",
    skipReview: true,
  });

  assert.equal(sent, true);
  assert.equal(result.ok, true);
});

test("executeProtocolTransaction cancels before wallet signing when review is rejected", async () => {
  const tx = createTransferTx();
  let sent = false;
  const result = await executeProtocolTransaction({
    connection: {
      rpcEndpoint: "https://rpc.test",
      getLatestBlockhash: async () => ({
        blockhash: Keypair.generate().publicKey.toBase58(),
        lastValidBlockHeight: 123,
      }),
      getFeeForMessage: async () => ({ context: { slot: 1 }, value: 5000 }),
      simulateTransaction: async () => ({ value: { err: null, logs: ["ok"] } }),
      confirmTransaction: async () => ({ context: { slot: 2 }, value: { err: null } }),
    } as never,
    sendTransaction: async () => {
      sent = true;
      return "5EYqLmmG6rFZQ7kQK4s1Qk6S7NQjnNnsf7vYd1nEJtDN2ZJJv6i31mucPZQ9hkTgN7K1VwvHZQqjQkR3mR4z9m2v";
    },
    tx,
    label: "Cancelled transfer",
    confirmReview: async () => false,
    review: {
      authority: tx.feePayer?.toBase58(),
      feePayer: tx.feePayer?.toBase58(),
      affectedObject: "Cancelled test transfer",
      economicEffect: "Should not reach wallet signing.",
    },
  });

  assert.equal(sent, false);
  assert.equal(result.ok, false);
  assert.match(result.ok ? "" : result.error, /cancelled before wallet signing/i);
});
