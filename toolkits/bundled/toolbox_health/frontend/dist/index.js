// ../toolkits/bundled/toolbox_health/frontend/runtime.ts
function getToolkitRuntime() {
  if (typeof window === "undefined" || !window.__SRE_TOOLKIT_RUNTIME) {
    throw new Error("SRE Toolkit runtime not injected yet");
  }
  return window.__SRE_TOOLKIT_RUNTIME;
}
function getReactRuntime() {
  return getToolkitRuntime().react;
}
function getReactRouterRuntime() {
  return getToolkitRuntime().reactRouterDom;
}
function apiFetch(path, options) {
  return getToolkitRuntime().apiFetch(path, options);
}

// ../toolkits/bundled/toolbox_health/frontend/components/StatusIndicator.tsx
var statusConfig = {
  healthy: {
    label: "Healthy",
    icon: "check_circle",
    color: "var(--color-success-border)",
    background: "var(--color-success-bg)",
    textColor: "var(--color-success-text)"
  },
  degraded: {
    label: "Degraded",
    icon: "error",
    color: "var(--color-warning-border)",
    background: "var(--color-warning-bg)",
    textColor: "var(--color-warning-text)"
  },
  down: {
    label: "Down",
    icon: "cancel",
    color: "var(--color-danger-border)",
    background: "var(--color-danger-bg)",
    textColor: "var(--color-danger-text)"
  },
  unknown: {
    label: "Unknown",
    icon: "help",
    color: "var(--color-border)",
    background: "var(--color-surface-alt)",
    textColor: "var(--color-text-secondary)"
  }
};
function getStatusConfig(status) {
  return statusConfig[status] ?? statusConfig.unknown;
}
function StatusIndicator({ status }) {
  const config = getStatusConfig(status);
  return /* @__PURE__ */ React.createElement(
    "span",
    {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: "0.2rem 0.55rem",
        borderRadius: 999,
        border: `1px solid ${config.color}`,
        background: config.background,
        color: config.textColor,
        fontWeight: 600,
        fontSize: "0.85rem"
      }
    },
    /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", "aria-hidden": true, style: { fontSize: "1rem", lineHeight: 1 } }, config.icon),
    config.label
  );
}

