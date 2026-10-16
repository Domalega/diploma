const fs = require("node:fs");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const config = Object.fromEntries(
  fs
    .readFileSync("apps/android/version.properties", "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split("=")),
);
const code = Number(config.versionCode) + 1;
const parts = config.versionName.split(".").map(Number);
parts[2]++;
const version = parts.join(".");
execFileSync(
  "gradle",
  [
    "-p",
    "apps/android",
    "assembleRelease",
    `-PdaymarkVersionCode=${code}`,
    `-PdaymarkVersionName=${version}`,
    "--no-daemon",
  ],
  { stdio: "inherit" },
);
const directory = "apps/android/app/build/generated/upgradeFixture";
fs.mkdirSync(directory, { recursive: true });
const apk = fs.readFileSync("apps/android/app/build/outputs/apk/release/app-release.apk");
fs.writeFileSync(directory + "/future.apk", apk);
fs.writeFileSync(
  directory + "/future.json",
  JSON.stringify({
    schema: 1,
    channel: "preview",
    versionCode: code,
    versionName: version,
    minSdk: 26,
    url: `https://github.com/Domalega/diploma/releases/download/native-preview-${version}/Daymark-Android-${version}.apk`,
    size: apk.length,
    sha256: crypto.createHash("sha256").update(apk).digest("hex"),
  }),
);
