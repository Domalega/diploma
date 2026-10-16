"""CI only: confirm the real Android installer and verify the retained SQLite outbox."""
import re
import json
import pathlib
import subprocess
import time
import xml.etree.ElementTree as ET

PACKAGE = "com.domalega.daymark"
RUNNER = PACKAGE + ".test/androidx.test.runner.AndroidJUnitRunner"
expected = json.loads(pathlib.Path("apps/android/app/build/generated/upgradeFixture/future.json").read_text())["versionCode"]


def adb(*args):
    return subprocess.check_output(["adb", *args], text=True).strip()


def test(method):
    output = adb("shell", "am", "instrument", "-w", "-e", "class",
                 PACKAGE + ".UpgradeStateTest#" + method, RUNNER)
    print(output)
    if "OK (1 test)" not in output or "FAILURES" in output:
        raise RuntimeError("Upgrade test failed: " + method)


test("seed")
adb("shell", "appops", "set", PACKAGE, "REQUEST_INSTALL_PACKAGES", "allow")
installer = subprocess.Popen(["adb", "shell", "am", "instrument", "-w", "-e", "class",
                              PACKAGE + ".UpgradeStateTest#prepareInstaller", RUNNER],
                             stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
clicked = False
root = ET.Element("hierarchy")
for _ in range(20):
    time.sleep(1)
    if installer.poll() is not None:
        print(installer.communicate()[0])
        raise RuntimeError("Installer preparation exited before user confirmation")
    try:
        adb("shell", "uiautomator", "dump", "/sdcard/daymark-installer.xml")
        root = ET.fromstring(adb("shell", "cat", "/sdcard/daymark-installer.xml"))
    except (subprocess.CalledProcessError, ET.ParseError):
        # UIAutomator can briefly return no root while WebView/installer starts.
        continue
    for node in root.iter("node"):
        if node.get("text", "").lower() in {"install", "update"} and node.get("enabled") == "true":
            x1, y1, x2, y2 = map(int, re.findall(r"\d+", node.attrib["bounds"]))
            adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))
            clicked = True
            break
    if clicked:
        break
if not clicked:
    print("Visible UI:", [(node.get("text"), node.get("resource-id")) for node in root.iter("node") if node.get("text")])
    print(adb("logcat", "-d", "-s", "ActivityTaskManager", "PackageInstaller", "AndroidRuntime")[-8000:])
    installer.terminate()
    raise RuntimeError("System installer did not offer Install/Update")
for _ in range(30):
    if re.search(r"versionCode=" + str(expected) + r"\b", adb("shell", "dumpsys", "package", PACKAGE)):
        break
    time.sleep(1)
else:
    print(adb("logcat", "-d", "-s", "PackageInstaller", "PackageManager", "AndroidRuntime")[-8000:])
    installer.terminate()
    raise RuntimeError("System installer did not install the next version")
try:
    print(installer.communicate(timeout=10)[0])
except subprocess.TimeoutExpired:
    installer.terminate()
test("verifyRetained")
print(f"PASS: system installation -> {expected} retained SQLite changes, preferences and Keystore credentials")
