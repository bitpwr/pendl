import { Pool, PoolConfig } from "pg";

const poolConfig: PoolConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  database: process.env.DB_NAME || "pendl",
  user: process.env.DB_USER || "pendl",
  password: process.env.DB_PASSWORD || "pendl",
  max: parseInt(process.env.DB_POOL_SIZE || "10", 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

declare global {
  var __pendlDbPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!globalThis.__pendlDbPool) {
    globalThis.__pendlDbPool = new Pool(poolConfig);

    // Log connection errors
    globalThis.__pendlDbPool.on("error", (err) => {
      console.error("Unexpected database pool error:", err);
    });
  }
  return globalThis.__pendlDbPool;
}

export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

export async function closePool(): Promise<void> {
  if (globalThis.__pendlDbPool) {
    await globalThis.__pendlDbPool.end();
    globalThis.__pendlDbPool = undefined;
  }
}