// ../toolkits/bundled/toolbox_health/frontend/pages/OverviewPage.tsx
var React2 = getReactRuntime();
var AUTO_REFRESH_INTERVAL_MS = 6e4;
var componentDescriptions = {
  frontend: "Renders the administrative UI and serves static assets.",
  backend: "Provides the REST API, database access, and authentication.",
  worker: "Processes asynchronous jobs, schedules automation, and handles long-running tasks."
};
function formatTimestamp(value) {
  if (!value) {
    return "Unknown";
  }
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  } catch (error) {
    return value;
  }
}
function formatLatency(latency) {
  if (latency === null || typeof latency === "undefined") {
    return "\u2014";
  }
  return `${Math.round(latency)} ms`;
}
function HealthCard({ summary }) {
  const overallConfig = getStatusConfig(summary.overall_status);
  return /* @__PURE__ */ React2.createElement(
    "section",
    {
      className: "tk-card",
      style: {
        display: "grid",
        gap: "1rem",
        padding: "1.5rem",
        border: `1px solid ${overallConfig.color}`
      }
    },
    /* @__PURE__ */ React2.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.5rem" } }, /* @__PURE__ */ React2.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" } }, /* @__PURE__ */ React2.createElement(StatusIndicator, { status: summary.overall_status }), /* @__PURE__ */ React2.createElement("span", { style: { color: "var(--color-text-secondary)", fontSize: "0.85rem" } }, "Last checked ", formatTimestamp(summary.checked_at))), /* @__PURE__ */ React2.createElement("h4", { style: { margin: 0 } }, "Toolbox core services"), /* @__PURE__ */ React2.createElement("p", { style: { margin: 0, color: "var(--color-text-secondary)" } }, summary.notes))
  );
}
function ComponentGrid({ components }) {
  return /* @__PURE__ */ React2.createElement("section", { className: "tk-card", style: { padding: "1.5rem", display: "grid", gap: "1rem" } }, /* @__PURE__ */ React2.createElement("header", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" } }, /* @__PURE__ */ React2.createElement("h4", { style: { margin: 0, display: "flex", alignItems: "center", gap: "0.4rem" } }, /* @__PURE__ */ React2.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1.1rem", color: "var(--color-link)" }, "aria-hidden": true }, "lan"), "Component details"), /* @__PURE__ */ React2.createElement("span", { style: { color: "var(--color-text-secondary)", fontSize: "0.85rem" } }, "Refresh manually or wait for automatic updates every minute.")), /* @__PURE__ */ React2.createElement("div", { style: { display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" } }, components.map((component) => {
    const description = componentDescriptions[component.component] ?? "Monitored service.";
    return /* @__PURE__ */ React2.createElement(
      "article",
      {
        key: component.component,
        style: {
          border: "1px solid var(--color-border)",
          borderRadius: 12,
          padding: "1rem",
          display: "grid",
          gap: "0.75rem",
          background: "var(--color-surface)"
        }
      },
      /* @__PURE__ */ React2.createElement("header", { style: { display: "grid", gap: "0.4rem" } }, /* @__PURE__ */ React2.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, /* @__PURE__ */ React2.createElement("strong", { style: { fontSize: "1rem" } }, component.component.toUpperCase()), /* @__PURE__ */ React2.createElement(StatusIndicator, { status: component.status })), /* @__PURE__ */ React2.createElement("p", { style: { margin: 0, color: "var(--color-text-secondary)" } }, description)),
      /* @__PURE__ */ React2.createElement("dl", { style: { margin: 0, display: "grid", gap: "0.45rem" } }, /* @__PURE__ */ React2.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem" } }, /* @__PURE__ */ React2.createElement("dt", { style: { margin: 0, color: "var(--color-text-secondary)" } }, "Message"), /* @__PURE__ */ React2.createElement("dd", { style: { margin: 0, textAlign: "right", color: "var(--color-text-primary)" } }, component.message)), /* @__PURE__ */ React2.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem" } }, /* @__PURE__ */ React2.createElement("dt", { style: { margin: 0, color: "var(--color-text-secondary)" } }, "Latency"), /* @__PURE__ */ React2.createElement("dd", { style: { margin: 0, textAlign: "right" } }, formatLatency(component.latency_ms))), /* @__PURE__ */ React2.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem" } }, /* @__PURE__ */ React2.createElement("dt", { style: { margin: 0, color: "var(--color-text-secondary)" } }, "Checked"), /* @__PURE__ */ React2.createElement("dd", { style: { margin: 0, textAlign: "right" } }, formatTimestamp(component.checked_at))))
    );
  })));
}
function OverviewPage() {
  const { useCallback, useEffect, useMemo, useState } = React2;
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const fetchSummary = useCallback(
    async ({ signal, forceRefresh = false, showSpinner = false } = {}) => {
      if (showSpinner) {
        setLoading(true);
      }
      try {
        const query = forceRefresh ? "?force_refresh=true" : "";
        const response = await apiFetch(
          `/toolkits/toolbox-health/health/summary${query}`,
          {
            signal,
            cache: "no-store"
          }
        );
        setSummary(response);
        setError(null);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load health summary.");
      } finally {
        if (showSpinner) {
          setLoading(false);
        }
      }
    },
    [setSummary, setError, setLoading]
  );
  useEffect(() => {
    const controller = new AbortController();
    fetchSummary({ signal: controller.signal, showSpinner: true }).catch(() => {
      setError("Failed to load health summary.");
    });
    return () => controller.abort();
  }, [fetchSummary]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchSummary().catch(() => {
        setError("Failed to load health summary.");
      });
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [fetchSummary]);
  const refresh = useCallback(() => {
    fetchSummary({ forceRefresh: true, showSpinner: true }).catch(() => {
      setError("Failed to load health summary.");
    });
  }, [fetchSummary]);
  const components = useMemo(() => summary?.components ?? [], [summary]);
  return /* @__PURE__ */ React2.createElement("div", { style: { display: "grid", gap: "1.5rem" } }, /* @__PURE__ */ React2.createElement("div", { style: { display: "flex", justifyContent: "flex-end" } }, /* @__PURE__ */ React2.createElement(
    "button",
    {
      type: "button",
      className: "tk-button tk-button--secondary",
      onClick: refresh,
      disabled: loading,
      style: { display: "inline-flex", alignItems: "center", gap: "0.4rem" }
    },
    /* @__PURE__ */ React2.createElement("span", { className: "material-symbols-outlined", "aria-hidden": true }, loading ? "hourglass_top" : "refresh"),
    loading ? "Refreshing\u2026" : "Refresh"
  )), error && /* @__PURE__ */ React2.createElement(
    "div",
    {
      role: "alert",
      className: "tk-card",
      style: {
        border: "1px solid var(--color-danger-border)",
        background: "var(--color-danger-bg)",
        color: "var(--color-danger-text)",
        padding: "1rem"
      }
    },
    /* @__PURE__ */ React2.createElement("strong", { style: { display: "flex", alignItems: "center", gap: "0.4rem" } }, /* @__PURE__ */ React2.createElement("span", { className: "material-symbols-outlined", "aria-hidden": true }, "error"), "Unable to update health status"),
    /* @__PURE__ */ React2.createElement("span", { style: { marginTop: "0.35rem", display: "block" } }, error)
  ), summary && /* @__PURE__ */ React2.createElement(HealthCard, { summary }), components.length > 0 && /* @__PURE__ */ React2.createElement(ComponentGrid, { components }), !loading && !summary && !error && /* @__PURE__ */ React2.createElement("p", { style: { color: "var(--color-text-secondary)" } }, "No health data available."));
}

