// ../toolkits/bundled/regex/frontend/index.tsx
import React2 from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";

// ../toolkits/bundled/regex/frontend/pages/RegexTesterPage.tsx
import React, { useState } from "react";

// ../toolkits/bundled/regex/frontend/runtime.ts
function getToolkitRuntime() {
  if (typeof window === "undefined" || !window.__SRE_TOOLKIT_RUNTIME) {
    throw new Error("SRE Toolkit runtime not injected yet");
  }
  return window.__SRE_TOOLKIT_RUNTIME;
}
function apiFetch(path, options) {
  return getToolkitRuntime().apiFetch(path, options);
}

// ../toolkits/bundled/regex/frontend/pages/RegexTesterPage.tsx
var flagOptions = ["IGNORECASE", "MULTILINE", "DOTALL", "VERBOSE", "UNICODE", "ASCII"];
var iconStyle = {
  fontSize: "1.1rem",
  lineHeight: 1,
  color: "var(--color-link)"
};
function RegexTesterPage() {
  const [pattern, setPattern] = useState("^host-(?P<id>\\d+)$");
  const [testString, setTestString] = useState("host-01\nhost-abc\nhost-22");
  const [flags, setFlags] = useState(["MULTILINE"]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const toggleFlag = (flag) => {
    setFlags((prev) => prev.includes(flag) ? prev.filter((item) => item !== flag) : [...prev, flag]);
  };
  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await apiFetch("/toolkits/regex/test", {
        method: "POST",
        body: JSON.stringify({ pattern, test_string: testString, flags })
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };
  return /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: "1.5rem", color: "var(--color-text-primary)" } }, /* @__PURE__ */ React.createElement("form", { onSubmit: submit, style: sectionStyle }, /* @__PURE__ */ React.createElement("h4", { style: { marginTop: 0, display: "flex", alignItems: "center", gap: "0.4rem" } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: iconStyle, "aria-hidden": true }, "play_circle"), "Evaluate expression"), /* @__PURE__ */ React.createElement(Field, { label: "Pattern" }, /* @__PURE__ */ React.createElement(
    "input",
    {
      className: "tk-input",
      value: pattern,
      onChange: (e) => setPattern(e.target.value),
      required: true
    }
  )), /* @__PURE__ */ React.createElement(Field, { label: "Test string" }, /* @__PURE__ */ React.createElement(
    "textarea",
    {
      className: "tk-input",
      value: testString,
      onChange: (e) => setTestString(e.target.value),
      rows: 6,
      required: true
    }
  )), /* @__PURE__ */ React.createElement("fieldset", { className: "tk-fieldset" }, /* @__PURE__ */ React.createElement("legend", { className: "tk-legend" }, "Flags"), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "0.75rem" } }, flagOptions.map((flag) => /* @__PURE__ */ React.createElement("label", { key: flag, style: { display: "flex", gap: "0.4rem", alignItems: "center" } }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: flags.includes(flag), onChange: () => toggleFlag(flag) }), flag)))), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "submit",
      className: "tk-button tk-button--primary",
      style: { width: "fit-content" },
      disabled: loading
    },
    /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { ...iconStyle, color: "var(--color-text-primary)" }, "aria-hidden": true }, loading ? "hourglass_top" : "play_arrow"),
    loading ? "Evaluating\u2026" : "Evaluate"
  )), error && /* @__PURE__ */ React.createElement("p", { style: { color: "var(--color-danger-border)", display: "flex", alignItems: "center", gap: "0.35rem" } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { ...iconStyle, color: "var(--color-danger-border)" }, "aria-hidden": true }, "error"), error), result && /* @__PURE__ */ React.createElement(RegexResult, { result }));
}
function RegexResult({ result }) {
  if (!result.ok) {
    return /* @__PURE__ */ React.createElement("section", { style: sectionStyle }, /* @__PURE__ */ React.createElement("h4", { style: { marginTop: 0, display: "flex", alignItems: "center", gap: "0.4rem" } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { ...iconStyle, color: "var(--color-danger-border)" }, "aria-hidden": true }, "report"), "Result"), /* @__PURE__ */ React.createElement("p", { style: { color: "var(--color-danger-border)" } }, result.error));
  }
  if (result.matches.length === 0) {
    return /* @__PURE__ */ React.createElement("section", { style: sectionStyle }, /* @__PURE__ */ React.createElement("h4", { style: { marginTop: 0, display: "flex", alignItems: "center", gap: "0.4rem" } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { ...iconStyle, color: "var(--color-text-secondary)" }, "aria-hidden": true }, "insights"), "Result"), /* @__PURE__ */ React.createElement("p", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { ...iconStyle, color: "var(--color-text-muted)" }, "aria-hidden": true }, "visibility_off"), "No matches found."));
  }
  return /* @__PURE__ */ React.createElement("section", { style: sectionStyle }, /* @__PURE__ */ React.createElement("h4", { style: { marginTop: 0, display: "flex", alignItems: "center", gap: "0.4rem" } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { ...iconStyle, color: "var(--color-accent)" }, "aria-hidden": true }, "check_circle"), "Matches"), /* @__PURE__ */ React.createElement("div", { style: { display: "grid", gap: "0.75rem" } }, result.matches.map((match, idx) => /* @__PURE__ */ React.createElement(MatchCard, { match, index: idx, key: `${match.match}-${idx}` }))));
}
function MatchCard({ match, index }) {
  return /* @__PURE__ */ React.createElement("div", { style: matchCardStyle }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("span", { style: { display: "inline-flex", alignItems: "center", gap: "0.3rem" } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { ...iconStyle, color: "var(--color-link)" }, "aria-hidden": true }, "match_case"), /* @__PURE__ */ React.createElement("strong", null, "#", index + 1), " \u2013 ", match.match, " (", match.start, "\u2013", match.end, ")")), match.groups.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { marginTop: "0.4rem", fontSize: "0.9rem" } }, /* @__PURE__ */ React.createElement("strong", null, "Groups:"), " ", match.groups.map((g, idx) => /* @__PURE__ */ React.createElement("span", { key: idx, style: { marginRight: "0.5rem" } }, "#", idx + 1, ": ", g ?? "\u2205"))), Object.keys(match.groupdict).length > 0 && /* @__PURE__ */ React.createElement("div", { style: { marginTop: "0.4rem", fontSize: "0.9rem" } }, /* @__PURE__ */ React.createElement("strong", null, "Named groups:"), " ", Object.entries(match.groupdict).map(([key, value]) => /* @__PURE__ */ React.createElement("span", { key, style: { marginRight: "0.5rem" } }, key, ": ", value ?? "\u2205"))));
}
function Field({ label, children }) {
  return /* @__PURE__ */ React.createElement("label", { className: "tk-label", style: { display: "grid", gap: "0.3rem", fontSize: "0.9rem" } }, label, children);
}
var sectionStyle = {
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  padding: "1.25rem",
  background: "var(--color-surface-alt)",
  display: "grid",
  gap: "0.75rem"
};
var matchCardStyle = {
  background: "var(--color-surface)",
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  padding: "0.85rem 1rem"
};

