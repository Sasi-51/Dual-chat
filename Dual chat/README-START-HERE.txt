QUICKCHAT WEB + JAVA — CONTINUATION
===================================

THIS UPDATE
- Rebuilt the browser interface in HTML, CSS and vanilla JavaScript.
- Fixed malformed HTML and made the UI responsive on desktop and mobile.
- Added a shared event handler for desktop WebSocket and Android WebView Java bridge.
- Added paired-device list, connection status, disconnect, text messaging, file selection,
  transfer progress, received-file download and delivery status display.
- Added desktop disconnect action to the Java bridge.
- Added 8 KB browser-to-Java file streaming with ordered chunk validation and progress updates.
- Added matching Android WebView Java methods for FILE_INFO, FILE_CHUNK and FILE_END streaming.

PROJECT LAYOUT
- web/                 Browser UI (HTML/CSS/JavaScript)
- desktop-bridge/      Java 17 WebSocket + BlueCove RFCOMM bridge
- android-bridge/      Java Android BluetoothSocket/WebView bridge class
- original-source/     Original uploaded Android project, unchanged

RUN ON A PC
1. Install Java 17 and Maven.
2. Open a terminal in desktop-bridge.
3. Build: mvn package
4. Run the shaded JAR from desktop-bridge/target/ (check the generated jar name).
5. Open web/index.html in a modern browser.
6. Pair the two Bluetooth devices in the operating system Bluetooth settings.
7. On one endpoint press SERVER. On the other press PAIRED/SCAN and select the device.
8. Test a short text message before testing a small file.

ANDROID WEBVIEW
1. Create/open an Android Java project in Android Studio.
2. Copy android-bridge/src/main/java/com/quickchat/android/QuickChatAndroidBridge.java
   into your app package (adjust the package declaration if needed).
3. Put the web/ files under app/src/main/assets/quickchat/.
4. Create a WebView, enable JavaScript, load:
   webView.loadUrl("file:///android_asset/quickchat/index.html");
5. Inject the bridge:
   webView.addJavascriptInterface(new QuickChatAndroidBridge(this, webView), "QuickChat");
6. Add Bluetooth permissions to AndroidManifest.xml and implement runtime permission
   requests before calling paired/connect/server. Android 12+ needs BLUETOOTH_CONNECT and
   BLUETOOTH_SCAN; older versions use legacy Bluetooth permissions. Discovery may need
   location permission depending on Android version and target SDK.
7. The same web/app.js detects window.QuickChat and invokes the Android Java bridge.

PROTOCOL BASIS FROM THE UPLOADED SOURCE
- RFCOMM UUID: 8ce255c0-200a-11e0-ac64-0800200c9a66
- Packet: TYPE (1 byte), LENGTH (4-byte big-endian integer), PAYLOAD.
- 0x01 TEXT: UTF-8 bytes.
- 0x02 FILE_INFO: 8-byte big-endian file size followed by UTF-8 filename.
- 0x03 FILE_CHUNK: raw bytes, maximum 8192 bytes.
- 0x04 FILE_END: empty payload.
- 0x05 ACK: UTF-8 original message.

LIMITATIONS / HONEST TEST STATUS
- A normal browser cannot directly use Bluetooth Classic RFCOMM. PC uses the Java bridge;
  Android uses a Java BluetoothSocket bridge hosted by an Android WebView app.
- BlueCove's native Bluetooth support varies by operating system and Bluetooth stack;
  Windows 10/11 compatibility is not guaranteed by this source package.
- Android bridge requires an Android app host, manifest permissions, and runtime permission
  handling. It is not an APK by itself.
- Android scan button currently lists bonded devices; active discovery is not implemented.
- Browser-to-bridge uploads are streamed in 8 KB chunks and capped at 100 MB. The receiving
  side still buffers a complete incoming file in memory before offering it to the browser.
- Android received files are currently passed to the WebView as Base64; Android SAF persistent
  storage integration is not yet implemented.
- The original protocol does not provide a checksum in the inspected Kotlin implementation.
- This source has not been compiled or hardware-tested on your Bluetooth adapters. Verify
  build and two-device interoperability before treating it as production-ready.
