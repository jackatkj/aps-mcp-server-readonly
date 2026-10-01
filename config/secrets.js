import path from "node:path";
import os from "node:os";
import dotenv from "dotenv";

const secretsPath = path.join(
    os.homedir(),
    ".aps-secrets",
    "aps-mcp.env"
);

dotenv.config({
    path: secretsPath,
    quiet: true
});

export function requireSecret(name) {
    const value = process.env[name];

    if (!value) {
        throw new Error(
            `Required APS configuration '${name}' is missing.`
        );
    }

    return value;
}