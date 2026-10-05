// The only module that talks to SQL. Executes generated SELECTs (and fixed metadata queries) only.
import sql from "mssql";
import { sqlSettings } from "./config.js";

let _pool = null;
let _runner = null; // test hook
export function setRunnerForTests(fn) { _runner = fn; }

async function pool() {
    if (_pool) return _pool;
    const s = sqlSettings();
    _pool = await new sql.ConnectionPool({
        server: s.server, database: s.database, requestTimeout: s.timeoutMs,
        // Entra ID sign-in (az login / VS Code / env credentials). No password is stored anywhere.
        authentication: { type: "azure-active-directory-default" },
        options: { encrypt: true, trustServerCertificate: false, readOnlyIntent: true }
    }).connect();
    return _pool;
}

export async function runSelect(statement, params = {}) {
    if (!/^SELECT\s/i.test(statement) || /;/.test(statement)) throw new Error("Blocked: only single SELECT statements are allowed.");
    if (_runner) return _runner(statement, params);
    const req = (await pool()).request();
    for (const [k, v] of Object.entries(params)) req.input(k, v);
    return (await req.query(statement)).recordset;
}
