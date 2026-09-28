import { parentPort, workerData } from "node:worker_threads";
import pg from "pg";

const { Client } = pg;
const client = new Client({ connectionString: workerData.connectionString });
const connectPromise = client.connect();
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
let queue = Promise.resolve();

parentPort.on("message", (message) => {
  queue = queue.then(() => handleMessage(message)).catch(() => {});
});

async function handleMessage({ type, sql, params = [], sab }) {
  if (type === "shutdown") {
    await client.end().catch(() => {});
    return;
  }

  const control = new Int32Array(sab, 0, 2);
  try {
    await connectPromise;
    const result = await client.query({ text: sql, values: params });
    writeResponse(control, sab, {
      ok: true,
      rows: result.rows,
      rowCount: result.rowCount || 0,
    });
  } catch (error) {
    writeResponse(control, sab, {
      ok: false,
      error: {
        message: error?.message || "PostgreSQL query failed",
        code: error?.code || "POSTGRES_QUERY_FAILED",
      },
    });
  }
}

function writeResponse(control, sab, payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  if (bytes.byteLength > MAX_RESPONSE_BYTES - 8) {
    const fallback = new TextEncoder().encode(JSON.stringify({
      ok: false,
      error: { message: "PostgreSQL response is too large", code: "RESPONSE_TOO_LARGE" },
    }));
    new Uint8Array(sab, 8, fallback.byteLength).set(fallback);
    Atomics.store(control, 1, fallback.byteLength);
  } else {
    new Uint8Array(sab, 8, bytes.byteLength).set(bytes);
    Atomics.store(control, 1, bytes.byteLength);
  }
  Atomics.store(control, 0, 1);
  Atomics.notify(control, 0);
}
