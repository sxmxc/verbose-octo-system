// ../toolkits/bundled/zabbix/frontend/runtime.ts
function getToolkitRuntime() {
  if (typeof window === "undefined" || !window.__SRE_TOOLKIT_RUNTIME) {
    throw new Error("SRE Toolkit runtime not injected yet");
  }
  return window.__SRE_TOOLKIT_RUNTIME;
}
function apiFetch(path, options) {
  return getToolkitRuntime().apiFetch(path, options);
}
function getReactRuntime() {
  return getToolkitRuntime().react;
}
function getReactRouterRuntime() {
  return getToolkitRuntime().reactRouterDom;
}

// ../toolkits/bundled/zabbix/frontend/pages/hooks.ts
var React = getReactRuntime();
var { useCallback, useEffect, useMemo, useState } = React;
function useZabbixInstances(options = {}) {
  const { autoSelectFirst = true } = options;
  const [instances, setInstances] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch("/toolkits/zabbix/instances");
      setInstances(data);
      setSelectedId((prev) => {
        if (prev && data.some((instance) => instance.id === prev)) {
          return prev;
        }
        if (autoSelectFirst && data.length > 0) {
          return data[0].id;
        }
        return "";
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [autoSelectFirst]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const selectedInstance = useMemo(
    () => instances.find((instance) => instance.id === selectedId) ?? null,
    [instances, selectedId]
  );
  const handleSetSelectedId = useCallback((id) => {
    setSelectedId(id);
  }, []);
  return {
    instances,
    selectedId,
    setSelectedId: handleSetSelectedId,
    selectedInstance,
    loading,
    error,
    refresh
  };
}

// ../toolkits/bundled/zabbix/frontend/pages/ZabbixBulkHostsPage.tsx
var initialRow = {
  host: "demo-host-1",
  ip: "10.0.0.10",
  groups: "",
  templates: "",
  macros: ""
};
var React2 = getReactRuntime();
var { useMemo: useMemo2, useState: useState2 } = React2;
var iconStyle = {
  fontSize: "1.1rem",
  lineHeight: 1,
  color: "var(--color-link)"
};
function ZabbixBulkHostsPage() {
  const { instances, selectedId, setSelectedId, selectedInstance, loading, error } = useZabbixInstances();
  const [hostRows, setHostRows] = useState2([initialRow]);
  const [resultText, setResultText] = useState2("");
  const [feedback, setFeedback] = useState2(null);
  const [busy, setBusy] = useState2(false);
  const hasInstances = instances.length > 0;
  const buildRowsPayload = useMemo2(
    () => () => hostRows.map((row) => ({
      host: row.host,
      ip: row.ip,
      groups: splitCsv(row.groups),
      templates: splitCsv(row.templates),
      macros: parseKeyValue(row.macros)
    })),
    [hostRows]
  );
  const updateHostRow = (index, field, value) => {
    setHostRows((prev) => prev.map((row, idx) => idx === index ? { ...row, [field]: value } : row));
  };
  const addHostRow = () => setHostRows((prev) => [...prev, { host: "", ip: "", groups: "", templates: "", macros: "" }]);
  const removeHostRow = (index) => setHostRows((prev) => prev.filter((_, idx) => idx !== index));
  const performDryRun = async () => {
    if (!selectedInstance) {
      setFeedback("Select an instance first.");
      return;
    }
    setFeedback(null);
    setResultText("");
    setBusy(true);
    try {
      const payload = { rows: buildRowsPayload(), dry_run: true };
      const response = await apiFetch(
        `/toolkits/zabbix/instances/${selectedInstance.id}/actions/bulk-add-hosts/dry-run`,
        {
          method: "POST",
          body: JSON.stringify(payload)
        }
      );
      setResultText(JSON.stringify(response, null, 2));
    } catch (err) {
      setResultText(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const performExecute = async () => {
    if (!selectedInstance) {
      setFeedback("Select an instance first.");
      return;
    }
    setFeedback(null);
    setResultText("");
    setBusy(true);
    try {
      const payload = { rows: buildRowsPayload(), dry_run: false };
      const response = await apiFetch(
        `/toolkits/zabbix/instances/${selectedInstance.id}/actions/bulk-add-hosts/execute`,
        {
          method: "POST",
          body: JSON.stringify(payload)
        }
      );
      setResultText(`Job queued with id ${response.job.id}`);
    } catch (err) {
      setResultText(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ React2.createElement("div", { style: { display: "grid", gap: "1.5rem", color: "var(--color-text-primary)" } }, /* @__PURE__ */ React2.createElement("section", { style: sectionStyle }, /* @__PURE__ */ React2.createElement("h4", { style: { marginTop: 0, display: "flex", alignItems: "center", gap: "0.45rem" } }, /* @__PURE__ */ React2.createElement("span", { className: "material-symbols-outlined", style: iconStyle, "aria-hidden": true }, "group_add"), "Bulk host creation"), /* @__PURE__ */ React2.createElement("p", { style: { margin: "0.25rem 0 1rem", color: "var(--color-text-secondary)" } }, "Compose host rows, preview via dry run, or enqueue a job for asynchronous execution."), loading && /* @__PURE__ */ React2.createElement("p", { style: { color: "var(--color-text-secondary)" } }, "Loading instances\u2026"), !loading && !hasInstances && /* @__PURE__ */ React2.createElement("p", { style: { color: "var(--color-text-secondary)" } }, "Define at least one instance under Administration."), error && /* @__PURE__ */ React2.createElement("p", { style: { color: "var(--color-danger-border)" } }, error), hasInstances && /* @__PURE__ */ React2.createElement("div", { style: { display: "grid", gap: "1.25rem" } }, /* @__PURE__ */ React2.createElement("label", { className: "tk-label", style: { display: "grid", gap: "0.3rem", fontSize: "0.9rem", maxWidth: 320 } }, "Target instance", /* @__PURE__ */ React2.createElement(
    "select",
    {
      className: "tk-input",
      value: selectedId,
      onChange: (event) => setSelectedId(event.target.value)
    },
    instances.map((instance) => /* @__PURE__ */ React2.createElement("option", { value: instance.id, key: instance.id }, instance.name))
  )), /* @__PURE__ */ React2.createElement("div", { style: { display: "grid", gap: "0.75rem" } }, hostRows.map((row, idx) => /* @__PURE__ */ React2.createElement("div", { key: `${idx}-${row.host || "row"}`, style: rowCardStyle }, /* @__PURE__ */ React2.createElement("div", { style: { display: "flex", gap: "0.5rem", flexWrap: "wrap" } }, /* @__PURE__ */ React2.createElement(Field, { label: "Host" }, /* @__PURE__ */ React2.createElement(
    "input",
    {
      className: "tk-input",
      value: row.host,
      onChange: (e) => updateHostRow(idx, "host", e.target.value)
    }
  )), /* @__PURE__ */ React2.createElement(Field, { label: "IP" }, /* @__PURE__ */ React2.createElement(
    "input",
    {
      className: "tk-input",
      value: row.ip,
      onChange: (e) => updateHostRow(idx, "ip", e.target.value)
    }
  ))), /* @__PURE__ */ React2.createElement(Field, { label: "Groups (comma separated)" }, /* @__PURE__ */ React2.createElement(
    "input",
    {
      className: "tk-input",
      value: row.groups,
      onChange: (e) => updateHostRow(idx, "groups", e.target.value)
    }
  )), /* @__PURE__ */ React2.createElement(Field, { label: "Templates (comma separated)" }, /* @__PURE__ */ React2.createElement(
    "input",
    {
      className: "tk-input",
      value: row.templates,
      onChange: (e) => updateHostRow(idx, "templates", e.target.value)
    }
  )), /* @__PURE__ */ React2.createElement(Field, { label: "Macros (key=value per line)" }, /* @__PURE__ */ React2.createElement(
    "textarea",
    {
      className: "tk-input",
      value: row.macros,
      onChange: (e) => updateHostRow(idx, "macros", e.target.value),
      rows: 2
    }
  )), hostRows.length > 1 && /* @__PURE__ */ React2.createElement(
    "button",
    {
      type: "button",
      onClick: () => removeHostRow(idx),
      className: "tk-button tk-button--danger",
      style: { width: "fit-content" }
    },
    /* @__PURE__ */ React2.createElement("span", { className: "material-symbols-outlined", style: { ...iconStyle, color: "var(--color-danger-border)" }, "aria-hidden": true }, "remove_circle"),
    "Remove host"
  ))), /* @__PURE__ */ React2.createElement(
    "button",
    {
      type: "button",
      onClick: addHostRow,
      className: "tk-button",
      style: { width: "fit-content" }
    },
    /* @__PURE__ */ React2.createElement("span", { className: "material-symbols-outlined", style: { ...iconStyle, color: "var(--color-accent)" }, "aria-hidden": true }, "add_circle"),
    "Add host"
  )), /* @__PURE__ */ React2.createElement("div", { style: { display: "flex", gap: "0.75rem" } }, /* @__PURE__ */ React2.createElement("button", { type: "button", onClick: performDryRun, className: "tk-button", disabled: busy }, /* @__PURE__ */ React2.createElement("span", { className: "material-symbols-outlined", style: iconStyle, "aria-hidden": true }, "preview"), "Dry run"), /* @__PURE__ */ React2.createElement("button", { type: "button", onClick: performExecute, className: "tk-button tk-button--primary", disabled: busy }, /* @__PURE__ */ React2.createElement("span", { className: "material-symbols-outlined", style: { ...iconStyle, color: "var(--color-accent)" }, "aria-hidden": true }, "play_circle"), "Execute")), feedback && /* @__PURE__ */ React2.createElement("p", { style: { color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: "0.35rem" } }, /* @__PURE__ */ React2.createElement("span", { className: "material-symbols-outlined", style: iconStyle, "aria-hidden": true }, "info"), feedback))), resultText && /* @__PURE__ */ React2.createElement("section", { style: sectionStyle }, /* @__PURE__ */ React2.createElement("h4", { style: { marginTop: 0, display: "flex", alignItems: "center", gap: "0.4rem" } }, /* @__PURE__ */ React2.createElement("span", { className: "material-symbols-outlined", style: iconStyle, "aria-hidden": true }, "description"), "Result"), /* @__PURE__ */ React2.createElement("pre", { style: resultStyle }, resultText)));
}
function Field({ label, children }) {
  return /* @__PURE__ */ React2.createElement("label", { className: "tk-label", style: { display: "grid", gap: "0.3rem", fontSize: "0.9rem" } }, label, children);
}
var sectionStyle = {
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  padding: "1.25rem",
  background: "var(--color-surface-alt)"
};
var rowCardStyle = {
  display: "grid",
  gap: "0.5rem",
  background: "var(--color-surface)",
  padding: "0.85rem",
  borderRadius: 10,
  border: "1px solid var(--color-border)"
};
var resultStyle = {
  background: "var(--color-surface)",
  padding: "0.75rem 1rem",
  borderRadius: 8,
  fontSize: "0.85rem",
  fontFamily: "Source Code Pro, monospace",
  marginTop: "0.4rem",
  overflowX: "auto"
};
function splitCsv(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
function parseKeyValue(value) {
  const result = {};
  value.split("\n").map((line) => line.trim()).filter(Boolean).forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (!key) {
      return;
    }
    result[key.trim()] = rest.join("=").trim();
  });
  return result;
}

// ../toolkits/bundled/zabbix/frontend/pages/ZabbixOverviewPage.tsx
var React3 = getReactRuntime();
var { useEffect: useEffect2, useState: useState3 } = React3;
var iconStyle2 = {
  fontSize: "1.1rem",
  lineHeight: 1,
  color: "var(--color-link)"
};
function ZabbixOverviewPage() {
  const [instances, setInstances] = useState3([]);
  const [recentJobs, setRecentJobs] = useState3([]);
  const [loading, setLoading] = useState3(true);
  const [error, setError] = useState3(null);
  useEffect2(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [instancesRes, jobsRes] = await Promise.all([
          apiFetch("/toolkits/zabbix/instances"),
          apiFetch("/jobs?toolkit=zabbix")
        ]);
        if (!cancelled) {
          setInstances(instancesRes);
          setRecentJobs(jobsRes.jobs.slice(0, 5));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);
  return /* @__PURE__ */ React3.createElement("div", { style: { display: "grid", gap: "1.5rem", color: "var(--color-text-primary)" } }, loading && /* @__PURE__ */ React3.createElement("p", { style: { color: "var(--color-text-secondary)" } }, "Loading overview\u2026"), error && /* @__PURE__ */ React3.createElement("p", { style: { color: "var(--color-danger-border)" } }, error), /* @__PURE__ */ React3.createElement("section", null, /* @__PURE__ */ React3.createElement("h4", { style: { margin: 0, display: "flex", alignItems: "center", gap: "0.4rem" } }, /* @__PURE__ */ React3.createElement("span", { className: "material-symbols-outlined", style: iconStyle2, "aria-hidden": true }, "storage"), "Configured Instances"), /* @__PURE__ */ React3.createElement("p", { style: { margin: "0.25rem 0 1rem", color: "var(--color-text-secondary)" } }, instances.length, " active instance", instances.length === 1 ? "" : "s", "."), instances.length === 0 ? /* @__PURE__ */ React3.createElement("p", { style: { color: "var(--color-text-secondary)" } }, "No instances defined. Add one in the Settings tab.") : /* @__PURE__ */ React3.createElement("ul", { style: { listStyle: "none", padding: 0, display: "grid", gap: "0.75rem" } }, instances.map((instance) => /* @__PURE__ */ React3.createElement("li", { key: instance.id, style: instanceCardStyle }, /* @__PURE__ */ React3.createElement("div", { style: { display: "grid", gap: "0.2rem" } }, /* @__PURE__ */ React3.createElement("span", { style: { display: "inline-flex", alignItems: "center", gap: "0.3rem" } }, /* @__PURE__ */ React3.createElement("span", { className: "material-symbols-outlined", style: { ...iconStyle2, color: "var(--color-accent)" }, "aria-hidden": true }, "dns"), /* @__PURE__ */ React3.createElement("strong", null, instance.name)), /* @__PURE__ */ React3.createElement("div", { style: { color: "var(--color-text-secondary)", fontSize: "0.85rem" } }, instance.base_url)), /* @__PURE__ */ React3.createElement("div", { style: { textAlign: "right", fontSize: "0.8rem", color: "var(--color-text-secondary)" } }, /* @__PURE__ */ React3.createElement("div", null, "Created: ", new Date(instance.created_at).toLocaleString()), /* @__PURE__ */ React3.createElement("div", null, "Updated: ", new Date(instance.updated_at).toLocaleString())))))), /* @__PURE__ */ React3.createElement("section", null, /* @__PURE__ */ React3.createElement("h4", { style: { margin: 0, display: "flex", alignItems: "center", gap: "0.4rem" } }, /* @__PURE__ */ React3.createElement("span", { className: "material-symbols-outlined", style: { ...iconStyle2, color: "var(--color-link)" }, "aria-hidden": true }, "work_history"), "Recent Jobs"), /* @__PURE__ */ React3.createElement("p", { style: { margin: "0.25rem 0 1rem", color: "var(--color-text-secondary)" } }, "Last 5 Zabbix job executions."), recentJobs.length === 0 ? /* @__PURE__ */ React3.createElement("p", { style: { color: "var(--color-text-secondary)" } }, "No recent jobs.") : /* @__PURE__ */ React3.createElement("table", { style: { width: "100%", borderCollapse: "collapse" } }, /* @__PURE__ */ React3.createElement("thead", null, /* @__PURE__ */ React3.createElement("tr", { style: { textAlign: "left", background: "var(--color-surface-alt)" } }, /* @__PURE__ */ React3.createElement("th", { style: { padding: "0.5rem" } }, "Operation"), /* @__PURE__ */ React3.createElement("th", null, "Status"), /* @__PURE__ */ React3.createElement("th", null, "Progress"), /* @__PURE__ */ React3.createElement("th", null, "Updated"))), /* @__PURE__ */ React3.createElement("tbody", null, recentJobs.map((job) => /* @__PURE__ */ React3.createElement("tr", { key: job.id, style: { borderTop: "1px solid var(--color-border)" } }, /* @__PURE__ */ React3.createElement("td", { style: { padding: "0.5rem", display: "flex", alignItems: "center", gap: "0.35rem" } }, /* @__PURE__ */ React3.createElement("span", { className: "material-symbols-outlined", style: iconStyle2, "aria-hidden": true }, "integration_instructions"), job.operation), /* @__PURE__ */ React3.createElement("td", { style: { textTransform: "capitalize" } }, job.status), /* @__PURE__ */ React3.createElement("td", null, job.progress, "%"), /* @__PURE__ */ React3.createElement("td", null, job.updated_at ? new Date(job.updated_at).toLocaleString() : "\u2014")))))));
}
var instanceCardStyle = {
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  padding: "0.9rem 1.1rem",
  background: "var(--color-surface-alt)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
};

// ../toolkits/bundled/zabbix/frontend/pages/ZabbixSettingsPage.tsx
var initialForm = {
  name: "",
  base_url: "",
  token: "",
  verify_tls: true,
  description: ""
};
var React4 = getReactRuntime();
var { useCallback: useCallback2, useEffect: useEffect3, useMemo: useMemo3, useState: useState4 } = React4;
var sectionStyle2 = {
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  padding: "1.25rem",
  background: "var(--color-surface-alt)"
};
var iconStyle3 = {
  fontSize: "1.1rem",
  lineHeight: 1,
  color: "var(--color-link)"
};
function ZabbixAdministrationPage() {
  const [instances, setInstances] = useState4([]);
  const [selectedId, setSelectedId] = useState4(null);
  const [createForm, setCreateForm] = useState4(initialForm);
  const [editForm, setEditForm] = useState4(initialForm);
  const [feedback, setFeedback] = useState4(null);
  const [error, setError] = useState4(null);
  const [actionOutput, setActionOutput] = useState4("");
  const [busy, setBusy] = useState4(false);
  const loadInstances = useCallback2(async () => {
    setError(null);
    try {
      const response = await apiFetch("/toolkits/zabbix/instances");
      setInstances(response);
      if (response.length > 0 && !selectedId) {
        setSelectedId(response[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [selectedId]);
  useEffect3(() => {
    loadInstances();
  }, [loadInstances]);
  const selectedInstance = useMemo3(
    () => instances.find((instance) => instance.id === selectedId) ?? null,
    [instances, selectedId]
  );
  useEffect3(() => {
    if (selectedInstance) {
      setEditForm({
        name: selectedInstance.name,
        base_url: selectedInstance.base_url,
        token: "",
        verify_tls: selectedInstance.verify_tls,
        description: selectedInstance.description ?? ""
      });
    } else {
      setEditForm(initialForm);
    }
  }, [selectedInstance]);
  const handleCreateChange = (event) => {
    const { name, value, type, checked } = event.target;
    setCreateForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };
  const handleEditChange = (event) => {
    const { name, value, type, checked } = event.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };
  const createInstance = async (event) => {
    event.preventDefault();
    setFeedback(null);
    setActionOutput("");
    setBusy(true);
    try {
      if (!createForm.name || !createForm.base_url || !createForm.token) {
        throw new Error("Name, base URL, and token are required.");
      }
      const payload = {
        name: createForm.name,
        base_url: createForm.base_url,
        token: createForm.token,
        verify_tls: createForm.verify_tls,
        description: createForm.description || void 0
      };
      const created = await apiFetch("/toolkits/zabbix/instances", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      setFeedback(`Instance "${created.name}" created.`);
      setCreateForm(initialForm);
      setSelectedId(created.id);
      await loadInstances();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const updateInstance = async (event) => {
    event.preventDefault();
    if (!selectedInstance) return;
    setFeedback(null);
    setActionOutput("");
    setBusy(true);
    try {
      const payload = {
        name: editForm.name,
        base_url: editForm.base_url,
        verify_tls: editForm.verify_tls,
        description: editForm.description
      };
      if (editForm.token.trim()) {
        payload.token = editForm.token.trim();
      }
      const updated = await apiFetch(`/toolkits/zabbix/instances/${selectedInstance.id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      setFeedback(`Instance "${updated.name}" updated.`);
      setEditForm((prev) => ({ ...prev, token: "" }));
      await loadInstances();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const deleteInstance = async () => {
    if (!selectedInstance) return;
    if (!window.confirm(`Delete instance "${selectedInstance.name}"?`)) return;
    setBusy(true);
    setFeedback(null);
    setActionOutput("");
    try {
      await apiFetch(`/toolkits/zabbix/instances/${selectedInstance.id}`, {
        method: "DELETE",
        skipJson: true
      });
      setFeedback(`Instance "${selectedInstance.name}" deleted.`);
      setSelectedId(null);
      await loadInstances();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  const testInstance = async () => {
    if (!selectedInstance) return;
    setActionOutput("Testing connection\u2026");
    try {
      const response = await apiFetch(
        `/toolkits/zabbix/instances/${selectedInstance.id}/test`,
        { method: "POST" }
      );
      setActionOutput(response.ok ? `OK \u2014 version ${response.version}` : `Failed: ${response.error}`);
    } catch (err) {
      setActionOutput(err instanceof Error ? err.message : String(err));
    }
  };
  return /* @__PURE__ */ React4.createElement("div", { style: { display: "grid", gap: "1.5rem" } }, /* @__PURE__ */ React4.createElement("section", { style: sectionStyle2 }, /* @__PURE__ */ React4.createElement("h4", { style: { marginTop: 0, display: "flex", alignItems: "center", gap: "0.45rem", color: "var(--color-text-primary)" } }, /* @__PURE__ */ React4.createElement("span", { className: "material-symbols-outlined", style: iconStyle3, "aria-hidden": true }, "inventory_2"), "Instance registry"), error && /* @__PURE__ */ React4.createElement("p", { style: { color: "var(--color-danger-border)" } }, error), /* @__PURE__ */ React4.createElement("div", { style: { display: "flex", gap: "1rem", flexWrap: "wrap" } }, /* @__PURE__ */ React4.createElement("div", { style: { flex: "1 1 240px" } }, /* @__PURE__ */ React4.createElement("h5", { style: { margin: "0 0 0.5rem", display: "flex", alignItems: "center", gap: "0.3rem", color: "var(--color-text-primary)" } }, /* @__PURE__ */ React4.createElement("span", { className: "material-symbols-outlined", style: iconStyle3, "aria-hidden": true }, "list_alt"), "Registered"), instances.length === 0 && /* @__PURE__ */ React4.createElement("p", null, "No instances yet."), /* @__PURE__ */ React4.createElement("ul", { style: { listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.5rem" } }, instances.map((instance) => /* @__PURE__ */ React4.createElement("li", { key: instance.id }, /* @__PURE__ */ React4.createElement(
    "button",
    {
      onClick: () => setSelectedId(instance.id),
      style: {
        width: "100%",
        textAlign: "left",
        padding: "0.75rem 1rem",
        borderRadius: 8,
        border: "1px solid",
        borderColor: selectedId === instance.id ? "var(--color-link)" : "var(--color-border)",
        background: selectedId === instance.id ? "var(--color-accent-soft)" : "var(--color-surface)"
      }
    },
    /* @__PURE__ */ React4.createElement("strong", null, instance.name),
    /* @__PURE__ */ React4.createElement("div", { style: { fontSize: "0.8rem", color: "var(--color-text-secondary)" } }, instance.base_url)
  ))))), /* @__PURE__ */ React4.createElement("form", { style: { flex: "1 1 320px" }, onSubmit: createInstance }, /* @__PURE__ */ React4.createElement("h5", { style: { margin: "0 0 0.5rem", display: "flex", alignItems: "center", gap: "0.3rem", color: "var(--color-text-primary)" } }, /* @__PURE__ */ React4.createElement("span", { className: "material-symbols-outlined", style: { ...iconStyle3, color: "var(--color-accent)" }, "aria-hidden": true }, "add_business"), "Add instance"), /* @__PURE__ */ React4.createElement(Field2, { label: "Name" }, /* @__PURE__ */ React4.createElement(
    "input",
    {
      className: "tk-input",
      name: "name",
      value: createForm.name,
      onChange: handleCreateChange,
      required: true
    }
  )), /* @__PURE__ */ React4.createElement(Field2, { label: "Base URL" }, /* @__PURE__ */ React4.createElement(
    "input",
    {
      className: "tk-input",
      name: "base_url",
      value: createForm.base_url,
      onChange: handleCreateChange,
      placeholder: "https://zabbix.example.com",
      required: true
    }
  )), /* @__PURE__ */ React4.createElement(Field2, { label: "API Token" }, /* @__PURE__ */ React4.createElement(
    "input",
    {
      className: "tk-input",
      name: "token",
      value: createForm.token,
      onChange: handleCreateChange,
      required: true
    }
  )), /* @__PURE__ */ React4.createElement(Field2, { label: "Description" }, /* @__PURE__ */ React4.createElement(
    "textarea",
    {
      className: "tk-input",
      name: "description",
      value: createForm.description,
      onChange: handleCreateChange,
      rows: 2
    }
  )), /* @__PURE__ */ React4.createElement("label", { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem" } }, /* @__PURE__ */ React4.createElement(
    "input",
    {
      type: "checkbox",
      name: "verify_tls",
      checked: createForm.verify_tls,
      onChange: handleCreateChange
    }
  ), "Verify TLS certificates"), /* @__PURE__ */ React4.createElement("button", { type: "submit", className: "tk-button tk-button--primary", style: { marginTop: "1rem" }, disabled: busy }, /* @__PURE__ */ React4.createElement("span", { className: "material-symbols-outlined", style: { ...iconStyle3, color: "var(--color-accent)" }, "aria-hidden": true }, "add_circle"), "Create"))), feedback && /* @__PURE__ */ React4.createElement("p", { style: { marginTop: "1rem", color: "var(--color-text-secondary)" } }, feedback)), selectedInstance && /* @__PURE__ */ React4.createElement("section", { style: sectionStyle2 }, /* @__PURE__ */ React4.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, /* @__PURE__ */ React4.createElement("div", null, /* @__PURE__ */ React4.createElement("h4", { style: { margin: 0 } }, selectedInstance.name), /* @__PURE__ */ React4.createElement("p", { style: { margin: "0.3rem 0 0", color: "var(--color-text-secondary)" } }, selectedInstance.base_url)), /* @__PURE__ */ React4.createElement("button", { onClick: deleteInstance, disabled: busy, className: "tk-button tk-button--danger" }, /* @__PURE__ */ React4.createElement("span", { className: "material-symbols-outlined", style: { ...iconStyle3, color: "var(--color-danger-border)" }, "aria-hidden": true }, "delete_forever"), "Delete")), /* @__PURE__ */ React4.createElement("h5", { style: { margin: "1rem 0 0.5rem", display: "flex", alignItems: "center", gap: "0.3rem" } }, /* @__PURE__ */ React4.createElement("span", { className: "material-symbols-outlined", style: iconStyle3, "aria-hidden": true }, "tune"), "Instance configuration"), /* @__PURE__ */ React4.createElement("form", { style: { display: "grid", gap: "0.75rem", maxWidth: 420 }, onSubmit: updateInstance }, /* @__PURE__ */ React4.createElement(Field2, { label: "Name" }, /* @__PURE__ */ React4.createElement(
    "input",
    {
      className: "tk-input",
      name: "name",
      value: editForm.name,
      onChange: handleEditChange,
      required: true
    }
  )), /* @__PURE__ */ React4.createElement(Field2, { label: "Base URL" }, /* @__PURE__ */ React4.createElement(
    "input",
    {
      className: "tk-input",
      name: "base_url",
      value: editForm.base_url,
      onChange: handleEditChange,
      required: true
    }
  )), /* @__PURE__ */ React4.createElement(Field2, { label: "Description" }, /* @__PURE__ */ React4.createElement(
    "textarea",
    {
      className: "tk-input",
      name: "description",
      value: editForm.description,
      onChange: handleEditChange,
      rows: 2
    }
  )), /* @__PURE__ */ React4.createElement(Field2, { label: "Update token (optional)" }, /* @__PURE__ */ React4.createElement(
    "input",
    {
      className: "tk-input",
      name: "token",
      value: editForm.token,
      onChange: handleEditChange,
      placeholder: "Leave blank to keep"
    }
  )), /* @__PURE__ */ React4.createElement("label", { style: { display: "flex", alignItems: "center", gap: "0.5rem" } }, /* @__PURE__ */ React4.createElement(
    "input",
    {
      type: "checkbox",
      name: "verify_tls",
      checked: editForm.verify_tls,
      onChange: handleEditChange
    }
  ), "Verify TLS certificates"), /* @__PURE__ */ React4.createElement("button", { type: "submit", className: "tk-button tk-button--primary", disabled: busy }, /* @__PURE__ */ React4.createElement("span", { className: "material-symbols-outlined", style: iconStyle3, "aria-hidden": true }, "save"), "Save changes")), /* @__PURE__ */ React4.createElement("div", { style: { marginTop: "1.5rem", display: "flex", gap: "0.75rem" } }, /* @__PURE__ */ React4.createElement("button", { type: "button", onClick: testInstance, disabled: busy, className: "tk-button" }, /* @__PURE__ */ React4.createElement("span", { className: "material-symbols-outlined", style: { ...iconStyle3, color: "var(--color-accent)" }, "aria-hidden": true }, "network_check"), "Test connection")), actionOutput && /* @__PURE__ */ React4.createElement("div", { style: { marginTop: "1.25rem" } }, /* @__PURE__ */ React4.createElement("strong", null, "Result"), /* @__PURE__ */ React4.createElement("pre", { style: resultStyle2 }, actionOutput))));
}
function Field2({ label, children }) {
  return /* @__PURE__ */ React4.createElement("label", { className: "tk-label", style: { display: "grid", gap: "0.3rem", fontSize: "0.9rem" } }, label, children);
}
var resultStyle2 = {
  background: "var(--color-surface)",
  padding: "0.75rem 1rem",
  borderRadius: 8,
  fontSize: "0.85rem",
  fontFamily: "Source Code Pro, monospace",
  marginTop: "0.4rem",
  overflowX: "auto",
  border: "1px solid var(--color-border)"
};

// ../toolkits/bundled/zabbix/frontend/pages/ZabbixBulkExportPage.tsx
var React5 = getReactRuntime();
var { useEffect: useEffect4, useMemo: useMemo4, useState: useState5 } = React5;
var iconStyle4 = {
  fontSize: "1.1rem",
  lineHeight: 1,
  color: "var(--color-link)"
};
var sectionStyle3 = {
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  padding: "1.25rem",
  background: "var(--color-surface-alt)",
  display: "grid",
  gap: "1rem"
};
var resultStyle3 = {
  background: "var(--color-surface)",
  padding: "0.75rem 1rem",
  borderRadius: 8,
  fontSize: "0.85rem",
  fontFamily: "Source Code Pro, monospace",
  marginTop: "0.4rem",
  overflowX: "auto"
};
var calloutStyle = {
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  padding: "0.75rem 1rem",
  background: "var(--color-surface)",
  color: "var(--color-text-secondary)",
  fontSize: "0.85rem",
  lineHeight: 1.45
};
function ZabbixBulkExportPage() {
  const { instances, selectedId, setSelectedId, selectedInstance, loading: instancesLoading, error: instancesError } = useZabbixInstances();
  const [catalogState, setCatalogState] = useState5({ loading: true, error: null, entries: [] });
  const [selectedTarget, setSelectedTarget] = useState5("");
  const [selectedFormat, setSelectedFormat] = useState5("json");
  const [filterInput, setFilterInput] = useState5("");
  const [preview, setPreview] = useState5(null);
  const [feedback, setFeedback] = useState5(null);
  const [busy, setBusy] = useState5(false);
  const [lastJobMessage, setLastJobMessage] = useState5("");
  useEffect4(() => {
    let cancelled = false;
    async function loadCatalog() {
      setCatalogState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const entries = await apiFetch(
          "/toolkits/zabbix/actions/bulk-export/catalog"
        );
        if (cancelled) return;
        setCatalogState({ loading: false, error: null, entries });
      } catch (err) {
        if (cancelled) return;
        setCatalogState({ loading: false, error: err instanceof Error ? err.message : String(err), entries: [] });
      }
    }
    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect4(() => {
    if (catalogState.loading || catalogState.entries.length === 0) {
      return;
    }
    setSelectedTarget((prev) => {
      if (prev) {
        const stillExists = catalogState.entries.some((entry) => entry.target === prev);
        if (stillExists) {
          return prev;
        }
      }
      const first = catalogState.entries[0];
      return first.target;
    });
  }, [catalogState.entries, catalogState.loading]);
  useEffect4(() => {
    if (!selectedTarget) return;
    const entry = catalogState.entries.find((item) => item.target === selectedTarget);
    if (!entry) return;
    setSelectedFormat(entry.default_format);
    if (entry.default_filters) {
      setFilterInput(JSON.stringify(entry.default_filters, null, 2));
    } else {
      setFilterInput("");
    }
  }, [selectedTarget, catalogState.entries]);
  const selectedCatalogEntry = useMemo4(
    () => catalogState.entries.find((entry) => entry.target === selectedTarget) ?? null,
    [catalogState.entries, selectedTarget]
  );
  const hasInstances = instances.length > 0;
  const filtersLabel = selectedCatalogEntry?.filter_hint || "Optional filter payload (JSON object)";
  const parseFilters = () => {
    if (!filterInput.trim()) {
      return {};
    }
    try {
      const parsed = JSON.parse(filterInput);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed;
      }
      throw new Error("Filters must be a JSON object");
    } catch (err) {
      throw new Error(
        err instanceof Error ? `Unable to parse filters: ${err.message}` : "Unable to parse filters payload"
      );
    }
  };
  const performPreview = async () => {
    if (!selectedInstance) {
      setFeedback("Select an instance first.");
      return;
    }
    if (!selectedTarget) {
      setFeedback("Choose an export target.");
      return;
    }
    setFeedback(null);
    setBusy(true);
    setLastJobMessage("");
    try {
      const filters = parseFilters();
      const response = await apiFetch(
        `/toolkits/zabbix/instances/${selectedInstance.id}/actions/bulk-export/preview`,
        {
          method: "POST",
          body: JSON.stringify({ target: selectedTarget, format: selectedFormat, filters })
        }
      );
      setPreview(response.summary);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err));
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };
  const enqueueExport = async () => {
    if (!selectedInstance) {
      setFeedback("Select an instance first.");
      return;
    }
    if (!selectedTarget) {
      setFeedback("Choose an export target.");
      return;
    }
    setFeedback(null);
    setBusy(true);
    try {
      const filters = parseFilters();
      const response = await apiFetch(
        `/toolkits/zabbix/instances/${selectedInstance.id}/actions/bulk-export/execute`,
        {
          method: "POST",
          body: JSON.stringify({ target: selectedTarget, format: selectedFormat, filters })
        }
      );
      setLastJobMessage(`Job queued with id ${response.job.id}`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ React5.createElement("div", { style: { display: "grid", gap: "1.5rem", color: "var(--color-text-primary)" } }, /* @__PURE__ */ React5.createElement("section", { style: sectionStyle3 }, /* @__PURE__ */ React5.createElement("h4", { style: { margin: 0, display: "flex", alignItems: "center", gap: "0.45rem" } }, /* @__PURE__ */ React5.createElement("span", { className: "material-symbols-outlined", style: iconStyle4, "aria-hidden": true }, "dataset"), "Bulk data exports"), /* @__PURE__ */ React5.createElement("p", { style: { margin: "0.25rem 0 0.75rem", color: "var(--color-text-secondary)" } }, "Generate exports for common Zabbix entities. Preview the dataset shape before queueing asynchronous jobs."), catalogState.loading && /* @__PURE__ */ React5.createElement("p", { style: { color: "var(--color-text-secondary)" } }, "Loading export catalog\u2026"), catalogState.error && /* @__PURE__ */ React5.createElement("p", { style: { color: "var(--color-danger-border)" } }, catalogState.error), instancesLoading && /* @__PURE__ */ React5.createElement("p", { style: { color: "var(--color-text-secondary)" } }, "Loading instances\u2026"), instancesError && /* @__PURE__ */ React5.createElement("p", { style: { color: "var(--color-danger-border)" } }, instancesError), !instancesLoading && !hasInstances && /* @__PURE__ */ React5.createElement("p", { style: { color: "var(--color-text-secondary)" } }, "Define at least one instance under Administration."), hasInstances && catalogState.entries.length > 0 && /* @__PURE__ */ React5.createElement("div", { style: { display: "grid", gap: "1.25rem" } }, /* @__PURE__ */ React5.createElement("label", { className: "tk-label", style: { display: "grid", gap: "0.3rem", fontSize: "0.9rem", maxWidth: 340 } }, "Target instance", /* @__PURE__ */ React5.createElement(
    "select",
    {
      className: "tk-input",
      value: selectedId,
      onChange: (event) => setSelectedId(event.target.value)
    },
    instances.map((instance) => /* @__PURE__ */ React5.createElement("option", { value: instance.id, key: instance.id }, instance.name))
  )), /* @__PURE__ */ React5.createElement("div", { style: { display: "grid", gap: "0.75rem" } }, /* @__PURE__ */ React5.createElement("label", { className: "tk-label", style: { display: "grid", gap: "0.3rem" } }, "Export target", /* @__PURE__ */ React5.createElement(
    "select",
    {
      className: "tk-input",
      value: selectedTarget,
      onChange: (event) => setSelectedTarget(event.target.value)
    },
    catalogState.entries.map((entry) => /* @__PURE__ */ React5.createElement("option", { key: entry.target, value: entry.target }, entry.label))
  )), selectedCatalogEntry && /* @__PURE__ */ React5.createElement("div", { style: calloutStyle }, /* @__PURE__ */ React5.createElement("strong", { style: { display: "block", marginBottom: "0.25rem", color: "var(--color-text-primary)" } }, selectedCatalogEntry.label), /* @__PURE__ */ React5.createElement("span", null, selectedCatalogEntry.description), selectedCatalogEntry.notes && /* @__PURE__ */ React5.createElement("span", { style: { display: "block", marginTop: "0.4rem" } }, selectedCatalogEntry.notes)), /* @__PURE__ */ React5.createElement("label", { className: "tk-label", style: { display: "grid", gap: "0.3rem", maxWidth: 240 } }, "Output format", /* @__PURE__ */ React5.createElement(
    "select",
    {
      className: "tk-input",
      value: selectedFormat,
      onChange: (event) => setSelectedFormat(event.target.value)
    },
    selectedCatalogEntry?.supported_formats.map((format) => /* @__PURE__ */ React5.createElement("option", { value: format, key: format }, format.toUpperCase())) ?? null
  )), /* @__PURE__ */ React5.createElement("label", { className: "tk-label", style: { display: "grid", gap: "0.3rem" } }, filtersLabel, /* @__PURE__ */ React5.createElement(
    "textarea",
    {
      className: "tk-input",
      rows: selectedCatalogEntry?.default_filters ? 6 : 4,
      value: filterInput,
      onChange: (event) => setFilterInput(event.target.value),
      placeholder: '{\n  "status": 0\n}'
    }
  )), /* @__PURE__ */ React5.createElement("div", { style: { display: "flex", gap: "0.75rem", flexWrap: "wrap" } }, /* @__PURE__ */ React5.createElement("button", { type: "button", className: "tk-button", onClick: performPreview, disabled: busy }, /* @__PURE__ */ React5.createElement("span", { className: "material-symbols-outlined", style: iconStyle4, "aria-hidden": true }, "preview"), "Preview dataset"), /* @__PURE__ */ React5.createElement("button", { type: "button", className: "tk-button tk-button--primary", onClick: enqueueExport, disabled: busy }, /* @__PURE__ */ React5.createElement("span", { className: "material-symbols-outlined", style: { ...iconStyle4, color: "var(--color-accent)" }, "aria-hidden": true }, "cloud_upload"), "Queue export job")), feedback && /* @__PURE__ */ React5.createElement("p", { style: { color: "var(--color-text-secondary)" } }, feedback), lastJobMessage && /* @__PURE__ */ React5.createElement("p", { style: { color: "var(--color-text-secondary)" } }, lastJobMessage)))), preview && /* @__PURE__ */ React5.createElement("section", { style: sectionStyle3 }, /* @__PURE__ */ React5.createElement("h4", { style: { margin: 0, display: "flex", alignItems: "center", gap: "0.4rem" } }, /* @__PURE__ */ React5.createElement("span", { className: "material-symbols-outlined", style: iconStyle4, "aria-hidden": true }, "dataset_linked"), "Preview summary"), /* @__PURE__ */ React5.createElement("div", { style: { display: "grid", gap: "0.4rem", color: "var(--color-text-secondary)", fontSize: "0.9rem" } }, /* @__PURE__ */ React5.createElement("div", null, /* @__PURE__ */ React5.createElement("strong", { style: { color: "var(--color-text-primary)" } }, "Target:"), " ", preview.target), /* @__PURE__ */ React5.createElement("div", null, /* @__PURE__ */ React5.createElement("strong", { style: { color: "var(--color-text-primary)" } }, "Format:"), " ", preview.format.toUpperCase()), /* @__PURE__ */ React5.createElement("div", null, /* @__PURE__ */ React5.createElement("strong", { style: { color: "var(--color-text-primary)" } }, "Estimated records:"), " ", preview.estimated_records), preview.filters_applied && /* @__PURE__ */ React5.createElement("div", null, /* @__PURE__ */ React5.createElement("strong", { style: { color: "var(--color-text-primary)" } }, "Filters:"), /* @__PURE__ */ React5.createElement("pre", { style: resultStyle3 }, JSON.stringify(preview.filters_applied, null, 2))), preview.notes && /* @__PURE__ */ React5.createElement("div", null, preview.notes)), /* @__PURE__ */ React5.createElement("div", null, /* @__PURE__ */ React5.createElement("h5", { style: { margin: "0.75rem 0 0.3rem" } }, "Sample fields"), /* @__PURE__ */ React5.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "0.3rem" } }, preview.sample_fields.map((field) => /* @__PURE__ */ React5.createElement("span", { key: field, className: "tk-tag" }, field)))), preview.sample_rows.length > 0 && /* @__PURE__ */ React5.createElement("div", null, /* @__PURE__ */ React5.createElement("h5", { style: { margin: "0.75rem 0 0.3rem" } }, "Sample rows"), /* @__PURE__ */ React5.createElement("pre", { style: resultStyle3 }, JSON.stringify(preview.sample_rows, null, 2)))));
}

// ../toolkits/bundled/zabbix/frontend/pages/ZabbixDbScriptsPage.tsx
var React6 = getReactRuntime();
var { useEffect: useEffect5, useMemo: useMemo5, useState: useState6 } = React6;
var iconStyle5 = {
  fontSize: "1.1rem",
  lineHeight: 1,
  color: "var(--color-link)"
};
var sectionStyle4 = {
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  padding: "1.25rem",
  background: "var(--color-surface-alt)",
  display: "grid",
  gap: "1rem"
};
var previewStyle = {
  background: "var(--color-surface)",
  padding: "0.75rem 1rem",
  borderRadius: 8,
  fontSize: "0.85rem",
  fontFamily: "Source Code Pro, monospace",
  marginTop: "0.4rem",
  overflowX: "auto"
};
var dangerSwatch = {
  info: "var(--color-tag-bg)",
  warning: "rgba(250, 204, 21, 0.22)",
  danger: "rgba(239, 68, 68, 0.25)"
};
function ZabbixDbScriptsPage() {
  const { instances, selectedId, setSelectedId, selectedInstance, loading: instancesLoading, error: instancesError } = useZabbixInstances();
  const [scriptsState, setScriptsState] = useState6({ loading: true, error: null, scripts: [] });
  const [selectedKey, setSelectedKey] = useState6("");
  const [formValues, setFormValues] = useState6({});
  const [executionState, setExecutionState] = useState6({
    busy: false,
    feedback: null,
    lastJob: null,
    preview: null
  });
  useEffect5(() => {
    let cancelled = false;
    async function loadScripts() {
      setScriptsState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const scripts = await apiFetch("/toolkits/zabbix/db-scripts");
        if (cancelled) return;
        setScriptsState({ loading: false, error: null, scripts });
      } catch (err) {
        if (cancelled) return;
        setScriptsState({ loading: false, error: err instanceof Error ? err.message : String(err), scripts: [] });
      }
    }
    loadScripts();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect5(() => {
    if (scriptsState.loading || scriptsState.scripts.length === 0) {
      return;
    }
    setSelectedKey((prev) => {
      if (prev && scriptsState.scripts.some((script) => script.key === prev)) {
        return prev;
      }
      return scriptsState.scripts[0].key;
    });
  }, [scriptsState.loading, scriptsState.scripts]);
  const selectedScript = useMemo5(
    () => scriptsState.scripts.find((script) => script.key === selectedKey) ?? null,
    [scriptsState.scripts, selectedKey]
  );
  useEffect5(() => {
    if (!selectedScript) {
      setFormValues({});
      return;
    }
    const defaults = Object.fromEntries(selectedScript.inputs.map((input) => [input.name, input.default ?? ""]));
    setFormValues(defaults);
  }, [selectedScript]);
  const updateFormValue = (name, value) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };
  const validateForm = () => {
    if (!selectedScript) {
      return "Select a script to continue.";
    }
    for (const input of selectedScript.inputs) {
      if (input.required && !formValues[input.name]) {
        return `Field "${input.label}" is required.`;
      }
    }
    return null;
  };
  const runScript = async (dryRun) => {
    if (!selectedInstance) {
      setExecutionState((prev) => ({ ...prev, feedback: "Select an instance first." }));
      return;
    }
    const validationError = validateForm();
    if (validationError) {
      setExecutionState((prev) => ({ ...prev, feedback: validationError }));
      return;
    }
    if (!selectedScript) {
      setExecutionState((prev) => ({ ...prev, feedback: "Select a script to continue." }));
      return;
    }
    setExecutionState({ busy: true, feedback: null, lastJob: null, preview: null });
    try {
      const payload = {
        inputs: formValues,
        dry_run: dryRun
      };
      const response = await apiFetch(
        `/toolkits/zabbix/instances/${selectedInstance.id}/actions/db-scripts/${selectedScript.key}/execute`,
        {
          method: "POST",
          body: JSON.stringify(payload)
        }
      );
      if (dryRun && response.preview) {
        setExecutionState({ busy: false, feedback: response.message ?? null, lastJob: null, preview: response.preview });
        return;
      }
      if (response.job) {
        setExecutionState({ busy: false, feedback: response.message ?? `Job queued with id ${response.job.id}`, lastJob: response.job, preview: null });
        return;
      }
      setExecutionState({ busy: false, feedback: response.message ?? "Script executed.", lastJob: null, preview: response.preview ?? null });
    } catch (err) {
      setExecutionState({ busy: false, feedback: err instanceof Error ? err.message : String(err), lastJob: null, preview: null });
    }
  };
  return /* @__PURE__ */ React6.createElement("div", { style: { display: "grid", gap: "1.5rem", color: "var(--color-text-primary)" } }, /* @__PURE__ */ React6.createElement("section", { style: sectionStyle4 }, /* @__PURE__ */ React6.createElement("h4", { style: { margin: 0, display: "flex", alignItems: "center", gap: "0.45rem" } }, /* @__PURE__ */ React6.createElement("span", { className: "material-symbols-outlined", style: iconStyle5, "aria-hidden": true }, "playlist_add_check"), "Database scripts"), /* @__PURE__ */ React6.createElement("p", { style: { margin: "0.25rem 0 0.75rem", color: "var(--color-text-secondary)" } }, "Execute vetted SQL maintenance scripts against your Zabbix database. Always dry-run first when available."), scriptsState.loading && /* @__PURE__ */ React6.createElement("p", { style: { color: "var(--color-text-secondary)" } }, "Loading script catalog\u2026"), scriptsState.error && /* @__PURE__ */ React6.createElement("p", { style: { color: "var(--color-danger-border)" } }, scriptsState.error), instancesLoading && /* @__PURE__ */ React6.createElement("p", { style: { color: "var(--color-text-secondary)" } }, "Loading instances\u2026"), instancesError && /* @__PURE__ */ React6.createElement("p", { style: { color: "var(--color-danger-border)" } }, instancesError), instances.length === 0 && !instancesLoading && /* @__PURE__ */ React6.createElement("p", { style: { color: "var(--color-text-secondary)" } }, "Define at least one instance under Administration."), instances.length > 0 && scriptsState.scripts.length > 0 && /* @__PURE__ */ React6.createElement("div", { style: { display: "grid", gap: "1.25rem" } }, /* @__PURE__ */ React6.createElement("label", { className: "tk-label", style: { display: "grid", gap: "0.3rem", fontSize: "0.9rem", maxWidth: 340 } }, "Target instance", /* @__PURE__ */ React6.createElement("select", { className: "tk-input", value: selectedId, onChange: (event) => setSelectedId(event.target.value) }, instances.map((instance) => /* @__PURE__ */ React6.createElement("option", { value: instance.id, key: instance.id }, instance.name)))), /* @__PURE__ */ React6.createElement("div", { style: { display: "grid", gap: "0.75rem" } }, /* @__PURE__ */ React6.createElement("label", { className: "tk-label", style: { display: "grid", gap: "0.3rem" } }, "Script", /* @__PURE__ */ React6.createElement(
    "select",
    {
      className: "tk-input",
      value: selectedKey,
      onChange: (event) => setSelectedKey(event.target.value)
    },
    scriptsState.scripts.map((script) => /* @__PURE__ */ React6.createElement("option", { key: script.key, value: script.key }, script.name))
  )), selectedScript && /* @__PURE__ */ React6.createElement(
    "div",
    {
      style: {
        border: `1px solid var(--color-border)`,
        borderRadius: 8,
        padding: "0.85rem 1rem",
        background: "var(--color-surface)",
        display: "grid",
        gap: "0.35rem",
        fontSize: "0.9rem"
      }
    },
    /* @__PURE__ */ React6.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } }, /* @__PURE__ */ React6.createElement("strong", { style: { color: "var(--color-text-primary)" } }, selectedScript.name), /* @__PURE__ */ React6.createElement(
      "span",
      {
        className: "tk-tag",
        style: {
          background: dangerSwatch[selectedScript.danger_level],
          color: "var(--color-text-primary)"
        }
      },
      selectedScript.danger_level.toUpperCase()
    )),
    /* @__PURE__ */ React6.createElement("span", { style: { color: "var(--color-text-secondary)" } }, selectedScript.description),
    selectedScript.documentation && /* @__PURE__ */ React6.createElement("span", { style: { color: "var(--color-text-secondary)" } }, selectedScript.documentation)
  ), selectedScript && /* @__PURE__ */ React6.createElement("div", { style: { display: "grid", gap: "0.75rem" } }, selectedScript.inputs.map((input) => /* @__PURE__ */ React6.createElement(Field3, { key: input.name, label: input.label, required: input.required, helpText: input.help_text }, renderInput(input, formValues[input.name] ?? "", updateFormValue)))), /* @__PURE__ */ React6.createElement("div", { style: { display: "flex", gap: "0.75rem", flexWrap: "wrap" } }, /* @__PURE__ */ React6.createElement("button", { type: "button", className: "tk-button", disabled: executionState.busy, onClick: () => runScript(true) }, /* @__PURE__ */ React6.createElement("span", { className: "material-symbols-outlined", style: iconStyle5, "aria-hidden": true }, "visibility"), "Dry run"), /* @__PURE__ */ React6.createElement("button", { type: "button", className: "tk-button tk-button--primary", disabled: executionState.busy, onClick: () => runScript(false) }, /* @__PURE__ */ React6.createElement("span", { className: "material-symbols-outlined", style: { ...iconStyle5, color: "var(--color-accent)" }, "aria-hidden": true }, "play_circle"), "Execute script")), executionState.feedback && /* @__PURE__ */ React6.createElement("p", { style: { color: "var(--color-text-secondary)" } }, executionState.feedback), executionState.lastJob && /* @__PURE__ */ React6.createElement("p", { style: { color: "var(--color-text-secondary)" } }, "Job queued with id ", executionState.lastJob.id, " \u2014 monitor progress in Jobs.")))), executionState.preview && /* @__PURE__ */ React6.createElement("section", { style: sectionStyle4 }, /* @__PURE__ */ React6.createElement("h4", { style: { margin: 0, display: "flex", alignItems: "center", gap: "0.4rem" } }, /* @__PURE__ */ React6.createElement("span", { className: "material-symbols-outlined", style: iconStyle5, "aria-hidden": true }, "task"), "Dry run summary"), /* @__PURE__ */ React6.createElement("p", { style: { color: "var(--color-text-secondary)" } }, executionState.preview.summary), executionState.preview.statements.length > 0 && /* @__PURE__ */ React6.createElement("pre", { style: previewStyle }, executionState.preview.statements.join("\n"))));
}
function Field3({
  label,
  required,
  helpText,
  children
}) {
  return /* @__PURE__ */ React6.createElement("label", { className: "tk-label", style: { display: "grid", gap: "0.3rem", fontSize: "0.9rem" } }, /* @__PURE__ */ React6.createElement("span", null, label, required ? " *" : ""), children, helpText && /* @__PURE__ */ React6.createElement("small", { style: { color: "var(--color-text-secondary)" } }, helpText));
}
function renderInput(input, value, update) {
  if (input.type === "textarea") {
    return /* @__PURE__ */ React6.createElement(
      "textarea",
      {
        className: "tk-input",
        rows: input.placeholder ? 4 : 3,
        placeholder: input.placeholder,
        value,
        onChange: (event) => update(input.name, event.target.value)
      }
    );
  }
  if (input.type === "select" && input.options) {
    return /* @__PURE__ */ React6.createElement(
      "select",
      {
        className: "tk-input",
        value,
        onChange: (event) => update(input.name, event.target.value)
      },
      /* @__PURE__ */ React6.createElement("option", { value: "" }, "Select\u2026"),
      input.options.map((option) => /* @__PURE__ */ React6.createElement("option", { key: option.value, value: option.value }, option.label))
    );
  }
  return /* @__PURE__ */ React6.createElement(
    "input",
    {
      className: "tk-input",
      placeholder: input.placeholder,
      value,
      onChange: (event) => update(input.name, event.target.value)
    }
  );
}

// ../toolkits/bundled/zabbix/frontend/index.tsx
var React7 = getReactRuntime();
var ReactRouterDom = getReactRouterRuntime();
var { NavLink, Navigate, Route, Routes } = ReactRouterDom;
var toolkitStyles = {
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
var iconStyle6 = {
  fontSize: "1.15rem",
  lineHeight: 1,
  color: "var(--color-link)"
};
var subNav = [
  { label: "Overview", to: "", icon: "dashboard" },
  { label: "Administration", to: "administration", icon: "settings_applications" },
  { label: "Bulk Host Actions", to: "actions/bulk-hosts", icon: "group_add" },
  { label: "Bulk Exports", to: "actions/bulk-export", icon: "dataset" },
  { label: "Database Scripts", to: "actions/db-scripts", icon: "playlist_add_check" }
];
function ZabbixToolkitLayout() {
  return /* @__PURE__ */ React7.createElement("div", { className: "tk-card", style: toolkitStyles.wrapper }, /* @__PURE__ */ React7.createElement("header", null, /* @__PURE__ */ React7.createElement("h3", { style: { margin: 0, display: "flex", alignItems: "center", gap: "0.45rem" } }, /* @__PURE__ */ React7.createElement("span", { className: "material-symbols-outlined", style: iconStyle6, "aria-hidden": true }, "hub"), "Zabbix Toolkit"), /* @__PURE__ */ React7.createElement("p", { style: { margin: "0.3rem 0 0", color: "var(--color-text-secondary)" } }, "Manage Zabbix API endpoints, toolkit settings, and automation actions.")), /* @__PURE__ */ React7.createElement("nav", { style: toolkitStyles.nav }, subNav.map((item) => /* @__PURE__ */ React7.createElement(
    NavLink,
    {
      key: item.label,
      to: item.to,
      end: item.to === "",
      style: ({ isActive }) => toolkitStyles.navLink(isActive)
    },
    /* @__PURE__ */ React7.createElement("span", { className: "material-symbols-outlined", style: iconStyle6, "aria-hidden": true }, item.icon),
    item.label
  ))), /* @__PURE__ */ React7.createElement("section", null, /* @__PURE__ */ React7.createElement(Routes, null, /* @__PURE__ */ React7.createElement(Route, { index: true, element: /* @__PURE__ */ React7.createElement(ZabbixOverviewPage, null) }), /* @__PURE__ */ React7.createElement(Route, { path: "administration", element: /* @__PURE__ */ React7.createElement(ZabbixAdministrationPage, null) }), /* @__PURE__ */ React7.createElement(Route, { path: "actions/bulk-hosts", element: /* @__PURE__ */ React7.createElement(ZabbixBulkHostsPage, null) }), /* @__PURE__ */ React7.createElement(Route, { path: "actions/bulk-export", element: /* @__PURE__ */ React7.createElement(ZabbixBulkExportPage, null) }), /* @__PURE__ */ React7.createElement(Route, { path: "actions/db-scripts", element: /* @__PURE__ */ React7.createElement(ZabbixDbScriptsPage, null) }), /* @__PURE__ */ React7.createElement(Route, { path: "*", element: /* @__PURE__ */ React7.createElement(Navigate, { to: ".", replace: true }) }))));
}
export {
  ZabbixToolkitLayout as default
};
