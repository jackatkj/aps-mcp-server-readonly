import { requireSecret } from "./config/secrets.js";

const APS_CLIENT_ID = requireSecret("APS_CLIENT_ID");
const APS_CLIENT_SECRET = requireSecret("APS_CLIENT_SECRET");
const SSA_ID = requireSecret("SSA_ID");
const SSA_KEY_ID = requireSecret("SSA_KEY_ID");
const SSA_KEY_PATH = requireSecret("SSA_KEY_PATH");

export {
    APS_CLIENT_ID,
    APS_CLIENT_SECRET,
    SSA_ID,
    SSA_KEY_ID,
    SSA_KEY_PATH
};