// ../toolkits/bundled/toolbox_health/frontend/index.tsx
var React3 = getReactRuntime();
var ReactRouterDom = getReactRouterRuntime();
var { NavLink, Navigate, Route, Routes } = ReactRouterDom;
var layoutStyles = {
  wrapper: {
    padding: "1.5rem",
    display: "grid",
    gap: "1.5rem",
    color: "var(--color-text-primary)"
  },
  nav: {
    display: "flex",
    gap: "0.5rem",
    flexWrap: "wrap"
  },
  navLink: (active) => ({
    padding: "0.5rem 0.9rem",
    borderRadius: 8,
    border: "1px solid var(--color-border)",
    background: active ? "var(--color-accent)" : "transparent",
    color: active ? "var(--color-sidebar-item-active-text)" : "var(--color-link)",
    fontWeight: 600,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.4rem"
  })
};
var iconStyle = {
  fontSize: "1.15rem",
  lineHeight: 1,
  color: "var(--color-link)"
};
function ToolboxHealthToolkitLayout() {
  return /* @__PURE__ */ React3.createElement("div", { className: "tk-card", style: layoutStyles.wrapper }, /* @__PURE__ */ React3.createElement("header", null, /* @__PURE__ */ React3.createElement("h3", { style: { margin: 0, display: "flex", alignItems: "center", gap: "0.45rem" } }, /* @__PURE__ */ React3.createElement("span", { className: "material-symbols-outlined", style: iconStyle, "aria-hidden": true }, "stethoscope"), "Toolbox Health"), /* @__PURE__ */ React3.createElement("p", { style: { margin: "0.3rem 0 0", color: "var(--color-text-secondary)" } }, "Monitor the vitality of the Toolbox frontend, backend, and worker services.")), /* @__PURE__ */ React3.createElement("nav", { style: layoutStyles.nav, "aria-label": "Toolbox health views" }, /* @__PURE__ */ React3.createElement(NavLink, { end: true, to: "", style: ({ isActive }) => layoutStyles.navLink(isActive) }, /* @__PURE__ */ React3.createElement("span", { className: "material-symbols-outlined", style: iconStyle, "aria-hidden": true }, "dashboard"), "Overview")), /* @__PURE__ */ React3.createElement("section", null, /* @__PURE__ */ React3.createElement(Routes, null, /* @__PURE__ */ React3.createElement(Route, { index: true, element: /* @__PURE__ */ React3.createElement(OverviewPage, null) }), /* @__PURE__ */ React3.createElement(Route, { path: "*", element: /* @__PURE__ */ React3.createElement(Navigate, { to: ".", replace: true }) }))));
}
export {
  ToolboxHealthToolkitLayout as default
};
