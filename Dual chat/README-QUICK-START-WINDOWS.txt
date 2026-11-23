QUICKCHAT - WINDOWS QUICK START
================================

IMPORTANT: There are TWO separate processes: the website and the Java Bluetooth bridge.
The website alone cannot access Bluetooth Classic RFCOMM.

A. START THE WEBSITE
1. Install Node.js LTS.
2. Double-click start-website.bat.
3. Open http://127.0.0.1:4173/ in Edge or Chrome.
4. Leave its CMD window open.

B. START THE JAVA RFCOMM BRIDGE (WINDOWS PC)
1. Install a 64-bit Java 17+ JDK and Apache Maven; add both to PATH.
2. Pair the PC and Android phone in Windows Bluetooth Settings first.
3. Double-click start-desktop-bridge.bat.
   It builds the Maven project and starts ws://127.0.0.1:8765.
4. Leave its CMD window open. Refresh the QuickChat browser tab.
5. For a two-way test, on one endpoint press SERVER. On the other endpoint,
   choose the paired device from the device list and connect.
6. Send a short text message in both directions before testing file transfer.

C. ANDROID ENDPOINT
The original-source/ directory is the supplied native Android application. Open
original-source/ in Android Studio, allow Gradle sync, build and install it on the
Android phone, and grant Bluetooth permissions. Pair it with the PC in Android
settings. The original app implements the same RFCOMM UUID and packet protocol.

The android-bridge/ folder is an optional Java WebView bridge class, NOT a complete
APK or Android Studio project on its own. It must be hosted in an Android Activity,
with JavaScript enabled in WebView and Android 12+ BLUETOOTH_CONNECT / BLUETOOTH_SCAN
runtime permissions requested by the Activity before Bluetooth calls.

D. TROUBLESHOOTING
- If browser says bridge unavailable: start the Java bridge, then refresh the page.
- If Maven is not recognized: install Apache Maven, add its bin folder to PATH, reopen CMD.
- If Bluetooth fails: pair devices in OS settings first; check Bluetooth is enabled.
- BlueCove's native RFCOMM support depends on the Windows Bluetooth stack/adapter and
  Java architecture. A successful Maven build does NOT prove hardware RFCOMM works.
- If port 4173 or 8765 is busy, close the other process or change the port consistently.

PROTOCOL
UUID: 8ce255c0-200a-11e0-ac64-0800200c9a66
Packet framing: 1-byte type + 4-byte big-endian payload length + payload
0x01 TEXT (UTF-8); 0x02 FILE_INFO (8-byte big-endian size + UTF-8 filename);
0x03 FILE_CHUNK (up to 8192 bytes); 0x04 FILE_END (empty); 0x05 ACK (UTF-8 text).

TEST STATUS
The source package and scripts are assembled, and the JavaScript syntax can be checked
with Node. This environment does not have Maven or a Bluetooth adapter, so the Java
bridge has NOT been built here and physical RFCOMM communication has NOT been verified.
Do not describe the project as hardware-tested until a message is successfully exchanged
between two paired physical devices.
