"""CI only: confirm the real Android installer and verify the retained SQLite outbox."""
import re
import subprocess
import time
import xml.etree.ElementTree as ET

PACKAGE = "com.domalega.daymark"
RUNNER = PACKAGE + ".test/androidx.test.runner.AndroidJUnitRunner"


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
test("prepareInstaller")
clicked = False
for _ in range(15):
    time.sleep(1)
    adb("shell", "uiautomator", "dump", "/sdcard/daymark-installer.xml")
    root = ET.fromstring(adb("shell", "cat", "/sdcard/daymark-installer.xml"))
    for node in root.iter("node"):
        if node.get("text", "").lower() in {"install", "update"} and node.get("enabled") == "true":
            x1, y1, x2, y2 = map(int, re.findall(r"\d+", node.attrib["bounds"]))
            adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))
            clicked = True
            break
    if clicked:
        break
if not clicked:
    raise RuntimeError("System installer did not offer Install/Update")
for _ in range(30):
    if re.search(r"versionCode=4\b", adb("shell", "dumpsys", "package", PACKAGE)):
        break
    time.sleep(1)
else:
    raise RuntimeError("System installer did not install version 4")
test("verifyRetained")
print("PASS: system installation 3 -> 4 retained SQLite changes, preferences and Keystore credentials")
