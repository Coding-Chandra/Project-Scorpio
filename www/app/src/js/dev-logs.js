(function () {
    "use strict";

    const LOGS_KEY = "notozApp_dev_logs";
    const DEVELOPER_MODE_KEY = "notozApp_developer_mode";
    const HFR_HUD_KEY = "notozApp_hfr_hud_enabled";
    const MAX_LOGS = 500;
    const MAX_MESSAGE_LENGTH = 1600;
    const originalConsole = {};
    let memoryEntries = null;
    let storageWarningShown = false;
    let panelCounter = 0;
    let toastTimer = 0;

    ["debug", "info", "log", "warn", "error"].forEach((level) => {
        if (typeof console[level] === "function") {
            originalConsole[level] = console[level].bind(console);
        }
    });

    function reportStorageError(error) {
        if (storageWarningShown) return;
        storageWarningShown = true;
        const warn = originalConsole.warn || originalConsole.error;
        if (warn) warn("[Dev Logs] Could not persist local logs:", error);
    }

    function redact(value) {
        return value
            .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]")
            .replace(
                /((?:password|token|secret|authorization|api[_-]?key|master[_-]?key)\s*[:=]\s*)["']?[^,\s}"']+/gi,
                "$1[redacted]",
            );
    }

    function stringifyArgument(value) {
        if (value instanceof Error) {
            return value.stack || `${value.name}: ${value.message}`;
        }
        if (typeof value === "string") return value;
        if (typeof value === "undefined") return "undefined";
        if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;
        if (typeof value === "symbol") return value.toString();

        try {
            const serialized = JSON.stringify(value, (key, nestedValue) => {
                if (/password|token|secret|authorization|api[_-]?key|master[_-]?key/i.test(key)) {
                    return "[redacted]";
                }
                if (nestedValue instanceof Error) {
                    return nestedValue.stack || `${nestedValue.name}: ${nestedValue.message}`;
                }
                return nestedValue;
            });
            return serialized === undefined ? String(value) : serialized;
        } catch (error) {
            return `[Unserializable value: ${error.message || error}]`;
        }
    }

    function formatArguments(args) {
        const message = redact(Array.from(args, stringifyArgument).join(" "));
        return message.length > MAX_MESSAGE_LENGTH
            ? `${message.slice(0, MAX_MESSAGE_LENGTH)}… [truncated]`
            : message;
    }

    function loadEntries() {
        if (memoryEntries) return memoryEntries.slice();
        try {
            const stored = localStorage.getItem(LOGS_KEY);
            if (!stored) return [];
            const entries = JSON.parse(stored);
            if (!Array.isArray(entries)) throw new Error("Stored logs are not an array.");
            return entries.filter(
                (entry) =>
                    entry &&
                    typeof entry.timestamp === "string" &&
                    typeof entry.level === "string" &&
                    typeof entry.message === "string",
            );
        } catch (error) {
            reportStorageError(error);
            return [];
        }
    }

    function publish(entries) {
        memoryEntries = entries;
        try {
            localStorage.setItem(LOGS_KEY, JSON.stringify(entries));
            memoryEntries = null;
        } catch (error) {
            reportStorageError(error);
        }
        window.dispatchEvent(new CustomEvent("dev-logs-updated"));
    }

    function isDeveloperModeEnabled() {
        try {
            return localStorage.getItem(DEVELOPER_MODE_KEY) === "true";
        } catch (error) {
            reportStorageError(error);
            return false;
        }
    }

    function isHfrHudEnabled() {
        try {
            return localStorage.getItem(HFR_HUD_KEY) === "true";
        } catch (error) {
            reportStorageError(error);
            return false;
        }
    }

    window.isDeveloperOptionsEnabled = isDeveloperModeEnabled;
    window.isHfrHudEnabled = isHfrHudEnabled;

    window.setDeveloperOptionsEnabled = function (enabled) {
        const value = Boolean(enabled);
        try {
            localStorage.setItem(DEVELOPER_MODE_KEY, String(value));
            if (!value) {
                localStorage.setItem(HFR_HUD_KEY, "false");
                window.dispatchEvent(
                    new CustomEvent("hfr-hud-changed", { detail: { enabled: false } }),
                );
            }
        } catch (error) {
            reportStorageError(error);
            return false;
        }
        window.dispatchEvent(
            new CustomEvent("developer-options-changed", { detail: { enabled: value } }),
        );
        return true;
    };

    window.setHfrHudEnabled = function (enabled) {
        const value = Boolean(enabled);
        try {
            localStorage.setItem(HFR_HUD_KEY, String(value));
            if (value && !isDeveloperModeEnabled()) {
                localStorage.setItem(DEVELOPER_MODE_KEY, "true");
                window.dispatchEvent(
                    new CustomEvent("developer-options-changed", { detail: { enabled: true } }),
                );
            }
        } catch (error) {
            reportStorageError(error);
            return false;
        }
        window.dispatchEvent(
            new CustomEvent("hfr-hud-changed", { detail: { enabled: value } }),
        );
        return true;
    };

    function initializeDeveloperUnlock() {
        ["buildNumberDisplay", "desktop-build-number"].forEach((id) => {
            const buildNumber = document.getElementById(id);
            if (!buildNumber) return;

            let tapCount = 0;
            let lastTapAt = 0;
            buildNumber.addEventListener("click", () => {
                const now = Date.now();
                tapCount = now - lastTapAt > 2000 ? 1 : tapCount + 1;
                lastTapAt = now;
                if (tapCount < 7) return;

                tapCount = 0;
                if (!window.setDeveloperOptionsEnabled(true)) return;
                window.dispatchEvent(new CustomEvent("developer-options-unlocked"));
            });
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeDeveloperUnlock, { once: true });
    } else {
        initializeDeveloperUnlock();
    }

    function record(level, args, source) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            page: window.location.pathname,
            message: formatArguments(args),
        };
        if (source) entry.source = source;

        const entries = loadEntries();
        entries.push(entry);
        publish(entries.slice(-MAX_LOGS));
    }

    Object.keys(originalConsole).forEach((level) => {
        const original = console[level];
        console[level] = function (...args) {
            original.apply(console, args);
            try {
                record(level, args);
            } catch (error) {
                reportStorageError(error);
            }
        };
    });

    window.addEventListener("error", (event) => {
        const source = event.filename
            ? `${event.filename}:${event.lineno || 0}:${event.colno || 0}`
            : "";
        record("error", [event.error || event.message || "Uncaught error"], source);
    });

    window.addEventListener("unhandledrejection", (event) => {
        record("error", ["Unhandled promise rejection:", event.reason]);
    });

    window.addEventListener("storage", (event) => {
        if (event.key === LOGS_KEY) {
            memoryEntries = null;
            window.dispatchEvent(new CustomEvent("dev-logs-updated"));
        }
    });

    function makeButton(text, className) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = className || "dev-log-button";
        button.textContent = text;
        return button;
    }

    function showDevLogToast(message) {
        let toast = document.getElementById("dev-log-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "dev-log-toast";
            toast.className = "dev-log-toast";
            toast.setAttribute("role", "status");
            toast.setAttribute("aria-live", "polite");
            document.body.appendChild(toast);
        }

        clearTimeout(toastTimer);
        const visible = toast.style.display !== "none";
        const startOpacity =
            visible && typeof window.getComputedStyle === "function"
                ? Number.parseFloat(window.getComputedStyle(toast).opacity) || 0
                : 0;
        toast.getAnimations?.().forEach((animation) => animation.cancel());
        toast.textContent = message;
        toast.style.display = "block";

        if (typeof toast.animate === "function") {
            toast.animate(
                [
                    {
                        opacity: startOpacity,
                        transform: `translate(-50%, ${12 * (1 - startOpacity)}px)`,
                    },
                    { opacity: 1, transform: "translate(-50%, 0)" },
                ],
                { duration: 240, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "forwards" },
            );
        } else {
            toast.style.opacity = "1";
            toast.style.transform = "translate(-50%, 0)";
        }

        toastTimer = setTimeout(() => {
            if (typeof toast.animate !== "function") {
                toast.style.display = "none";
                return;
            }
            const animation = toast.animate(
                [
                    { opacity: 1, transform: "translate(-50%, 0)" },
                    { opacity: 0, transform: "translate(-50%, 8px)" },
                ],
                { duration: 200, easing: "ease-in", fill: "forwards" },
            );
            animation.onfinish = () => {
                toast.getAnimations?.().forEach((activeAnimation) => activeAnimation.cancel());
                toast.style.display = "none";
            };
        }, 1800);
    }

    function createPanel() {
        panelCounter += 1;
        const panel = document.createElement("section");
        panel.className = "settings-group dev-log-panel";
        panel.setAttribute("aria-label", "Developer logs");

        const heading = document.createElement("div");
        heading.className = "dev-log-heading";
        const title = document.createElement("h2");
        title.textContent = "Developer logs";
        const count = document.createElement("span");
        count.className = "dev-log-count";
        heading.append(title, count);

        const description = document.createElement("p");
        description.className = "dev-log-description";
        description.textContent =
            `Logs are saved on this device. The most recent ${MAX_LOGS} entries are kept.`;

        const controls = document.createElement("div");
        controls.className = "dev-log-controls";
        const filters = document.createElement("div");
        filters.className = "dev-log-filters";
        const listId = `dev-log-list-${panelCounter}`;
        const list = document.createElement("ol");
        list.className = "dev-log-list";
        list.id = listId;
        list.setAttribute("aria-live", "polite");

        let activeFilter = "all";
        let renderScheduled = false;
        const filterButtons = {};
        [
            ["all", "All"],
            ["error", "Errors"],
            ["warn", "Warnings"],
        ].forEach(([filter, label]) => {
            const button = makeButton(label, "dev-log-filter");
            button.type = "button";
            button.setAttribute("aria-controls", listId);
            button.setAttribute("aria-pressed", filter === activeFilter ? "true" : "false");
            button.addEventListener("click", () => {
                activeFilter = filter;
                Object.entries(filterButtons).forEach(([name, filterButton]) => {
                    filterButton.setAttribute(
                        "aria-pressed",
                        name === activeFilter ? "true" : "false",
                    );
                });
                render();
            });
            filterButtons[filter] = button;
            filters.appendChild(button);
        });

        const actions = document.createElement("div");
        actions.className = "dev-log-actions";
        const copyButton = makeButton("Copy errors", "dev-log-button");
        const copyAllButton = makeButton("Copy all logs", "dev-log-button");
        const clearButton = makeButton("Clear logs", "dev-log-button dev-log-button-danger");
        actions.append(copyButton, copyAllButton, clearButton);
        controls.append(filters, actions);

        panel.append(heading, description, controls, list);

        function render() {
            const entries = loadEntries();
            const filtered = entries.filter((entry) => {
                if (activeFilter === "all") return true;
                if (activeFilter === "error") return entry.level === "error";
                return entry.level === "warn";
            });
            count.textContent = `${filtered.length} ${activeFilter === "all" ? "total" : activeFilter}`;
            copyButton.textContent = `Copy errors (${entries.filter((entry) => entry.level === "error").length})`;
            copyAllButton.textContent = `Copy all logs (${entries.length})`;
            clearButton.disabled = false;
            list.replaceChildren();

            if (!filtered.length) {
                const empty = document.createElement("li");
                empty.className = "dev-log-empty";
                empty.textContent = activeFilter === "all" ? "No logs recorded yet." : "No matching logs.";
                list.appendChild(empty);
                return;
            }

            const fragment = document.createDocumentFragment();
            filtered.slice().reverse().forEach((entry) => {
                const item = document.createElement("li");
                item.className = `dev-log-entry dev-log-entry-${entry.level}`;

                const meta = document.createElement("div");
                meta.className = "dev-log-entry-meta";
                const level = document.createElement("strong");
                level.textContent = entry.level.toUpperCase();
                const time = document.createElement("time");
                time.dateTime = entry.timestamp;
                const parsedTime = new Date(entry.timestamp);
                time.textContent = Number.isNaN(parsedTime.getTime())
                    ? entry.timestamp
                    : parsedTime.toLocaleString();
                meta.append(level, time);

                const message = document.createElement("pre");
                message.className = "dev-log-message";
                message.textContent = entry.message;
                item.append(meta, message);
                if (entry.source) {
                    const source = document.createElement("small");
                    source.className = "dev-log-source";
                    source.textContent = entry.source;
                    item.appendChild(source);
                }
                fragment.appendChild(item);
            });
            list.appendChild(fragment);
        }

        function scheduleRender() {
            if (renderScheduled) return;
            renderScheduled = true;
            if (typeof window.requestAnimationFrame === "function") {
                window.requestAnimationFrame(() => {
                    renderScheduled = false;
                    render();
                });
            } else {
                renderScheduled = false;
                render();
            }
        }

        async function copyEntries(entries, description) {
            if (!entries.length) {
                showDevLogToast(description === "error logs" ? "No error logs to copy" : "No logs to copy");
                return;
            }

            const text = entries
                .map((entry) => {
                    const source = entry.source ? ` (${entry.source})` : "";
                    return `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.page}${source}\n${entry.message}`;
                })
                .join("\n\n");
            try {
                if (navigator.clipboard?.writeText) {
                    try {
                        await navigator.clipboard.writeText(text);
                        showDevLogToast(
                            `${description === "error logs" ? "Error logs" : "All logs"} copied (${entries.length})`,
                        );
                        return;
                    } catch {
                        // Use the legacy clipboard API for WebViews without clipboard permission.
                    }
                }
                const temporary = document.createElement("textarea");
                temporary.value = text;
                temporary.setAttribute("readonly", "");
                temporary.style.position = "fixed";
                temporary.style.opacity = "0";
                document.body.appendChild(temporary);
                temporary.select();
                const copied = document.execCommand("copy");
                temporary.remove();
                if (!copied) throw new Error("Clipboard access is unavailable.");
                showDevLogToast(
                    `${description === "error logs" ? "Error logs" : "All logs"} copied (${entries.length})`,
                );
            } catch (error) {
                showDevLogToast(`Could not copy ${description}: ${error.message || error}`);
            }
        }

        copyButton.addEventListener("click", () => {
            copyEntries(loadEntries().filter((entry) => entry.level === "error"), "error logs");
        });
        copyAllButton.addEventListener("click", () => {
            copyEntries(loadEntries(), "all logs");
        });

        clearButton.addEventListener("click", () => {
            if (typeof window.openModal !== "function") {
                showDevLogToast("Clear logs confirmation is unavailable");
                return;
            }
            window.openModal(
                "Clear all logs?",
                "This permanently deletes all saved developer logs from this device.",
                "Clear logs",
                "var(--accent1)",
                async () => {
                    publish([]);
                    window.closeCustomModal?.();
                    showDevLogToast("Logs cleared");
                },
                clearButton,
            );
        });

        window.addEventListener("dev-logs-updated", () => {
            if (panel.isConnected) scheduleRender();
        });
        render();
        return { element: panel, refresh: render };
    }

    let logsPanel = null;
    let logsPanelRefresh = null;

    window.mountDeveloperLogs = function (target) {
        if (!target) throw new Error("Developer log view target was not found.");
        if (!logsPanel) {
            const panel = createPanel();
            logsPanel = panel.element;
            logsPanelRefresh = panel.refresh;
        }
        target.replaceChildren(logsPanel);
        logsPanelRefresh();
    };
})();
