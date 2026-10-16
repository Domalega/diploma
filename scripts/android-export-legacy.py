"""Export Daymark 0.2 SQLite data before the one-time signing-key migration.

Requires Python 3 and adb (Android SDK platform-tools), USB debugging and an
unlocked/authorized phone. This script NEVER uninstalls or clears the app.
"""
import argparse
import io
import json
import pathlib
import sqlite3
import subprocess
import tarfile
import tempfile

PACKAGE = "com.domalega.daymark"
FIELDS = {"owner", "base", "state", "history", "generation", "syncRevision",
          "lastSync", "flight", "conflictRemote", "conflicts"}


def export(output, adb="adb"):
    subprocess.run([adb, "shell", "am", "force-stop", PACKAGE], check=True)
    archive = subprocess.check_output([adb, "exec-out", "run-as", PACKAGE,
                                       "tar", "-cf", "-", "databases"])
    with tempfile.TemporaryDirectory() as directory, tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
        for member in bundle.getmembers():
            name = pathlib.PurePosixPath(member.name)
            if name.parent == pathlib.PurePosixPath("databases") and name.name in {
                    "daymark-offline.sqlite", "daymark-offline.sqlite-wal", "daymark-offline.sqlite-shm"} and member.isfile():
                pathlib.Path(directory, name.name).write_bytes(bundle.extractfile(member).read())
        database = pathlib.Path(directory, "daymark-offline.sqlite")
        if not database.is_file():
            raise RuntimeError("The phone has no local Daymark database")
        with sqlite3.connect(database) as connection:
            accounts = []
            for (raw,) in connection.execute("SELECT document FROM accounts"):
                document = json.loads(raw)
                if "state" in document:
                    accounts.append({key: value for key, value in document.items() if key in FIELDS})
    if not accounts:
        raise RuntimeError("No downloaded accounts to export; the app has not been changed")
    payload = {"schema": 1, "source": "daymark-0.2", "accounts": accounts}
    # Exclusive creation protects an existing backup from accidental overwrite.
    with output.open("x", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")
    verified = json.loads(output.read_text(encoding="utf-8"))
    if verified != payload:
        raise RuntimeError("Backup verification failed; keep the old app installed")
    print(f"Saved and verified {len(accounts)} account(s): {output.resolve()}")
    print("Keep this file private. Copy it to the phone and restore it in Daymark 0.3 BEFORE signing in.")
    print("The old app is still installed. No data has been cleared.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=pathlib.Path, help="New backup JSON file")
    parser.add_argument("--adb", default="adb", help="Path to adb executable")
    arguments = parser.parse_args()
    export(arguments.output, arguments.adb)
