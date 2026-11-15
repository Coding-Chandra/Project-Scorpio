# 🦂 Project Scorpio — PWA & Native Notes App

[![Version](https://img.shields.io/badge/version-2.5.011-D71921.svg?style=flat-square)](package.json)
[![Platform](https://img.shields.io/badge/platform-Android%208.0+%20|%20PWA%20|%20Web-000000.svg?style=flat-square)](capacitor.config.json)
[![Encryption](https://img.shields.io/badge/encryption-AES--GCM%20256--bit-success.svg?style=flat-square)](#-security--encryption)
[![Display](https://img.shields.io/badge/display-120Hz%20%2F%20144Hz%20AMOLED-blueviolet.svg?style=flat-square)](#-native-android-capabilities)
[![Icons](https://img.shields.io/badge/icons-Material%20You%20%26%20Nothing%20OS-orange.svg?style=flat-square)](#-material-you--nothing-os-themed-icons)

**Project Scorpio** (brand name: **Notoz**) is a modern Progressive Web Application (PWA) and native Android hybrid application designed for speed, clarity, and offline-first usage. It delivers a minimalist yet powerful note-taking experience with rich editing tools, folder organization, biometric security, user profiles, and seamless cross-platform support.

[Features](#-features) • [Native & PWA Capabilities](#-native--pwa-capabilities) • [User Profile & Stats](#-user-profile--stats) • [Installation](#-installation--local-setup) • [Supabase Setup & RLS](#-supabase-setup) • [Tech Stack](#-tech-stack)

---

## ⚠️ Disclaimer

> [!IMPORTANT]
> **AI-Generated Code Notice**
> This project contains code generated or assisted by Artificial Intelligence in some capacity. While the logic has been reviewed and tested for performance and security, users should exercise standard due diligence when deploying or modifying the codebase for production environments.

---

## ✨ Features

### 🗂️ Organization & Navigation

* **Folder Management:** Create, rename, lock, and delete custom folders.
* **Global Search:** Find notes across all unlocked folders instantly.
* **Smart Lists:** View notes by active folder or a comprehensive "All Notes" view.
* **Pinning:** Keep critical notes at the top of your list.
* **Multi-Select:** Batch deletion and organization tools.

### 🔒 Locked Folder & Biometric Security

* **Biometric Authentication:** Native Android `BiometricPrompt` support for fingerprint and facial recognition via `@aparajita/capacitor-biometric-auth`.
* **Hardware-Backed PIN Fallback:** Configurable 4-digit or 6-digit PIN protected with per-user salt and PBKDF2 cryptographic hashing.
* **Complete Isolation:** Notes inside locked folders are hidden from global note search, recent lists, and previews until authenticated.

### ✍️ Advanced Editor

* **Rich Text Support:** Full `contenteditable` area with Bold, Italic, Underline, Strikethrough, and List support.
* **Interactive Checklists:** Insert and toggle task lists directly in your note body.
* **Media Integration:** Upload images or take photos directly into notes (max 5MB) using native Android camera permissions or gallery picker.
* **Typography:** Support for Title, Heading, Subheading, and Body text styles.
* **Paper Templates:** Toggle between **Blank**, **Lined**, or **Grid** backgrounds.
* **Undo/Redo:** Full history support with keyboard shortcuts (Ctrl+Z, Ctrl+Y).

### 🎨 Custom Selection Toolbar

An intuitive floating toolbar appears upon text selection:

* **Decorations:** Bold, Italic, Underline, and Strikethrough.
* **Highlighting:** Built-in text highlighting with soft yellow accent.
* **Color Palette:** Black, Blue (`#007aff`), Crimson Red (`#ff3b30`), and Gray (`#8e8e93`).
* **Copy/Paste:** Direct clipboard operations from toolbar.

### 📱 Native Android Experience

* **Cinematic Red "N" Launch Screen:** Custom boot animation featuring an Netflix-inspired folded "N" ribbon in brand crimson red (`#D71921`) with radiant backlight burst and smooth camera zoom-out, engineered specifically for Android native devices.
* **Material You & Nothing OS Icons:** Adaptive icon layers with full dynamic color support on Android 13+ (Material You), paired with high-contrast 66dp monochrome vectors tailored for Nothing OS.
* **Hierarchical System Back Navigation:** Hardware and gesture back actions intelligently step back through opened modals, bottom sheets, and settings sub-pages before closing the app.
* **120Hz/144Hz AMOLED Ready:** Edge-to-edge transparent system bars and pure black AMOLED backgrounds optimized for high-refresh-rate displays.

### 👤 User Profile & Authentication

* **Display Name Management:** Edit and update your profile name globally across the app.
* **Profile Page:** Dedicated profile settings page with user information display.
* **Email Display:** View your account email address.
* **Account Info:** See your User ID, account creation date, and last update timestamp.
* **Data Export:** Download all notes in JSON format (with client-decrypted content).

### 📊 Smart User Statistics

View personalized statistics on your profile page:

* **Total Notes:** Lifetime count of all your notes.
* **Notes This Month:** Count of notes created in the current month.
* **Monthly Streak:** Consecutive days with edits in the current month (resets monthly).
* **Oldest Note:** When you created your first note (smart date format).
* **Recently Edited:** Last time you made any edit (smart date format: "Today", "Yesterday", "2 weeks ago", etc.).

### 🎭 Avatar Generation

* **Automatic Avatars:** Beautiful gradient avatars generated from user initials.
* **Deterministic Colors:** Same user always gets the same color palette.
* **15 Color Palettes:** Vibrant, accessible color combinations.
* **No Storage:** Avatars generated on-the-fly, no file uploads needed.
* **Theme Aware:** Works seamlessly in light and dark mode.

### ⚙️ Settings & Customization

* **Theme Engine:** Switch between light, dark, and pure AMOLED black modes.
* **Wallpaper Engine:** Curated gallery of iOS and Nothing OS high-contrast wallpaper backdrops.
* **Settings Page:** Centralized settings with sub-page navigation.
* **Account Dropdown:** Quick access to profile, settings, and logout.

---

## 🚀 Native & PWA Capabilities

* **Capacitor 8.6 Native Bridge:** Deep integration with Android hardware APIs for biometric auth, tactile haptic feedback, status bar styling, and native camera capture.
* **Service Worker:** Manages intelligent asset caching (`notoj-app-v2.5.011`) and fetch requests.
* **Manifest Integration:** Fully installable on Android, iOS, and Desktop.
* **Native Feel:** Responsive design using dynamic `--vh` variables for mobile viewport accuracy and zero-latency IndexedDB local state.
* **Manual Update Control:** Users are notified of updates and can choose when to install.
* **Cache Management:** Automatic cleanup of old cache versions, keeping only active + latest.
* **Offline Support:** Full offline-first operation without internet connection (encrypted notes and folders cached locally in IndexedDB).

---

## 🔐 Security & Encryption

* **End-to-End Encryption:** Notes are encrypted using AES-GCM (256-bit) before leaving your local device.
* **Session Key Management:** Master key derived via PBKDF2 (upgraded to 600,000 iterations + personal salt) and stored as a non-extractable `CryptoKey` inside client-side IndexedDB.
* **Secure Export:** Downloaded notes are decrypted client-side in memory before export.
* **Row Level Security (RLS):** Supabase Row Level Security ensures users can only ever access, modify, or delete their own data.

---

## 🛠️ Tech Stack

* **Frontend:** HTML5, CSS3 (Glassmorphism UI, Material Design 3 Expressive, CSS Grid/Flexbox, AMOLED Black)
* **Logic:** Vanilla JavaScript (Zero heavy UI frameworks, maximum performance)
* **Mobile Runtime:** Capacitor 8.6 (Android BridgeActivity, BiometricPrompt, Status Bar, Haptics)
* **Backend:** Supabase (PostgreSQL 15+, GoTrue Auth, Storage, RLS)
* **Encryption:** Web Crypto API (SubtleCrypto AES-GCM 256-bit, PBKDF2)
* **Local Storage:** IndexedDB (Client offline-first note cache)
* **PWA:** Service Worker API, Web Manifest
* **Assets:** System fonts, custom vectorized icons, CSS animations

---

## 📂 Project Structure

```
Scorpio-native/
├── android/                         # Native Android Capacitor Project
│   ├── app/
│   │   ├── build.gradle             # Android build & version config (v2.5.011)
│   │   └── src/main/
│   │       ├── AndroidManifest.xml  # Permissions, biometrics, hardware acceleration
│   │       ├── java/.../            # Native BridgeActivity entry point
│   │       └── res/                 # Adaptive & Nothing OS monochrome icons
├── app/                             # Core Web Application
│   ├── index.html                   # Main note-taking workspace
│   ├── settings.html                # Settings, locked folders, and security
│   ├── hfr-demo.html                # High-refresh rate diagnostic tool
│   └── src/
│       ├── assets/                  # Icons, wallpapers, and splash drawables
│       ├── css/                     # MD3E, AMOLED black, and animations
│       ├── js/                      # App controller, crypto, settings, bridge
│       └── pages/                   # Profile, theme, wallpaper, legal sub-pages
├── capacitor.config.json            # Capacitor bridge runtime configuration
├── package.json                     # Project manifest and scripts
├── sw.js                            # Offline Service Worker (notoj-app-v2.5.011)
└── manifest.json                    # PWA installation manifest
```

---

## 💻 Installation / Local Setup

### Option 1: Web / PWA Local Setup

1. **Clone the Project:**
```bash
git clone https://github.com/Coding-Chandra/scorpio-cap.git
cd scorpio-cap
```

2. **Serve with Any Static Server:**
Using Node's built-in static server or Live Server:
```bash
npx serve .
# Or open in XAMPP htdocs: http://localhost/scorpio-cap
```

3. **Open in Browser:** Navigate to `http://localhost:3000` or `http://localhost/scorpio-cap/app/index.html`.

### Option 2: Android Native Setup

1. **Install Dependencies:**
```bash
npm install
```

2. **Sync Web Assets to Android:**
```bash
npm run copy-web
npx cap sync android
```

3. **Open in Android Studio or Build APK:**
```bash
# Open in Android Studio
npx cap open android

# Or build debug APK directly via command line
cd android
./gradlew assembleDebug
```
Built APK will be located at: `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 🔄 PWA Cache & Updates

### Updating the PWA Cache

To push updates to users, update the `CACHE_NAME` version string inside `sw.js`:

**Versioning Format:**
`notoj-app-vX.X.XX`

**Example:**
```javascript
// Inside sw.js
const CACHE_NAME = 'notoj-app-v2.5.011';
```

### Cache Management

* **Automatic Cleanup:** Only active and latest cache versions are kept; legacy versions are purged automatically.
* **Manual Updates:** Users see "Update Available" notification and click to update.
* **Session Refresh:** Update activates cleanly on the next app load.
* **Transparent Versioning:** Build number auto-syncs from `CACHE_NAME`.

---

## 🔐 Supabase Setup

### Database Schema (Production Ready)

To set up your database in Supabase (or any PostgreSQL instance), run the following SQL script in your **Supabase SQL Editor** or via migrations. The tables are ordered to satisfy all foreign key dependency constraints:

```sql
-- 1. Profiles Table (User metadata, display name, avatar configuration)
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  display_name text,
  email text,
  avatar_emoji text,
  avatar_mode text DEFAULT 'initials'::text CHECK (avatar_mode = ANY (ARRAY['initials'::text, 'emoji'::text])),
  avatar_gradient_index integer,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. Folders Table (Organizational folders and locked folder status)
CREATE TABLE public.folders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  name text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  is_locked boolean NOT NULL DEFAULT false,
  CONSTRAINT folders_pkey PRIMARY KEY (id),
  CONSTRAINT folders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 3. Notes Table (AES-GCM encrypted content and folder links)
CREATE TABLE public.notes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  title text NOT NULL DEFAULT 'New Note'::text,
  content text,
  pinned boolean NOT NULL DEFAULT false,
  paper_style text DEFAULT 'blank'::text,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  folder_id uuid,
  CONSTRAINT notes_pkey PRIMARY KEY (id),
  CONSTRAINT notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT notes_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.folders(id) ON DELETE SET NULL
);

-- 4. User Keys Table (Encrypted master keys and PBKDF2 salt)
CREATE TABLE public.user_keys (
  user_id uuid NOT NULL,
  encrypted_master_key text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  salt text,
  kdf_iterations integer NOT NULL DEFAULT 200000,
  CONSTRAINT user_keys_pkey PRIMARY KEY (user_id),
  CONSTRAINT user_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 5. Locked Folder Configuration Table (PIN length, salt, hash)
CREATE TABLE public.locked_folder_config (
  user_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  pin_length smallint NOT NULL CHECK (pin_length = ANY (ARRAY[4, 6])),
  pin_salt text NOT NULL,
  pin_hash text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT locked_folder_config_pkey PRIMARY KEY (user_id),
  CONSTRAINT locked_folder_config_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 6. Delete Requests Table (Account deletion tracking)
CREATE TABLE public.delete_requests (
  id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT delete_requests_pkey PRIMARY KEY (id),
  CONSTRAINT delete_requests_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);
```

---

### Row Level Security (RLS) Policies

Every single table in Notoz requires **Row Level Security (RLS)** enabled. This ensures that even though all users query the same PostgreSQL database, no user can read, insert, modify, or delete another user's notes, folders, keys, or profile data.

Execute the following SQL block to enable RLS and apply strict access policies:

```sql
-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locked_folder_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delete_requests ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policy (Users can only read and update their own profile)
CREATE POLICY "Users can manage own profile"
  ON public.profiles
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. Folders Policy (Users can only manage their own folders)
CREATE POLICY "Users can manage own folders"
  ON public.folders
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Notes Policy (Users can only manage their own notes)
CREATE POLICY "Users can manage own notes"
  ON public.notes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. User Keys Policy (Users can only access their own master key)
CREATE POLICY "Users can manage own user_keys"
  ON public.user_keys
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Locked Folder Config Policy (Users can only manage their own PIN config)
CREATE POLICY "Users can manage own locked_folder_config"
  ON public.locked_folder_config
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. Delete Requests Policy (Users can only submit deletion requests for themselves)
CREATE POLICY "Users can manage own delete_requests"
  ON public.delete_requests
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

---

### Running Locally or Hosting Your Own Database

If you wish to host your own database instead of using Supabase Cloud, you have two primary options:

#### Option A: Run Locally via Supabase CLI (Docker)

1. **Install Prerequisites:** Ensure [Docker Desktop](https://www.docker.com/) is installed and running.
2. **Install Supabase CLI:**
   ```bash
   npm install -g supabase
   ```
3. **Initialize & Start Local Stack:**
   ```bash
   cd scorpio-cap
   supabase init
   supabase start
   ```
   This will spin up a full local PostgreSQL database, Supabase Auth service, and Supabase Studio dashboard running at `http://localhost:54323`.
4. **Run the Schema:** Open `http://localhost:54323`, navigate to the **SQL Editor**, and paste the database schema and RLS policies above.
5. **Get Local API Keys:** Run `supabase status` to retrieve your local `API URL` (e.g. `http://localhost:54321`) and `anon key`.

#### Option B: Self-Host with Docker Compose on a VPS

1. Clone the official [Supabase Docker repository](https://github.com/supabase/supabase/tree/master/docker):
   ```bash
   git clone --depth 1 https://github.com/supabase/supabase
   cd supabase/docker
   cp .env.example .env
   docker compose up -d
   ```
2. Access your self-hosted Supabase Studio at port `8000`, open the SQL Editor, and execute the schema and RLS policies above.

#### Connecting Notoz to Your Local or Self-Hosted Instance

Update the connection constants in both `app/src/js/app.js` and `app/src/js/settings.js`:

```javascript
const SUPABASE_URL = 'http://localhost:54321'; // Or your self-hosted server URL
const SUPABASE_ANON_KEY = 'your_anon_public_key_here';
```

---

## 🚀 Deployment & Publishing

### Web / PWA Deployment

1. **Vercel / Netlify / Cloudflare Pages:**
   * Connect your GitHub repository.
   * Set root directory to `.` or `app`.
   * Deploy automatically on push.
2. **Traditional Web Hosting:**
   * Upload all files to your web server (Apache, Nginx, or Caddy).
   * Ensure HTTPS is enabled (mandatory for PWA Service Workers and Web Crypto API).
   * Configure CORS headers for your Supabase backend.

### Publishing Android App for Free ($0 Cost)

You do not need to pay the Google Play \$25 developer fee. You can distribute Notoz completely free with **\$0 registration costs**:

1. **IzzyOnDroid & F-Droid** ([apt.izzysoft.de](https://apt.izzysoft.de/)): 100% free open-source repository; automatically indexes APK releases directly from your GitHub Releases.
2. **GitHub Releases:** Tag a release (e.g., `v2.5.011`) and attach the compiled `app-debug.apk` directly for users to download.

---

## 📋 Features Checklist

### Notes
- [x] Create, read, update, delete notes
- [x] Rich text editing (Bold, Italic, Underline, Strikethrough)
- [x] Image attachments & native camera photo capture
- [x] Interactive task checklists
- [x] Undo/redo history
- [x] Search across notes
- [x] Paper style templates (Blank, Lined, Grid)

### Organization
- [x] Folders (Create, rename, delete)
- [x] Locked folders with biometric & PIN security
- [x] Pinning critical notes to top
- [x] Multi-select batch operations
- [x] Sorting by date and pinned status

### Native Android
- [x] Capacitor 8.6 Android bridge
- [x] Cinematic Red "N" splash screen with backlight burst & zoom-out
- [x] Material You dynamic colors & Nothing OS monochrome icons
- [x] Hierarchical system back gesture handling
- [x] BiometricPrompt fingerprint and facial recognition
- [x] High-refresh-rate 120Hz/144Hz AMOLED optimization

### User Features
- [x] User authentication (Supabase Auth)
- [x] Profile page with editable display name
- [x] User statistics and insights (streak, note count, edit times)
- [x] Avatar generation from initials
- [x] Data export with client-side decryption

### PWA
- [x] Service worker caching (`notoj-app-v2.5.011`)
- [x] Full offline support via IndexedDB
- [x] Manifest (installable on mobile and desktop)
- [x] Manual cache updates
- [x] Mobile responsive layout

### Security
- [x] End-to-end AES-GCM 256-bit encryption
- [x] PBKDF2 key derivation (600,000 iterations + personal salt)
- [x] Non-extractable CryptoKey storage in IndexedDB
- [x] Row-level security (RLS) on all 6 tables
- [x] Input validation & DOMPurify sanitization

---

## 🎯 Keyboard Shortcuts

| Action | Windows/Linux | Mac |
|---|---|---|
| Undo | `Ctrl + Z` | `Cmd + Z` |
| Redo | `Ctrl + Y` or `Ctrl + Shift + Z` | `Cmd + Y` or `Cmd + Shift + Z` |
| Bold | `Ctrl + B` | `Cmd + B` |
| Italic | `Ctrl + I` | `Cmd + I` |
| Underline | `Ctrl + U` | `Cmd + U` |
| New Note | `Ctrl + N` | `Cmd + N` |

---

## 📖 Documentation

* **Architecture:** Hybrid native/web architecture using Capacitor 8.6. IndexedDB serves as the primary local store; changes sync optimistically in the background to Supabase.
* **Splash Screen Preview:** In browser or PWA mode, append `?splash` to the URL (e.g., `http://localhost:3000/?splash`) to preview the Android-exclusive cinematic boot animation.
* **Locked Folder Logic:** Configured via `LF-Engine` (`app/src/js/locked-folder.js`). Unlocking triggers Android `BiometricPrompt` if biometric authentication is available; otherwise falls back to a 4-digit or 6-digit PIN pad.

---

## 🐛 Troubleshooting

### Notes not syncing?
- Check internet connection.
- Verify Supabase credentials in `app.js` and `settings.js`.
- Check browser console for errors.

### Why do I see `TypeError: Failed to fetch` in console when offline?
- This is standard Supabase JS SDK behavior when checking token freshness offline. Notoz catches the rejection, keeps you signed in, and serves cached notes from IndexedDB.

### PWA not installing?
- Ensure HTTPS is enabled (required for service workers).
- Check `manifest.json` is valid and linked in `index.html`.
- Clear browser cache and try again.

### Encryption errors?
- Verify master key is set in IndexedDB.
- Check Web Crypto API support in browser.
- Clear storage and re-authenticate.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

## 🙏 Credits

Built with ❤️ using Supabase, Web APIs, Capacitor, and modern PWA technologies.

**Last Updated:** February 2026

---

**Date Started:** 11/12/2025 (mm/dd/yyyy)
