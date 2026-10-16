"""CI emulator checks, including the real 0.2 export and a production release APK."""
import base64
import hashlib
import importlib.util
import json
import pathlib
import sqlite3
import subprocess
import tempfile
import urllib.request

PACKAGE = "com.domalega.daymark"
RUNNER = PACKAGE + ".test/androidx.test.runner.AndroidJUnitRunner"
CLASS = PACKAGE + ".LegacyMigrationTest"


def adb(*args, **kwargs):
    return subprocess.check_output(["adb", *args], **kwargs)


with tempfile.TemporaryDirectory() as temporary:
    folder = pathlib.Path(temporary)
    legacy = folder / "legacy.apk"
    urllib.request.urlretrieve("https://github.com/Domalega/diploma/releases/download/native-preview-0.2.0/Daymark-Android-0.2.0.apk", legacy)
    assert hashlib.sha256(legacy.read_bytes()).hexdigest() == "ded97a2ce1567b368f0c137a3ccc15314bde602ef5e1766a9d1fa64889be3586"
    adb("install", str(legacy))
    database = folder / "legacy.sqlite"
    with sqlite3.connect(database) as connection:
        connection.execute("CREATE TABLE accounts (owner TEXT PRIMARY KEY, document TEXT NOT NULL)")
        connection.execute("CREATE TABLE metadata (name TEXT PRIMARY KEY, value TEXT NOT NULL)")
        connection.execute("PRAGMA user_version=1")
        document = {"owner": "12345", "generation": 5, "syncRevision": 2, "history": {}, "base": {"todos": {"enabled": False}},
                    "state": {"todos": {"enabled": True}, "todo/migration": {"title": "Pending from 0.2", "completed": False}},
                    "credential": "encrypted-with-old-keystore", "webCredential": "must-not-be-exported"}
        connection.execute("INSERT INTO accounts VALUES (?, ?)", ("12345", json.dumps(document)))
    adb("shell", "run-as", PACKAGE, "mkdir", "-p", "databases")
    adb("shell", f"run-as {PACKAGE} sh -c 'cat > databases/daymark-offline.sqlite'", input=database.read_bytes())
    spec = importlib.util.spec_from_file_location("legacy_export", "scripts/android-export-legacy.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    backup = folder / "export.json"
    module.export(backup)
    payload = backup.read_bytes()
    assert b"credential" not in payload and b"webCredential" not in payload
    # Only the disposable CI emulator is reset here. The user-facing exporter never uninstalls.
    adb("uninstall", PACKAGE)
    adb("install", "apps/android/app/build/outputs/apk/release/app-release.apk")
    adb("install", "apps/android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk")
    sdk = int(adb("shell", "getprop", "ro.build.version.sdk", text=True).strip())
    if sdk >= 33:
        adb("shell", "pm", "grant", PACKAGE, "android.permission.POST_NOTIFICATIONS")
    if sdk >= 31:
        adb("shell", "appops", "set", PACKAGE, "SCHEDULE_EXACT_ALARM", "allow")
    output = adb("shell", "am", "instrument", "-w", "-e", "class", CLASS, "-e", "legacyBackup",
                 base64.b64encode(payload).decode(), RUNNER, text=True)
    print(output)
    if "OK (1 test)" not in output:
        raise RuntimeError("0.2 backup migration failed")

excluded = PACKAGE + ".UpgradeStateTest," + CLASS
output = adb("shell", "am", "instrument", "-w", "-e", "notClass", excluded, RUNNER, text=True)
print(output)
if "OK (" not in output or "FAILURES" in output:
    print(adb("shell", "dumpsys", "webviewupdate", text=True))
    print(adb("logcat", "-d", "-s", "chromium", "AndroidRuntime", text=True)[-12000:])
    raise RuntimeError("Native instrumentation tests failed")
