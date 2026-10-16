// Package a verified release APK and the manifest consumed by Android updates.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

const [source, destination] = process.argv.slice(2);
if (!source || !destination || !process.env.ANDROID_HOME) {
  throw new Error("Usage: ANDROID_HOME=... node scripts/package-android-update.cjs APK OUTPUT_DIR");
}
const tool = path.join(
  process.env.ANDROID_HOME,
  "build-tools",
  "35.0.0",
  process.platform === "win32" ? "aapt.exe" : "aapt",
);
const badging = execFileSync(tool, ["dump", "badging", source], { encoding: "utf8" });
const name = badging.match(/^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/m);
const minSdk = Number(badging.match(/^sdkVersion:'(\d+)'/m)?.[1]);
if (
  !name ||
  name[1] !== "com.domalega.daymark" ||
  !/^\d+\.\d+\.\d+$/.test(name[3]) ||
  minSdk !== 26 ||
  badging.includes("application-debuggable")
) {
  throw new Error("Expected the non-debuggable Daymark release APK for Android 8+");
}
const apk = fs.readFileSync(source);
const version = name[3],
  filename = `Daymark-Android-${version}.apk`;
const sha256 = crypto.createHash("sha256").update(apk).digest("hex");
const metadata = {
  schema: 1,
  channel: "preview",
  versionCode: Number(name[2]),
  versionName: version,
  minSdk,
  size: apk.length,
  sha256,
  url: `https://github.com/Domalega/diploma/releases/download/native-preview-${version}/${filename}`,
  notes:
    process.env.DAYMARK_UPDATE_NOTES ||
    "Update checks, notifications, and in-app installation of new versions.",
};
if (metadata.versionCode < 3 || apk.length > 150 * 1024 * 1024 || metadata.notes.length > 4000)
  throw new Error("Invalid release metadata");
fs.mkdirSync(destination, { recursive: true });
for (const [file, bytes] of [
  [filename, apk],
  ["android-update.json", Buffer.from(JSON.stringify(metadata, null, 2) + "\n")],
  ["SHA256SUMS.txt", Buffer.from(`${sha256}  ${filename}\n`)],
  ["android-export-legacy.py", fs.readFileSync(path.join(__dirname, "android-export-legacy.py"))],
]) {
  const target = path.join(destination, file);
  if (fs.existsSync(target) && !fs.readFileSync(target).equals(bytes))
    throw new Error("Refusing to replace a different packaged artifact: " + file);
  fs.writeFileSync(target, bytes);
}
console.log(JSON.stringify(metadata, null, 2));
