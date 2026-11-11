package app.notoz.android;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.Display;
import android.view.Surface;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {

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
                        lp.preferredMinDisplayRefreshRate = resolvedMaxRate;
                        lp.preferredMaxDisplayRefreshRate = resolvedMaxRate;
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
                        window.getDecorView().setFrameRate(finalMaxRate, Surface.FRAME_RATE_COMPATIBILITY_DEFAULT);
                        webView.setFrameRate(finalMaxRate, Surface.FRAME_RATE_COMPATIBILITY_DEFAULT);
                    } catch (Exception ignored) {}
                }

                // Native Downloads Bridge -> Saves to Downloads/Notoz
                webView.addJavascriptInterface(new NotozDownloadBridge(), "NotozNativeBridge");

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
    }

    public class NotozDownloadBridge {
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
    }
}
