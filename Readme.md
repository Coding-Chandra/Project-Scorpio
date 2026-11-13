# Notoz

Notoz is an offline-capable notes app built with vanilla HTML, CSS, and JavaScript. It runs as a progressive web app and as an Android app wrapped with Capacitor.

## Features

- Email and password sign-in and account creation through Supabase Auth.
- Notes with rich-text formatting, checklists, undo/redo, and blank, lined, or grid paper styles.
- Folders, search, pinning, sorting, and multi-select actions.
- Profile information, account statistics, and JSON data export.
- TXT and PDF export for notes.
- Light and dark themes, responsive layouts, and mobile-specific navigation.
- PWA installation and offline note editing with local storage and later synchronization.
- Capacitor Android integration for native app behavior.

## Images in notes

Newly added images are processed on the device: JPEG metadata is stripped, large dimensions are reduced to a maximum of 2400 pixels, and images are encoded as WebP when supported (otherwise PNG). The raw input limit is 5 MB.

Images are embedded as base64 data URLs in note content. Notes are encrypted client-side before being written to the remote notes table, so new images are not uploaded to the public `notoz-images` bucket. Embedding images increases note size and can make synchronization slower.

Notes created while image uploads used Supabase Storage may still contain public image URLs. This change does not migrate those images or delete their bucket objects. Migrate or remove those old objects and disable public bucket access separately if they should no longer be reachable.

## Security and data handling

- Note titles and content are encrypted client-side with AES-GCM before remote synchronization.
- Password-derived key material uses PBKDF2-SHA-256; current key records use a per-user salt and 600,000 iterations. Legacy records are upgraded after successful sign-in.
- The active session key is stored as a non-extractable `CryptoKey` in IndexedDB. Offline note data is also stored on the device; keep devices protected.
- Supabase Auth, database access, and Row Level Security policies must be configured for the tables used by the app (`notes`, `folders`, `profiles`, and `user_keys`).
- The browser app must use only a public/publishable Supabase key. Never put a service-role key in client-side code.

## Project layout

```text
Scorpio-native/
├── index.html                 # Login and account creation
├── src/
│   ├── css/                   # Login styles
│   └── js/                    # Login and authentication logic
├── app/
│   ├── index.html             # Notes app
│   ├── settings.html          # App settings
│   └── src/
│       ├── assets/            # Fonts, icons, and wallpapers
│       ├── css/               # App, editor, profile, and settings styles
│       ├── js/                # Notes, sync, profile, and UI logic
│       └── pages/             # About, privacy, terms, theme, and profile pages
├── vendor/                    # Locally bundled browser libraries
├── scripts/
│   └── copy-web.js            # Copies web sources to www/
├── android/                   # Capacitor Android project
├── www/                       # Generated Capacitor web directory
├── capacitor.config.json
└── package.json
```

Edit the root `src/` and `app/` files. The Capacitor `www/` directory is generated from them and should not be treated as the source of truth.

## Run the web app locally

1. Install XAMPP and place the repository in its `htdocs` directory.
2. Start Apache.
3. Open `http://localhost/Scorpio-native/`.

The app also requires a configured backend for authentication and remote synchronization. The Supabase URL and publishable key are currently configured as JavaScript constants in the app source; environment variables are not loaded by the current frontend.

## Build and run the Android app

Install Node.js and the project dependencies:

```powershell
npm install
```

Capacitor commands:

| Command | Purpose |
|---|---|
| `npm run copy-web` | Copy web source files into `www/` |
| `npm run cap:sync` | Copy web files and synchronize Capacitor Android plugins |
| `npm run cap:open` | Open the Android project in Android Studio |
| `npm run cap:run` | Build and run on a connected device or emulator |
| `npm run cap:build` | Build a debug APK |

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. See [CAPACITOR_ANDROID.md](./CAPACITOR_ANDROID.md) for Android-specific details.

## PWA and offline behavior

The web app uses a manifest and service worker for installation and asset caching. Notes can be edited while offline and synchronized when connectivity returns. Authentication and other server-backed actions require a connection.

## Development notes

- The project uses vanilla JavaScript; there is no frontend framework or configured test suite.
- `npm test` is currently a placeholder and does not run tests.
- Keep the public Supabase key restricted by suitable Row Level Security policies. Do not rely on an obscured URL as access control.
- New image attachments are stored inside encrypted note content, not in Supabase Storage. Existing Storage-based image links need separate migration and cleanup.

**Last updated:** November 2026
