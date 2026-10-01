// Dummy credentials so modules load offline. Tests never call Autodesk.
for (const k of ["APS_CLIENT_ID", "APS_CLIENT_SECRET", "SSA_ID", "SSA_KEY_ID", "SSA_KEY_PATH"]) process.env[k] ||= "test";
