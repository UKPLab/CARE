const fs = require("node:fs");
const path = require("node:path");
const {spawnSync} = require("node:child_process");

/**
 * Include the frontend's native Node suites in the existing make test/Jest entry point.
 * Discover files rather than maintaining a separate list of feature test names.
 */
test("frontend behavior suites pass", () => {
    const frontend = path.resolve(__dirname, "../../frontend");
    const directory = path.join(frontend, "tests");
    const files = fs.readdirSync(directory)
        .filter((name) => /\.test\.(?:js|mjs)$/.test(name))
        .sort()
        .map((name) => path.join(directory, name));
    expect(files.length).toBeGreaterThan(0);
    const result = spawnSync(process.execPath, ["--test", ...files], {
        cwd: frontend, encoding: "utf8", timeout: 60000,
    });
    if (result.error || result.status !== 0) {
        throw new Error(result.error?.message || `${result.stdout}\n${result.stderr}`);
    }
}, 65000);
