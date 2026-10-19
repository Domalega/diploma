"""CI only: give the disposable Android 10 emulator a message-capable WebView.

The stock AOSP image ships WebView 74. The app requires WEB_MESSAGE_LISTENER,
so testing the real bundled UI needs a newer provider. Never run on a phone.
"""
import base64
import hashlib
import os
import pathlib
import subprocess
import tempfile
import time
import urllib.request


def adb(*args):
    return subprocess.check_output(["adb", *args], text=True).strip()


sdk = int(adb("shell", "getprop", "ro.build.version.sdk"))
if sdk != 29:
    print(adb("shell", "dumpsys", "webviewupdate"))
    raise SystemExit(0)
if adb("shell", "getprop", "ro.kernel.qemu") != "1":
    raise RuntimeError("WebView preparation is restricted to the disposable CI emulator")


def download(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return base64.b64decode(response.read(), validate=True)


revision = "27ac2bdb9a1a4e55dc65bb6cdc752dbfdea3b9f4"
source = "https://android.googlesource.com/platform/external/chromium-webview/+/"
apk = download(source + revision + "/128.0.6613.88/x86_64/webview.apk?format=TEXT")
if hashlib.sha256(apk).hexdigest() != "deb1987501d40c4c326697be8fdd7733abdf2e0ab7fb6e028205b0ff786876e5":
    raise RuntimeError("Pinned AOSP WebView checksum mismatch")
with tempfile.TemporaryDirectory() as temporary:
    folder = pathlib.Path(temporary)
    original, signed = folder / "original.apk", folder / "webview.apk"
    original.write_bytes(apk)
    # The emulator's system provider uses the public AOSP test certificate.
    # These are public test keys, unrelated to Daymark's permanent release key.
    keys = "https://android.googlesource.com/platform/build/+/refs/tags/android-10.0.0_r47/target/product/security/"
    for filename in ("testkey.pk8", "testkey.x509.pem"):
        (folder / filename).write_bytes(download(keys + filename + "?format=TEXT"))
    signer = pathlib.Path(os.environ["ANDROID_HOME"]) / "build-tools/35.0.0/apksigner"
    subprocess.check_call([str(signer), "sign", "--key", str(folder / "testkey.pk8"),
                           "--cert", str(folder / "testkey.x509.pem"), "--out", str(signed), str(original)])
    subprocess.check_call([str(signer), "verify", str(signed)])
    print(adb("install", "-r", str(signed)))
    print(adb("shell", "cmd", "webviewupdate", "set-webview-implementation", "com.android.webview"))
    deadline = time.monotonic() + 30
    while True:
        state = adb("shell", "dumpsys", "webviewupdate")
        if "Current WebView package (name, version): (com.android.webview, 128.0.6613.88)" in state:
            break
        if time.monotonic() >= deadline:
            print(state)
            raise RuntimeError("The emulator did not select the pinned WebView")
        time.sleep(0.5)
    print(state)