// ../toolkits/bundled/regex/frontend/index.tsx
var layoutStyles = {
  wrapper: {
    background: "var(--color-surface)",
    borderRadius: 12,
    boxShadow: "var(--color-shadow)",
    border: "1px solid var(--color-border)",
    padding: "1.5rem",
    display: "grid",
    gap: "1.5rem",
    color: "var(--color-text-primary)"
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
var iconStyle2 = {
  fontSize: "1.15rem",
  lineHeight: 1,
  color: "var(--color-link)"
};
function RegexToolkitLayout() {
  return /* @__PURE__ */ React2.createElement("div", { style: layoutStyles.wrapper }, /* @__PURE__ */ React2.createElement("header", null, /* @__PURE__ */ React2.createElement("h3", { style: { margin: 0, display: "flex", alignItems: "center", gap: "0.45rem" } }, /* @__PURE__ */ React2.createElement("span", { className: "material-symbols-outlined", style: iconStyle2, "aria-hidden": true }, "data_object"), "Regex Toolkit"), /* @__PURE__ */ React2.createElement("p", { style: { margin: "0.3rem 0 0", color: "var(--color-text-secondary)" } }, "Evaluate expressions, toggle flags, and inspect capture groups."), /* @__PURE__ */ React2.createElement(
    "aside",
    {
      style: {
        marginTop: "0.75rem",
        padding: "0.75rem 1rem",
        borderRadius: 10,
        border: "1px solid var(--color-warning-border)",
        background: "var(--color-warning-bg)",
        color: "var(--color-warning-text)",
        fontSize: "0.9rem",
        lineHeight: 1.45
      }
    },
    /* @__PURE__ */ React2.createElement("strong", null, "Named groups:"),
    " patterns run on Python's ",
    /* @__PURE__ */ React2.createElement("code", null, "re"),
    " engine. Use",
    " ",
    /* @__PURE__ */ React2.createElement("code", null, "(?P<name>...)"),
    " for named captures\u2014the JavaScript-style ",
    /* @__PURE__ */ React2.createElement("code", null, "(?<name>...)"),
    "syntax is not supported."
  )), /* @__PURE__ */ React2.createElement("nav", { style: { display: "flex", gap: "0.5rem" } }, /* @__PURE__ */ React2.createElement(NavLink, { end: true, to: "", style: ({ isActive }) => layoutStyles.navLink(isActive) }, /* @__PURE__ */ React2.createElement("span", { className: "material-symbols-outlined", style: iconStyle2, "aria-hidden": true }, "find_replace"), "Playground")), /* @__PURE__ */ React2.createElement("section", null, /* @__PURE__ */ React2.createElement(Routes, null, /* @__PURE__ */ React2.createElement(Route, { index: true, element: /* @__PURE__ */ React2.createElement(RegexTesterPage, null) }), /* @__PURE__ */ React2.createElement(Route, { path: "*", element: /* @__PURE__ */ React2.createElement(Navigate, { to: ".", replace: true }) }))));
}
export {
  RegexToolkitLayout as default
};
