// SQL connection settings. Secrets/ids come from ~/.aps-secrets/sql-mcp.env (outside the repo), never from git.
import path from "node:path";
import os from "node:os";
import dotenv from "dotenv";

dotenv.config({ path: path.join(os.homedir(), ".aps-secrets", "sql-mcp.env"), quiet: true });

export function sqlSettings() {
    const { SQL_SERVER, SQL_DATABASE } = process.env;
    if (!SQL_SERVER || !SQL_DATABASE) {
        throw new Error("Set SQL_SERVER and SQL_DATABASE in ~/.aps-secrets/sql-mcp.env");
    }
    return { server: SQL_SERVER, database: SQL_DATABASE, timeoutMs: Number(process.env.SQL_TIMEOUT_MS || 15000) };
}
