package app.notoz.android;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.view.Display;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;

public class MainActivity extends BridgeActivity {

    private static final int REQUEST_RECORD_AUDIO_PERMISSION = 712;
    private String pendingSharedDataJson = null;
    private SpeechRecognizer speechRecognizer = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();

        // ── 1. True Edge-to-Edge: Draw behind Status Bar & Navigation Bar ──
        WindowCompat.setDecorFitsSystemWindows(window, false);

        window.clearFlags(
            WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS |
            WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION
        );
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);

        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);

        // Disable Android 10+ (API 29+) contrast scrim so navbar is 100% transparent
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setNavigationBarContrastEnforced(false);
            window.setStatusBarContrastEnforced(false);
        }

        // Allow drawing into cutout / notch / punch-hole area
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(lp);
        }

        // ── 2. 120Hz to 144Hz High-Refresh-Rate Display Mode Negotiation ──
        float resolvedMaxRate = 60.0f;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Display display = getWindowManager().getDefaultDisplay();
                Display.Mode[] modes = display.getSupportedModes();
                Display.Mode maxMode = null;
                for (Display.Mode mode : modes) {
                    if (mode.getRefreshRate() > resolvedMaxRate) {
                        resolvedMaxRate = mode.getRefreshRate();
                        maxMode = mode;
                    }
                }
                if (maxMode != null) {
                    WindowManager.LayoutParams lp = window.getAttributes();
                    lp.preferredDisplayModeId = maxMode.getModeId();
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        try {
                            java.lang.reflect.Field minField = WindowManager.LayoutParams.class.getField("preferredMinDisplayRefreshRate");
                            java.lang.reflect.Field maxField = WindowManager.LayoutParams.class.getField("preferredMaxDisplayRefreshRate");
                            minField.setFloat(lp, resolvedMaxRate);
                            maxField.setFloat(lp, resolvedMaxRate);
                        } catch (Throwable ignored) {}
                    }
                    window.setAttributes(lp);
                }
            } catch (Exception ignored) {}
        }

        final float finalMaxRate = resolvedMaxRate;

        // Apply WebView stability, refresh rate, and performance hardening
        if (getBridge() != null) {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                // Ensure WebView background is transparent so app wallpaper shines through edge-to-edge
                webView.setBackgroundColor(Color.TRANSPARENT);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R && finalMaxRate > 60.0f) {
                    try {
                        java.lang.reflect.Method setFrameRateMethod = View.class.getMethod("setFrameRate", float.class, int.class);
                        setFrameRateMethod.invoke(window.getDecorView(), finalMaxRate, 0);
                        setFrameRateMethod.invoke(webView, finalMaxRate, 0);
                    } catch (Throwable ignored) {}
                }

                // Native Feature Bridge: Downloads, Monet, Speech, Share, System UI
                webView.addJavascriptInterface(new NotozNativeBridge(), "NotozNativeBridge");
                webView.addJavascriptInterface(new NotozNativeBridge(), "AndroidSystemUI");

                WebSettings settings = webView.getSettings();

                // ── Performance ──
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setAllowFileAccess(true);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    settings.setOffscreenPreRaster(true);
                }
                settings.setGeolocationEnabled(false);

                try {
                    android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
                } catch (Exception ignored) {}

                // ── JavaScript ──
                settings.setJavaScriptEnabled(true);
                settings.setJavaScriptCanOpenWindowsAutomatically(false);

                // ── Rendering ──
                settings.setLoadWithOverviewMode(true);
                settings.setUseWideViewPort(true);
                settings.setSupportMultipleWindows(false);

                // ── Text / Encoding ──
                settings.setDefaultTextEncodingName("UTF-8");

                // ── Media ──
                settings.setMediaPlaybackRequiresUserGesture(false);

                // ── Mixed content: block (all HTTPS) ──
                settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

                // ── Safe browsing ──
                settings.setSafeBrowsingEnabled(true);

                // ── Prevent horizontal scroll bounce ──
                webView.setOverScrollMode(WebView.OVER_SCROLL_NEVER);

                // ── Hardware acceleration ──
                webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);
            }
        }

        // Process any initial share intent
        handleIncomingShareIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIncomingShareIntent(intent);
    }

    private void handleIncomingShareIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        String type = intent.getType();

        if (Intent.ACTION_SEND.equals(action) && type != null) {
            try {
                JSONObject payload = new JSONObject();
                payload.put("action", "share");
                payload.put("type", type);

                if (intent.hasExtra(Intent.EXTRA_SUBJECT)) {
                    payload.put("title", intent.getStringExtra(Intent.EXTRA_SUBJECT));
                } else if (intent.hasExtra(Intent.EXTRA_TITLE)) {
                    payload.put("title", intent.getStringExtra(Intent.EXTRA_TITLE));
                }

                if (type.startsWith("text/")) {
                    String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
                    payload.put("text", sharedText != null ? sharedText : "");
                } else if (type.startsWith("image/")) {
                    Uri imageUri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                    if (imageUri != null) {
                        JSONArray images = new JSONArray();
                        String base64Data = readUriAsBase64(imageUri);
                        if (base64Data != null) {
                            images.put(base64Data);
                        }
                        payload.put("images", images);
                    }
                    if (intent.hasExtra(Intent.EXTRA_TEXT)) {
                        payload.put("text", intent.getStringExtra(Intent.EXTRA_TEXT));
                    }
                }

                pendingSharedDataJson = payload.toString();
                dispatchPendingSharedData();
            } catch (Exception e) {
                e.printStackTrace();
            }
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action) && type != null && type.startsWith("image/")) {
            try {
                ArrayList<Uri> imageUris = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (imageUris != null && !imageUris.isEmpty()) {
                    JSONObject payload = new JSONObject();
                    payload.put("action", "share");
                    payload.put("type", type);
                    if (intent.hasExtra(Intent.EXTRA_TEXT)) {
                        payload.put("text", intent.getStringExtra(Intent.EXTRA_TEXT));
                    }
                    JSONArray images = new JSONArray();
                    for (Uri uri : imageUris) {
                        String b64 = readUriAsBase64(uri);
                        if (b64 != null) images.put(b64);
                    }
                    payload.put("images", images);
                    pendingSharedDataJson = payload.toString();
                    dispatchPendingSharedData();
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    private String readUriAsBase64(Uri uri) {
        try (InputStream is = getContentResolver().openInputStream(uri);
             ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            if (is == null) return null;
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) > 0) {
                baos.write(buf, 0, n);
            }
            String mime = getContentResolver().getType(uri);
            if (mime == null) mime = "image/png";
            String b64 = android.util.Base64.encodeToString(baos.toByteArray(), android.util.Base64.NO_WRAP);
            return "data:" + mime + ";base64," + b64;
        } catch (Exception e) {
            return null;
        }
    }

    private void dispatchPendingSharedData() {
        if (pendingSharedDataJson == null || getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            final String json = pendingSharedDataJson;
            runOnUiThread(() -> {
                webView.evaluateJavascript(
                    "(function(){" +
                    "  try { sessionStorage.setItem('notoz_pending_share', JSON.stringify(" + json + ")); } catch(e){}" +
                    "  if (typeof window.onNotozNativeShare === 'function') { window.onNotozNativeShare(" + json + "); }" +
                    "})();",
                    null
                );
            });
        }
    }

    private void startListening(String language) {
        if (speechRecognizer != null) {
            try {
                speechRecognizer.destroy();
            } catch (Exception ignored) {}
        }

        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this);
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        if (language != null && !language.trim().isEmpty()) {
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
        }

        speechRecognizer.setRecognitionListener(new RecognitionListener() {
            @Override
            public void onReadyForSpeech(Bundle params) {
                dispatchSpeechEvent("listening", "");
            }

            @Override
            public void onBeginningOfSpeech() {
                dispatchSpeechEvent("speaking", "");
            }

            @Override
            public void onRmsChanged(float rmsdB) {}

            @Override
            public void onBufferReceived(byte[] buffer) {}

            @Override
            public void onEndOfSpeech() {
                dispatchSpeechEvent("end", "");
            }

            @Override
            public void onError(int error) {
                dispatchSpeechEvent("error", String.valueOf(error));
            }

            @Override
            public void onResults(Bundle results) {
                ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) {
                    dispatchSpeechTranscription(matches.get(0), true);
                }
            }

            @Override
            public void onPartialResults(Bundle partialResults) {
                ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                if (matches != null && !matches.isEmpty()) {
                    dispatchSpeechTranscription(matches.get(0), false);
                }
            }

            @Override
            public void onEvent(int eventType, Bundle params) {}
        });

        speechRecognizer.startListening(intent);
    }

    private void stopListening() {
        if (speechRecognizer != null) {
            try {
                speechRecognizer.stopListening();
                speechRecognizer.destroy();
            } catch (Exception ignored) {}
            speechRecognizer = null;
        }
        dispatchSpeechEvent("stopped", "");
    }

    private void dispatchSpeechEvent(String event, String payload) {
        if (getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            runOnUiThread(() -> {
                webView.evaluateJavascript(
                    "if (window.onSpeechEvent) { window.onSpeechEvent('" + event + "', '" + payload + "'); }",
                    null
                );
            });
        }
    }

    private void dispatchSpeechTranscription(String text, boolean isFinal) {
        if (getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            try {
                JSONObject json = new JSONObject();
                json.put("text", text);
                json.put("isFinal", isFinal);
                final String jsonStr = json.toString();
                runOnUiThread(() -> {
                    webView.evaluateJavascript(
                        "if (window.onSpeechTranscription) { window.onSpeechTranscription(" + jsonStr + "); }",
                        null
                    );
                });
            } catch (Exception ignored) {}
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_RECORD_AUDIO_PERMISSION) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                startListening(null);
            } else {
                dispatchSpeechEvent("permission_denied", "");
            }
        }
    }

    @Override
    public void onDestroy() {
        if (speechRecognizer != null) {
            try {
                speechRecognizer.destroy();
            } catch (Exception ignored) {}
            speechRecognizer = null;
        }
        super.onDestroy();
    }

    public class NotozNativeBridge {
        // ── 0. System UI Bridge: Dynamic Status Bar & Navigation Bar Theming ──
        @JavascriptInterface
        public void setLightBars(boolean isLight) {
            runOnUiThread(() -> {
                try {
                    Window window = getWindow();
                    if (window != null) {
                        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
                        if (controller != null) {
                            controller.setAppearanceLightStatusBars(isLight);
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                controller.setAppearanceLightNavigationBars(isLight);
                            }
                        }
                    }
                } catch (Exception ignored) {}
            });
        }

        // ── 1. Downloads Bridge ──
        @JavascriptInterface
        public boolean saveNoteToDownloads(String filename, String content, String mimeType, boolean isBase64) {
            try {
                byte[] data;
                if (isBase64) {
                    data = android.util.Base64.decode(content, android.util.Base64.DEFAULT);
                } else {
                    data = content.getBytes(StandardCharsets.UTF_8);
                }

                String cleanFilename = (filename != null && !filename.trim().isEmpty()) ? filename.trim() : "Note.txt";
                String cleanMime = (mimeType != null && !mimeType.trim().isEmpty()) ? mimeType.trim() : "text/plain";

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    android.content.ContentValues values = new android.content.ContentValues();
                    values.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, cleanFilename);
                    values.put(android.provider.MediaStore.MediaColumns.MIME_TYPE, cleanMime);
                    values.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH, android.os.Environment.DIRECTORY_DOWNLOADS + "/Notoz");

                    android.net.Uri uri = getContentResolver().insert(android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                            if (os != null) {
                                os.write(data);
                                os.flush();
                            }
                        }
                    }
                } else {
                    File downloadDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS);
                    File notozDir = new File(downloadDir, "Notoz");
                    if (!notozDir.exists()) notozDir.mkdirs();
                    File file = new File(notozDir, cleanFilename);
                    try (FileOutputStream fos = new FileOutputStream(file)) {
                        fos.write(data);
                        fos.flush();
                    }
                    android.media.MediaScannerConnection.scanFile(MainActivity.this, new String[]{file.getAbsolutePath()}, null, null);
                }

                runOnUiThread(() -> {
                    Toast.makeText(MainActivity.this, "Saved to Downloads/Notoz/" + cleanFilename, Toast.LENGTH_LONG).show();
                });
                return true;
            } catch (Exception e) {
                runOnUiThread(() -> {
                    Toast.makeText(MainActivity.this, "Download failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
                });
                return false;
            }
        }

        // ── 2. Monet Dynamic Colors for MD3E (Android 12+ / API 31+) ──
        @JavascriptInterface
        public String getMonetColorsJson() {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    int idAccent500 = getResources().getIdentifier("system_accent1_500", "color", "android");
                    if (idAccent500 != 0) {
                        int accent1_500 = ContextCompat.getColor(MainActivity.this, idAccent500);
                        int r = (accent1_500 >> 16) & 0xFF;
                        int g = (accent1_500 >> 8) & 0xFF;
                        int b = accent1_500 & 0xFF;

                        JSONObject json = new JSONObject();
                        json.put("supported", true);
                        json.put("seedHex", String.format("#%02X%02X%02X", r, g, b));
                        json.put("r", r);
                        json.put("g", g);
                        json.put("b", b);
                        json.put("accent1_500", String.format("#%06X", (0xFFFFFF & accent1_500)));

                        int idAccent100 = getResources().getIdentifier("system_accent1_100", "color", "android");
                        if (idAccent100 != 0) {
                            json.put("accent1_100", String.format("#%06X", (0xFFFFFF & ContextCompat.getColor(MainActivity.this, idAccent100))));
                        }
                        int idAccent900 = getResources().getIdentifier("system_accent1_900", "color", "android");
                        if (idAccent900 != 0) {
                            json.put("accent1_900", String.format("#%06X", (0xFFFFFF & ContextCompat.getColor(MainActivity.this, idAccent900))));
                        }
                        return json.toString();
                    }
                }
            } catch (Exception ignored) {}
            return "{\"supported\":false}";
        }

        // ── 3. Speech-to-Text Dictation ──
        @JavascriptInterface
        public boolean isSpeechRecognitionAvailable() {
            return SpeechRecognizer.isRecognitionAvailable(MainActivity.this);
        }

        @JavascriptInterface
        public void startSpeechRecognition(String language) {
            runOnUiThread(() -> {
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.RECORD_AUDIO)
                        != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(
                        MainActivity.this,
                        new String[]{Manifest.permission.RECORD_AUDIO},
                        REQUEST_RECORD_AUDIO_PERMISSION
                    );
                    return;
                }
                MainActivity.this.startListening(language);
            });
        }

        @JavascriptInterface
        public void stopSpeechRecognition() {
            runOnUiThread(() -> MainActivity.this.stopListening());
        }

        // ── 4. Shared Intent Payload ──
        @JavascriptInterface
        public String getPendingSharedData() {
            String data = pendingSharedDataJson;
            pendingSharedDataJson = null;
            return data != null ? data : "";
        }
    }
}
