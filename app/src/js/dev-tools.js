(function () {
    "use strict";

    const DB_NAME = "notozApp";
    const views = new Map();
    let appVersion = "Unknown";

    function assertEnabled() {
        if (!window.isDeveloperOptionsEnabled?.()) {
            throw new Error("Enable Dev Tools to use this diagnostic.");
        }
    }

    function requestResult(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    function transactionResult(transaction) {
        return new Promise((resolve, reject) => {
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () =>
                reject(transaction.error || new Error("IndexedDB transaction aborted."));
        });
    }

    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            request.onblocked = () => reject(new Error("IndexedDB is blocked by another tab."));
        });
    }

    async function getCurrentUser() {
        if (typeof window.getDeveloperToolsUser !== "function") return null;
        return window.getDeveloperToolsUser();
    }

    async function getStorageEstimate() {
        try {
            return await navigator.storage?.estimate?.() || null;
        } catch {
            return null;
        }
    }

    async function readStorage(userId) {
        const database = await openDatabase();
        try {
            const names = ["notes", "syncQueue", "metadata"].filter((name) =>
                database.objectStoreNames.contains(name),
            );
            if (!names.length) {
                return { notes: [], queue: [], lastAttempt: null, lastSuccess: null };
            }

            const transaction = database.transaction(names, "readonly");
            const done = transactionResult(transaction);
            const notesRequest = names.includes("notes")
                ? requestResult(transaction.objectStore("notes").getAll())
                : Promise.resolve([]);
            const queueRequest = names.includes("syncQueue")
                ? requestResult(transaction.objectStore("syncQueue").getAll())
                : Promise.resolve([]);
            const attemptRequest = names.includes("metadata")
                ? requestResult(transaction.objectStore("metadata").get("lastSyncTime"))
                : Promise.resolve(null);
            const successRequest = names.includes("metadata")
                ? requestResult(transaction.objectStore("metadata").get("lastSyncSuccessAt"))
                : Promise.resolve(null);
            const [allNotes, allQueue, attempt, success] = await Promise.all([
                notesRequest,
                queueRequest,
                attemptRequest,
                successRequest,
                done,
            ]);

            return {
                notes: allNotes.filter((note) => note.user_id === userId),
                queue: allQueue.filter(
                    (item) => (item.user_id || item.data?.user_id) === userId,
                ),
                lastAttempt: attempt?.value || null,
                lastSuccess: success?.value || null,
            };
        } finally {
            database.close();
        }
    }

    async function clearSyncedCache(userId) {
        const database = await openDatabase();
        try {
            if (
                !database.objectStoreNames.contains("notes") ||
                !database.objectStoreNames.contains("syncQueue")
            ) {
                return 0;
            }

            const transaction = database.transaction(["notes", "syncQueue"], "readwrite");
            const done = transactionResult(transaction);
            const noteStore = transaction.objectStore("notes");
            const [notes, queue] = await Promise.all([
                requestResult(noteStore.index("user_id").getAll(userId)),
                requestResult(transaction.objectStore("syncQueue").getAll()),
            ]);
            const queuedIds = new Set(
                queue
                    .filter((item) => (item.user_id || item.data?.user_id) === userId)
                    .map((item) => item.noteId),
            );
            let removed = 0;
            for (const note of notes) {
                if (note.synced === true && note.offline !== true && !queuedIds.has(note.id)) {
                    noteStore.delete(note.id);
                    removed += 1;
                }
            }
            await done;
            return removed;
        } finally {
            database.close();
        }
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function button(label, action, className) {
        const node = element("button", className || "dev-log-button", label);
        node.type = "button";
        node.addEventListener("click", action);
        return node;
    }

    function metric(container, label, initialValue = "Checking…") {
        const row = element("div", "dev-tools-metric");
        row.append(
            element("span", "dev-tools-metric-label", label),
            element("strong", "dev-tools-metric-value", initialValue),
        );
        container.appendChild(row);
        return row.lastElementChild;
    }

    function card(target, title, description) {
        const panel = element("section", "settings-group dev-tools-card");
        panel.append(
            element("h2", "dev-tools-card-title", title),
            element("p", "dev-tools-card-description", description),
        );
        target.replaceChildren(panel);
        return panel;
    }

    function formatDate(value) {
        if (!value) return "Never";
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
    }

    function showError(error, status) {
        const message = error?.message || String(error);
        if (status) {
            status.textContent = message;
        } else {
            views.forEach((view) => {
                if (view.status) view.status.textContent = message;
                if (view.category === "environment") view.auth.textContent = "Check failed";
            });
        }
        console.error("[Dev Tools] Diagnostic failed:", error);
    }

    function createSyncPage(target) {
        const panel = card(target, "Sync diagnostics", "Inspect this account's pending sync work.");
        const metrics = element("div", "dev-tools-metrics");
        const connection = metric(metrics, "Connection");
        const queued = metric(metrics, "Queued operations");
        const failed = metric(metrics, "At retry limit");
        const pending = metric(metrics, "Unsynced notes");
        const lastAttempt = metric(metrics, "Last sync attempt");
        const lastSuccess = metric(metrics, "Last successful sync");
        const status = element("p", "developer-options-status");
        const actions = element("div", "dev-tools-actions");
        actions.append(
            button("Refresh diagnostics", () => refresh().catch((error) => showError(error, status))),
            button("Open app to retry sync", () => {
                window.location.href = "./index.html";
            }),
        );
        panel.append(metrics, status, actions);
        return { category: "sync", connection, queued, failed, pending, lastAttempt, lastSuccess, status };
    }

    function createStoragePage(target) {
        const panel = card(
            target,
            "Storage health",
            "This account's counts only. Cleanup removes synced local copies; queued or unsynced notes are preserved.",
        );
        const metrics = element("div", "dev-tools-metrics");
        const notes = metric(metrics, "Local notes");
        const pending = metric(metrics, "Pending local notes");
        const queue = metric(metrics, "Queued actions");
        const usage = metric(metrics, "Site storage usage");
        const status = element("p", "developer-options-status");
        const clearButton = button("Clear synced local cache", () => {
            if (typeof window.openModal !== "function") {
                showError(new Error("Confirmation dialog is unavailable."), status);
                return;
            }
            window.openModal(
                "Clear synced local cache?",
                "This removes only cloud-synced copies for the signed-in account. Unsynced notes and anything referenced by the sync queue are kept. You may need an internet connection to view the removed copies again.",
                "Clear cache",
                "var(--accent1)",
                async () => {
                    try {
                        assertEnabled();
                        const user = await getCurrentUser();
                        if (!user?.id) throw new Error("A signed-in account is required.");
                        const removed = await clearSyncedCache(user.id);
                        status.textContent = `Removed ${removed} synced local note${removed === 1 ? "" : "s"}.`;
                        await refresh();
                        window.closeCustomModal?.();
                    } catch (error) {
                        showError(error, status);
                    }
                },
            );
        });
        panel.append(
            metrics,
            status,
            button("Refresh storage status", () => refresh().catch((error) => showError(error, status))),
            clearButton,
        );
        return { category: "storage", notes, pending, queue, usage, status };
    }

    function createEnvironmentPage(target) {
        const panel = card(
            target,
            "Environment & connectivity",
            "Runtime details and authentication health. Account identifiers and note content are not shown.",
        );
        const metrics = element("div", "dev-tools-metrics");
        const version = metric(metrics, "App version", appVersion);
        const platform = metric(metrics, "Platform", navigator.platform || "Unknown");
        const browser = metric(metrics, "Browser", navigator.userAgent || "Unknown");
        const network = metric(metrics, "Network", navigator.onLine ? "Online" : "Offline");
        const auth = metric(metrics, "Authentication");
        const serviceWorker = metric(metrics, "Service worker");
        const status = element("p", "developer-options-status");
        panel.append(
            metrics,
            status,
            button("Refresh environment", () => refresh().catch((error) => showError(error, status))),
        );
        return {
            category: "environment",
            version,
            platform,
            browser,
            network,
            auth,
            serviceWorker,
            status,
        };
    }

    function createPerformancePage(target) {
        const panel = card(
            target,
            "Performance",
            "Show live frame-rate and VSync telemetry while using the app.",
        );
        const row = document.getElementById(
            target.id.startsWith("mobile-")
                ? "mobile-hfr-hud-entry"
                : "desktop-hfr-hud-entry",
        );
        if (row) {
            row.hidden = false;
            panel.appendChild(row);
        }
        return { category: "performance" };
    }

    function createExportPage(target) {
        const panel = card(
            target,
            "Diagnostic report",
            "Export environment, sync and storage status with recent logs. Review the report before sharing; log messages may contain sensitive text.",
        );
        const status = element("p", "developer-options-status");
        panel.append(
            status,
            button("Export diagnostic report", () => exportReport(status)),
        );
        return { category: "export", status };
    }

    function categoryFor(pageName) {
        return pageName.replace(/^(developer-|dev-)/, "");
    }

    function createView(pageName, target) {
        switch (categoryFor(pageName)) {
            case "sync":
                return createSyncPage(target);
            case "storage":
                return createStoragePage(target);
            case "environment":
                return createEnvironmentPage(target);
            case "performance":
                return createPerformancePage(target);
            case "export":
                return createExportPage(target);
            default:
                throw new Error(`Unknown Dev Tools page: ${pageName}`);
        }
    }

    async function getEnvironmentStatus() {
        let auth = "Unavailable";
        if (typeof window.checkDeveloperToolsAuth === "function") {
            auth = await window.checkDeveloperToolsAuth();
        }
        let serviceWorker = "Not supported";
        if ("serviceWorker" in navigator) {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                serviceWorker = !registration
                    ? "Not registered"
                    : navigator.serviceWorker.controller
                      ? "Registered & controlling"
                      : "Registered, not controlling";
            } catch {
                serviceWorker = "Check failed";
            }
        }
        return { auth, serviceWorker };
    }

    async function refresh() {
        assertEnabled();
        const user = await getCurrentUser();
        const storage = user?.id
            ? await readStorage(user.id)
            : { notes: [], queue: [], lastAttempt: null, lastSuccess: null };
        const [estimate, environment] = await Promise.all([
            getStorageEstimate(),
            getEnvironmentStatus(),
        ]);
        const pendingCount = storage.notes.filter(
            (note) => note.synced === false || note.offline === true,
        ).length;
        const failedCount = storage.queue.filter(
            (item) => (item.retries || 0) >= (item.maxRetries || 3),
        ).length;

        views.forEach((view) => {
            if (view.category === "sync") {
                view.connection.textContent = navigator.onLine ? "Online" : "Offline";
                view.queued.textContent = String(storage.queue.length);
                view.failed.textContent = String(failedCount);
                view.pending.textContent = String(pendingCount);
                view.lastAttempt.textContent = formatDate(storage.lastAttempt);
                view.lastSuccess.textContent = formatDate(storage.lastSuccess);
                view.status.textContent = user?.id ? "" : "Sign in to inspect this account's sync queue.";
            } else if (view.category === "storage") {
                view.notes.textContent = String(storage.notes.length);
                view.pending.textContent = String(pendingCount);
                view.queue.textContent = String(storage.queue.length);
                view.usage.textContent = estimate?.usage != null
                    ? `${(estimate.usage / 1024 / 1024).toFixed(1)} MB used`
                    : "Not available";
                view.status.textContent = user?.id ? "" : "Sign in to inspect this account's local notes.";
            } else if (view.category === "environment") {
                view.version.textContent = appVersion;
                view.platform.textContent = navigator.platform || "Unknown";
                view.browser.textContent = navigator.userAgent || "Unknown";
                view.network.textContent = navigator.onLine ? "Online" : "Offline";
                view.auth.textContent = environment.auth;
                view.serviceWorker.textContent = environment.serviceWorker;
                view.status.textContent = "";
            }
        });
    }

    function redactReportText(value) {
        return String(value)
            .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
            .replace(
                /((?:password|token|secret|authorization|api[_-]?key|master[_-]?key)\s*[:=]\s*)["']?[^,\s}"']+/gi,
                "$1[redacted]",
            );
    }

    async function exportReport(status) {
        try {
            assertEnabled();
            await refresh();
            const user = await getCurrentUser();
            const storage = user?.id
                ? await readStorage(user.id)
                : { notes: [], queue: [], lastAttempt: null, lastSuccess: null };
            const estimate = await getStorageEstimate();
            const report = {
                generatedAt: new Date().toISOString(),
                appVersion,
                environment: {
                    platform: navigator.platform || "Unknown",
                    userAgent: navigator.userAgent || "Unknown",
                    language: navigator.language || "Unknown",
                    online: navigator.onLine,
                    serviceWorkerSupported: "serviceWorker" in navigator,
                },
                sync: {
                    queuedOperations: storage.queue.length,
                    failedOperations: storage.queue.filter(
                        (item) => (item.retries || 0) >= (item.maxRetries || 3),
                    ).length,
                    unsyncedNotes: storage.notes.filter(
                        (note) => note.synced === false || note.offline === true,
                    ).length,
                    lastAttempt: storage.lastAttempt,
                    lastSuccess: storage.lastSuccess,
                },
                storage: {
                    localNotes: storage.notes.length,
                    estimatedBytes: estimate?.usage ?? null,
                    quotaBytes: estimate?.quota ?? null,
                },
                logs: (window.getDeveloperLogEntries?.() || []).slice(-100).map((entry) => ({
                    timestamp: entry.timestamp,
                    level: entry.level,
                    page: entry.page,
                    source: entry.source,
                    message: redactReportText(entry.message),
                })),
            };
            const blob = new Blob([JSON.stringify(report, null, 2)], {
                type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `notoz-diagnostic-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            if (status) status.textContent = "Diagnostic report exported.";
        } catch (error) {
            showError(error, status);
        }
    }

    async function loadVersion() {
        try {
            const response = await fetch("../version.json", { cache: "no-store" });
            if (!response.ok) throw new Error(`Version file returned HTTP ${response.status}`);
            const data = await response.json();
            appVersion = data.version || "Unknown";
        } catch (error) {
            console.warn("[Dev Tools] Could not read app version:", error);
        }
    }

    window.refreshDeveloperTools = function () {
        return refresh().catch((error) => {
            showError(error);
            throw error;
        });
    };

    window.mountDeveloperTools = function (pageName, target) {
        if (!target) throw new Error("Dev Tools page target was not found.");
        if (!views.has(target)) {
            views.set(target, createView(pageName, target));
        }
        loadVersion().then(refresh).catch((error) => showError(error));
    };
})();
