// Loads KJ standards from /standards. Edit the JSON, not the code.
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const dir = path.join(path.dirname(url.fileURLToPath(import.meta.url)), "standards");
const read = f => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
export const loadNaming = () => read("naming.json");
export const loadRequiredParams = () => { const { _readme, ...rest } = read("required-parameters.json"); return rest; };

// "(?i)" prefix is supported for readability; JS RegExp needs the flag instead.
const rx = s => s.startsWith("(?i)") ? new RegExp(s.slice(4), "i") : new RegExp(s);

/** Check one file name in a folder. status: pass | fail | no-rule */
export function checkName(fileName, folderName = "", naming = loadNaming()) {
    const rules = naming.rules.filter(r => !r.appliesTo || rx(r.appliesTo).test(folderName));
    if (!rules.length) return { status: "no-rule" };
    if (rules.some(r => rx(r.pattern).test(fileName))) return { status: "pass" };
    return { status: "fail", expected: rules.map(r => ({ rule: r.id, description: r.description, example: r.example })) };
}
