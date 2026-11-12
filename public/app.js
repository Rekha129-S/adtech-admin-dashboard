"use strict";

if (typeof document !== "undefined") {

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const PAGE = 8, TK = "adtech-token";
const inr = n => "₹" + Number(n || 0).toLocaleString("en-IN");
const pd = v => /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + "T00:00:00") : new Date(v);
const fdate = v => { const d = pd(v); return isNaN(d) ? esc(v) : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); };
const fdt = v => { const d = new Date(v); return isNaN(d) ? "" : d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }); };
const ago = v => { const m = Math.floor((Date.now() - new Date(v)) / 60000); if (isNaN(m)) return "-"; if (m < 1) return "Just now"; if (m < 60) return m + " min ago"; const h = Math.floor(m / 60); return h < 24 ? h + " hr ago" : Math.floor(h / 24) + " d ago"; };
const initials = s => String(s || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");

/* ---------- Icons ---------- */
const ICONS = {
  home: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.8.7 3 2.4 3.3 5"/>',
  mega: '<path d="M3 10v4h4l8 5V5L7 10z"/><path d="M18.5 9a4 4 0 0 1 0 6"/>',
  idcard: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.5-1.5 1.7-2 3-2s2.5.5 3 2M14 10h4M14 13h3"/>',
  car: '<path d="M4 17v-5l2-5h12l2 5v5z"/><path d="M4 12h16"/><circle cx="8" cy="17" r="1.6"/><circle cx="16" cy="17" r="1.6"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>',
  radio: '<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/>',
  bars: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  life: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M5.6 5.6l3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  logout: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15zM10 21h4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  chev: '<path d="M14 6l-6 6 6 6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  back: '<path d="M10 6l-6 6 6 6M4 12h16"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  login: '<path d="M14 4h5v16h-5M9 8l-4 4 4 4M5 12h10"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  pin: '<path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>'
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`;

/* ---------- State + API ---------- */
let token = null; try { token = localStorage.getItem(TK); } catch (e) { /* no storage */ }
let ME = null, D = {}, META = { areas: [] }, PORTAL = "admin", cur = "dashboard", VIEW = null, ADMIN_D = null; /* VIEW = client whose portal an admin is previewing (view-only) */
async function API(method, url, body) {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j = {}; try { j = await r.json(); } catch (e) { /* empty body */ }
  if (r.status === 401 && token) { logout(); toast("Session expired. Please sign in again."); }
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
}
async function refresh() {
  const r = await API("GET", "/api/bootstrap");
  ME = r.me; PORTAL = ME.portal; META.areas = r.areas; D = r.data;
  Object.keys(S).forEach(k => { D[k] = D[k] || []; });
}
const toast = m => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 2400); };

/* ---------- Schema: f = [key, label, type | options | options()] ---------- */
const ST = ["Active", "Inactive"], APP = ["Approved", "Pending", "Rejected"];
const vehOpts = () => D.vehicles.map(v => v.no), advOpts = () => D.advertisers.map(a => a.name);
const today = () => new Date().toISOString().slice(0, 10);
const S = {
  users: { t: "Users & Roles", add: "Add user", def: { status: "Active", role: "Manager" }, f: [["name", "Name"], ["email", "Email", "email"], ["role", "Role", ["Super Admin", "Admin", "Manager", "Viewer", "Support"]], ["status", "Status", ST], ["password", "Password", "password"]] },
  advertisers: { t: "Advertisers", add: "Add advertiser", def: { status: "Approved" }, f: [["name", "Business name"], ["email", "Login email", "email"], ["status", "Status", APP], ["password", "Password", "password"]] },
  partners: { t: "Drivers & Partners", add: "Add partner", def: { status: "Active" }, f: [["name", "Name"], ["phone", "Phone", "tel"], ["vehicle", "Vehicle no.", vehOpts], ["status", "Status", ["Active", "Pending", "Inactive"]]] },
  vehicles: { t: "Vehicles", add: "Add vehicle", def: { status: "Active" }, f: [["no", "Vehicle no."], ["owner", "Owner name"], ["area", "Area (Bengaluru)", () => META.areas], ["status", "Status", ST]] },
  devices: { t: "Devices", add: "Register device", def: { status: "Online" }, f: [["dev", "Device ID"], ["vehicle", "Vehicle no.", vehOpts], ["status", "Status", ["Online", "Offline", "Maintenance"]], ["seen", "Last seen", "ago"]] },
  campaigns: { t: "Campaigns", add: "Create campaign", def: { status: "Pending" }, tabs: ["All", "Pending", "Approved", "Rejected"], tabKey: "status", f: [["name", "Campaign name"], ["adv", "Advertiser", advOpts], ["start", "Start date", "date"], ["end", "End date", "date"], ["status", "Status", APP]] },
  inventory: { t: "Inventory & Pricing", add: "Add package", def: { status: "Active" }, f: [["name", "Package name"], ["dur", "Duration", ["1 week", "1 month", "3 months", "6 months", "1 year"]], ["price", "Price (₹)", "money"], ["status", "Status", ST]] },
  billing: { t: "Billing & Payments", add: "Add transaction", def: { status: "Pending", type: "Transactions" }, tabs: ["Transactions", "Invoices", "Payouts"], tabKey: "type", tabsOnly: 1, export: 1, f: [["date", "Date", "date"], ["desc", "Description"], ["adv", "Advertiser", () => ["Platform", ...advOpts()]], ["amount", "Amount (₹)", "money"], ["type", "Type", ["Transactions", "Invoices", "Payouts"]], ["status", "Status", ["Paid", "Pending", "Failed"]]] },
  support: { t: "Support", add: "New ticket", def: { status: "Open", prio: "Medium" }, f: [["subj", "Subject"], ["user", "User"], ["prio", "Priority", ["High", "Medium", "Low"]], ["status", "Status", ["Open", "In progress", "Resolved", "Closed"]]] },
  audit: { t: "Audit Logs", ro: 1, f: [["action", "Action"], ["user", "User"], ["at", "Date & time", "datetime"], ["ip", "IP address"]] }
};
const LABEL = { clientlogins: "Client Logins", dashboard: "Dashboard", live: "Live Monitoring", analytics: "Analytics & Reports", settings: "Settings" };
const CT = { campaigns: "My Campaigns", inventory: "Ad Packages", billing: "Billing & Invoices", support: "Support" };
const title = k => (PORTAL === "client" && CT[k]) || (S[k] && S[k].t) || LABEL[k];
const ICON = { clientlogins: "login", dashboard: "home", users: "users", advertisers: "mega", partners: "idcard", vehicles: "car", devices: "monitor", campaigns: "flag", inventory: "tag", live: "radio", analytics: "bars", billing: "card", settings: "sliders", support: "life", audit: "shield" };
const GROUPS = {
  admin: [["Overview", ["dashboard", "clientlogins"]], ["Management", ["users", "advertisers", "partners", "vehicles", "devices"]], ["Advertising", ["campaigns", "inventory", "live", "analytics"]], ["Finance", ["billing"]], ["System", ["settings", "support", "audit"]]],
  client: [["Overview", ["dashboard"]], ["Advertising", ["campaigns", "inventory"]], ["Finance", ["billing"]], ["Help", ["support"]]]
};
const HIDECOL = { billing: ["adv"], campaigns: ["adv"], support: ["user"] }, FORMHIDE = { campaigns: ["adv", "status"], support: ["user", "status"] };
const vis = k => S[k].f.filter(f => f[2] !== "password" && !(PORTAL === "client" && (HIDECOL[k] || []).includes(f[0])));
const AV = ["users", "advertisers", "partners"];

/* ---------- Permissions (the server enforces these too) ---------- */
const canAdd = k => { if (S[k].ro || VIEW) return false; if (PORTAL === "client") return k === "campaigns" || k === "support"; if (ME.role === "Viewer") return false; return k !== "users" || ["Super Admin", "Admin"].includes(ME.role); };
const canRow = (k, r) => VIEW ? false : PORTAL === "client" ? k === "campaigns" && r.status === "Pending" : canAdd(k);

/* ---------- Cells ---------- */
const OK = ["Active", "Approved", "Online", "Paid", "Resolved"], WARN = ["Pending", "Maintenance", "Medium", "In progress"], BAD = ["Inactive", "Offline", "Rejected", "High", "Failed"];
const badge = v => `<span class="b ${OK.includes(v) ? "ok" : WARN.includes(v) ? "warn" : BAD.includes(v) ? "bad" : ""}">${esc(v)}</span>`;
const cell = (f, r) => {
  const [key, , type] = f, v = r[key];
  if (type === "date") return fdate(v); if (type === "datetime") return fdt(v); if (type === "money") return inr(v); if (type === "ago") return ago(r.lastSeenAt);
  return ["status", "role", "prio"].includes(key) ? badge(v) : esc(v);
};
const SI = { "Revenue (paid)": "card", "Total campaigns": "flag", "Active devices": "monitor", "Active partners": "idcard", Impressions: "bars", Clicks: "radio", CTR: "flag", Revenue: "card", "My campaigns": "flag", Approved: "shield", "Pending review": "bell", "Total paid": "card" };
const stat = (l, v) => `<div class="card stat"><div class="si">${ic(SI[l] || "bars")}</div><div><small>${l}</small><strong>${v}</strong></div></div>`;

/* ---------- Modal ---------- */
let lastFocus;
function openModal(html) { lastFocus = document.activeElement; $("#modal").innerHTML = html; $("#mbg").classList.add("on"); const i = $("#modal input,#modal select,#modal button"); if (i) i.focus(); }
function closeModal() { $("#mbg").classList.remove("on"); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
$("#mbg").addEventListener("mousedown", e => { if (e.target.id === "mbg") closeModal(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeModal(); closeDrawer(); } });

function formModal(k, row) {
  const s = S[k], isNew = !row, hid = PORTAL === "client" ? (FORMHIDE[k] || []) : [];
  const fields = s.f.filter(f => f[2] !== "ago" && !hid.includes(f[0])).map(([key, label, type]) => {
    let val = row ? row[key] : (s.def && s.def[key]) ?? ""; if (!row && key === "date") val = today();
    const opts = typeof type === "function" ? type() : type;
    if (Array.isArray(opts)) return `<label for="f_${key}">${label}</label><select id="f_${key}" name="${key}" required>${isNew && !val ? `<option value="">Select…</option>` : ""}${opts.map(o => `<option ${o === val ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
    if (type === "password") return `<label for="f_${key}">${label}</label><input id="f_${key}" name="${key}" type="password" autocomplete="new-password" ${isNew ? "required" : ""} minlength="6" placeholder="${isNew ? "Minimum 6 characters" : "Leave blank to keep current"}">`;
    return `<label for="f_${key}">${label}</label><input id="f_${key}" name="${key}" type="${type === "money" ? "number" : type || "text"}" ${type === "money" ? 'min="0" step="1"' : ""} value="${esc(val)}" required>`;
  }).join("");
  openModal(`<h3>${isNew ? s.add : "Edit record"}</h3><form id="mf">${fields}<div class="merr" id="merr" role="alert"></div><div class="row"><button type="button" class="btn ghost" id="cx">Cancel</button><button class="btn" id="msave">${isNew ? "Add" : "Save"}</button></div></form>`);
  $("#cx").onclick = closeModal;
  $("#mf").onsubmit = async e => {
    e.preventDefault();
    const o = {};
    s.f.forEach(([key, , type]) => { const el = e.target.elements[key]; if (!el) return; let v = el.value.trim(); if (type === "password" && !v) return; o[key] = type === "money" ? Number(v) : v; });
    $("#msave").disabled = true;
    try {
      await API(isNew ? "POST" : "PUT", isNew ? `/api/${k}` : `/api/${k}/${row.id}`, o);
      await refresh(); closeModal(); toast(isNew ? "Added successfully" : "Changes saved"); if (isNew) P[k].page = 1; go(cur);
    } catch (err) { $("#merr").textContent = err.message; $("#msave").disabled = false; }
  };
}
function confirmDelete(k, row) {
  openModal(`<h3>Delete record?</h3><p>"${esc(row[S[k].f[0][0]])}" will be removed permanently.</p><div class="merr" id="merr"></div><div class="row"><button class="btn ghost" id="cx">Cancel</button><button class="btn danger" id="ok">Delete</button></div>`);
  $("#cx").onclick = closeModal;
  $("#ok").onclick = async () => { try { await API("DELETE", `/api/${k}/${row.id}`); await refresh(); closeModal(); toast("Deleted"); go(cur); } catch (err) { $("#merr").textContent = err.message; } };
}
async function setStatus(k, r, status) {
  const o = {}; S[k].f.forEach(f => { if (f[2] !== "password" && f[2] !== "ago") o[f[0]] = r[f[0]]; }); o.status = status;
  try { await API("PUT", `/api/${k}/${r.id}`, o); await refresh(); toast("Marked " + status.toLowerCase()); go(cur); } catch (e) { toast(e.message); }
}

/* ---------- Detail drawer (opens when a row is clicked) ---------- */
const relList = (t, items) => `<div class="sec"><h4>${t}</h4>${items.length ? items.map(([a, b]) => `<div class="kv"><span>${a}</span><b>${b}</b></div>`).join("") : `<p class="muted">Nothing linked yet.</p>`}</div>`;
const REL = {
  users: r => relList("Recent activity", D.audit.filter(a => a.user === r.name).slice(0, 6).map(a => [esc(a.action), fdt(a.at)])),
  advertisers: r => { const cs = D.campaigns.filter(c => c.adv === r.name), paid = D.billing.filter(b => b.adv === r.name && b.status === "Paid" && b.type !== "Payouts").reduce((a, b) => a + b.amount, 0); return relList("Summary", [["Campaigns", cs.length], ["Total paid", inr(paid)]]) + relList("Campaigns", cs.map(c => [esc(c.name), badge(c.status)])); },
  partners: r => { const v = D.vehicles.find(x => x.no === r.vehicle), d = D.devices.find(x => x.vehicle === r.vehicle); return relList("Assigned vehicle", v ? [["Vehicle no.", esc(v.no)], ["Area", esc(v.area)], ["Vehicle status", badge(v.status)]] : []) + relList("Device", d ? [["Device ID", esc(d.dev)], ["Status", badge(d.status)], ["Last seen", ago(d.lastSeenAt)]] : []); },
  vehicles: r => relList("Driver / partner", D.partners.filter(x => x.vehicle === r.no).map(x => [esc(x.name), esc(x.phone)])) + relList("Devices", D.devices.filter(x => x.vehicle === r.no).map(x => [esc(x.dev), badge(x.status)])),
  devices: r => { const v = D.vehicles.find(x => x.no === r.vehicle) || {}; return relList("Vehicle", [["Owner", esc(v.owner || "-")], ["Home area", esc(v.area || "-")]]) + relList("Last known location", [["Coordinates", `${Number(r.lat).toFixed(4)}, ${Number(r.lng).toFixed(4)}`]]) + `<button class="btn ghost" id="dl">${ic("pin")}View on live map</button>`; },
  campaigns: r => relList("Schedule", [["Duration", Math.max(1, Math.round((pd(r.end) - pd(r.start)) / 864e5) + 1) + " days"], ["Devices online now", r.status === "Approved" ? D.devices.filter(d => d.status === "Online").length : 0]])
};
function openDetail(k, id) {
  const r = D[k].find(x => x.id === id); if (!r) return;
  const s = S[k], main = r[s.f[0][0]];
  const rows = vis(k).map(f => `<div class="kv"><span>${f[1]}</span><b>${cell(f, r)}</b></div>`).join("") + `<div class="kv"><span>Record ID</span><b>${k === "support" ? "#" + (1000 + r.id) : "#" + r.id}</b></div>` + (r.created ? `<div class="kv"><span>Created</span><b>${fdate(r.created)}</b></div>` : "");
  $("#drawer").innerHTML = `<div class="dh"><div class="nm"><span class="ini lg">${esc(initials(main))}</span><div>${esc(main)}<small>${title(k)}</small></div></div><button class="ib" id="dx" aria-label="Close details">${ic("x")}</button></div>
  <div class="db">${r.status ? `<div style="margin-bottom:16px">${badge(r.status)}</div>` : ""}<div class="sec"><h4>Details</h4>${rows}</div>${REL[k] && PORTAL === "admin" ? REL[k](r) : ""}</div>
  <div class="df">${PORTAL === "admin" && k === "advertisers" ? `<button class="btn" id="dv">${ic("eye")}View client portal</button>` : ""}${canRow(k, r) ? `<button class="btn ghost" id="de">${ic("edit")}Edit</button><button class="btn danger" id="dd">${ic("trash")}Delete</button>` : ""}</div>`;
  $("#drawer").classList.add("on"); $("#dback").classList.add("on"); $("#dx").focus();
  $("#dx").onclick = closeDrawer;
  if ($("#dv")) $("#dv").onclick = () => { closeDrawer(); openClientView(r.id, k); };
  if ($("#de")) $("#de").onclick = () => { closeDrawer(); formModal(k, r); };
  if ($("#dd")) $("#dd").onclick = () => { closeDrawer(); confirmDelete(k, r); };
  if ($("#dl")) $("#dl").onclick = () => { closeDrawer(); liveSel = r.id; go("live"); };
}
function closeDrawer() { $("#drawer").classList.remove("on"); $("#dback").classList.remove("on"); }
$("#dback").onclick = closeDrawer;

/* ---------- Generic table view ---------- */
const P = Object.fromEntries(Object.keys(S).map(k => [k, { q: "", tab: 0, page: 1 }]));
function csv(k) {
  const cols = vis(k), rows = [cols.map(f => f[1]), ...D[k].map(r => cols.map(f => f[2] === "ago" ? r.lastSeenAt : r[f[0]]))];
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n")], { type: "text/csv" })); a.download = k + ".csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 500);
  toast("Exported " + k + ".csv");
}
function table(k) {
  const s = S[k], st = P[k], cols = vis(k), showAct = (!s.ro && !VIEW && (PORTAL === "client" ? k === "campaigns" : canAdd(k))) || (PORTAL === "admin" && k === "advertisers");
  const rows = D[k].filter(r => {
    const t = s.tabs && (s.tabsOnly || st.tab > 0) ? r[s.tabKey] === s.tabs[st.tab] : true;
    return t && JSON.stringify(Object.values(r)).toLowerCase().includes(st.q.toLowerCase());
  });
  const pages = Math.max(1, Math.ceil(rows.length / PAGE)); st.page = Math.min(st.page, pages);
  const part = rows.slice((st.page - 1) * PAGE, st.page * PAGE), idf = r => k === "support" ? "#" + (1000 + r.id) : r.id;
  $("#view").innerHTML = `${s.tabs ? `<div class="tabs">${s.tabs.map((t, i) => `<button data-tab="${i}" class="${i === st.tab ? "on" : ""}">${t}${s.tabKey === "status" && t !== "All" ? ` (${D[k].filter(r => r.status === t).length})` : ""}</button>`).join("")}</div>` : ""}
  <div class="bar"><div class="sb">${ic("search")}<input id="q" placeholder="Search ${title(k).toLowerCase()}…" value="${esc(st.q)}" aria-label="Search"></div><span class="sp"></span>${s.export ? `<button class="btn ghost" id="exp">${ic("download")}Export CSV</button>` : ""}${canAdd(k) ? `<button class="btn" id="add">${ic("plus")}${s.add}</button>` : ""}</div>
  <div class="card tcard"><div class="ch"><h3>${title(k)}</h3><span>${rows.length} record${rows.length === 1 ? "" : "s"}${s.ro ? "" : " · click a row for details"}</span></div><div class="tw"><table><thead><tr><th>ID</th>${cols.map(f => `<th>${f[1]}</th>`).join("")}${showAct ? "<th>Actions</th>" : ""}</tr></thead><tbody>
  ${part.map(r => `<tr data-id="${r.id}" tabindex="0"><td data-label="ID">${idf(r)}</td>${cols.map((f, j) => `<td data-label="${f[1]}">${j === 0 && AV.includes(k) ? `<div class="nm"><span class="ini">${esc(initials(r[f[0]]))}</span>${esc(r[f[0]])}</div>` : cell(f, r)}</td>`).join("")}${showAct ? `<td data-label="Actions"><div class="act">${PORTAL === "admin" && k === "advertisers" ? `<button class="ib" data-v="${r.id}" aria-label="View client portal" title="View client portal (view-only)">${ic("eye")}</button>` : ""}${canRow(k, r) ? `<button class="ib" data-e="${r.id}" aria-label="Edit" title="Edit">${ic("edit")}</button><button class="ib d" data-d="${r.id}" aria-label="Delete" title="Delete">${ic("trash")}</button>` : ""}</div></td>` : ""}</tr>`).join("")}
  </tbody></table></div>${part.length ? "" : `<div class="empty">No records found.</div>`}
  <div class="pager"><span class="pi">Showing ${rows.length ? (st.page - 1) * PAGE + 1 : 0}–${Math.min(st.page * PAGE, rows.length)} of ${rows.length}</span><div class="pb"><button class="pg" data-p="${st.page - 1}" aria-label="Previous page" ${st.page <= 1 ? "disabled" : ""}>‹</button>${Array.from({ length: pages }, (_, i) => `<button class="pg ${i + 1 === st.page ? "on" : ""}" data-p="${i + 1}">${i + 1}</button>`).join("")}<button class="pg" data-p="${st.page + 1}" aria-label="Next page" ${st.page >= pages ? "disabled" : ""}>›</button></div></div></div>`;
  $("#q").oninput = e => { st.q = e.target.value; st.page = 1; const pos = e.target.selectionStart; table(k); const n = $("#q"); n.focus(); n.setSelectionRange(pos, pos); };
  if ($("#add")) $("#add").onclick = () => formModal(k);
  if ($("#exp")) $("#exp").onclick = () => csv(k);
  const rec = id => D[k].find(r => String(r.id) === String(id));
  $("#view").onclick = e => {
    const b = e.target.closest("button");
    if (b) {
      if (b.dataset.tab) { st.tab = +b.dataset.tab; st.page = 1; table(k); }
      else if (b.dataset.p) { st.page = +b.dataset.p; table(k); }
      else if (b.dataset.v) openClientView(Number(b.dataset.v), k);
      else if (b.dataset.e) formModal(k, rec(b.dataset.e));
      else if (b.dataset.d) confirmDelete(k, rec(b.dataset.d));
      return;
    }
    const tr = e.target.closest("tr[data-id]"); if (tr) openDetail(k, Number(tr.dataset.id));
  };
  $("#view").onkeydown = e => { if (e.key === "Enter" && e.target.matches && e.target.matches("tr[data-id]")) openDetail(k, Number(e.target.dataset.id)); };
}

/* ---------- Charts (monochrome) ---------- */
function line(vals, labels) {
  const w = 420, h = 170, m = 26, mx = Math.max(1, ...vals) * 1.1, p = vals.map((v, i) => [m + i * (w - m - 8) / Math.max(1, vals.length - 1), h - 20 - v / mx * (h - 30)]);
  const d = p.map((a, i) => (i ? "L" : "M") + a[0] + "," + a[1]).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Revenue trend"><path d="${d}L${p[p.length - 1][0]},${h - 20}L${p[0][0]},${h - 20}Z" fill="var(--c1)" opacity=".08"/><path d="${d}" fill="none" stroke="var(--c1)" stroke-width="2.5"/>${p.map(a => `<circle cx="${a[0]}" cy="${a[1]}" r="3.5" fill="var(--surface)" stroke="var(--c1)" stroke-width="2"/>`).join("")}${labels.map((l, i) => `<text x="${p[i][0]}" y="${h - 4}" font-size="10" text-anchor="middle" fill="var(--mute)">${l}</text>`).join("")}</svg>`;
}
function donut(parts, center) {
  const tot = parts.reduce((a, p) => a + p[1], 0), R = 48, C = 2 * Math.PI * R; let a = 0;
  const seg = tot ? parts.map(([, v, c]) => { const s = `<circle r="${R}" cx="70" cy="70" fill="none" stroke="${c}" stroke-width="22" stroke-dasharray="${v / tot * C} ${C}" stroke-dashoffset="${-a / tot * C}" transform="rotate(-90 70 70)"/>`; a += v; return s; }).join("") : `<circle r="${R}" cx="70" cy="70" fill="none" stroke="var(--c3)" stroke-width="22"/>`;
  return `<svg viewBox="0 0 140 140" width="150" role="img" aria-label="Chart">${seg}${center ? `<text x="70" y="75" text-anchor="middle" font-size="18" font-weight="700" fill="var(--ink)">${center}</text>` : ""}</svg>`;
}
const legend = parts => `<div class="lg" style="flex-direction:column">${parts.map(([n, v, c]) => `<span><i style="background:${c}"></i>${n} · ${v}</span>`).join("")}</div>`;
const COL = ["var(--c1)", "var(--c2)", "var(--c3)"];

/* ---------- Live monitoring (polls the backend every 3 s) ---------- */
let liveTimer = null, map = null, markers = {}, trails = {}, trailLine = null, liveSel = null, LIVE = [];
const mkIcon = (d, sel) => L.divIcon({ className: "mk " + d.status + (sel ? " sel" : ""), html: "<span></span>", iconSize: [24, 24], iconAnchor: [12, 12] });
function stopLive() { clearInterval(liveTimer); liveTimer = null; if (map) { map.remove(); map = null; } markers = {}; trails = {}; trailLine = null; }
function selectDev(id) {
  liveSel = id; trailLine && map && map.removeLayer(trailLine); trailLine = null;
  const d = LIVE.find(x => x.id === id); if (d && map) map.panTo([d.lat, d.lng]);
  drawLive();
}
function drawLive() {
  if (cur !== "live" || !$("#ll")) return;
  if (map) {
    LIVE.forEach(d => {
      const key = d.status + (d.id === liveSel); let m = markers[d.id];
      if (!m) { m = L.marker([d.lat, d.lng], { icon: mkIcon(d, d.id === liveSel) }).addTo(map).bindTooltip(d.dev); m.on("click", () => selectDev(d.id)); markers[d.id] = m; m._k = key; }
      else { m.setLatLng([d.lat, d.lng]); if (m._k !== key) { m.setIcon(mkIcon(d, d.id === liveSel)); m._k = key; } }
    });
    if (liveSel && trails[liveSel]) { if (!trailLine) trailLine = L.polyline([], { color: "#0a0a0a", weight: 3, dashArray: "4 6" }).addTo(map); trailLine.setLatLngs(trails[liveSel]); }
  }
  const sel = LIVE.find(d => d.id === liveSel);
  $("#lc").innerHTML = `<span class="pulse"></span>Live · ${new Date().toLocaleTimeString("en-IN")}`;
  $("#ld").innerHTML = sel ? [["Device", sel.dev], ["Vehicle", sel.vehicle], ["Owner", sel.owner], ["Currently near", sel.near], ["Coordinates", sel.lat.toFixed(5) + ", " + sel.lng.toFixed(5)], ["Speed", sel.speed + " km/h"], ["Last seen", ago(sel.lastSeenAt)], ["Now playing", sel.ad || "-"]].map(([a, b]) => `<div class="kv"><span>${a}</span><b>${esc(b)}</b></div>`).join("") : `<p class="muted">Select a device on the map or list to see its details.</p>`;
  const sc = $("#ll").scrollTop;
  $("#ll").innerHTML = LIVE.map(d => `<button class="li ${d.id === liveSel ? "sel" : ""}" data-id="${d.id}"><div><b>${esc(d.dev)}</b><small>${esc(d.near)} · ${esc(d.vehicle)}</small></div>${badge(d.status)}</button>`).join("");
  $("#ll").scrollTop = sc;
}
async function pollLive(first) {
  try {
    const r = await API("GET", "/api/live"); if (cur !== "live") return;
    LIVE = r.devices; LIVE.forEach(d => { const t = trails[d.id] = trails[d.id] || []; t.push([d.lat, d.lng]); if (t.length > 40) t.shift(); });
    drawLive();
    if (first && map && LIVE.length) map.fitBounds(LIVE.map(d => [d.lat, d.lng]), { padding: [40, 40] });
  } catch (e) { /* retry on next tick */ }
}

/* ---------- Views ---------- */
const V = {
  dashboard() { return PORTAL === "client" ? V.clientHome() : V.adminHome(); },
  adminHome() {
    const c = D.campaigns, by = s => c.filter(x => x.status === s).length, canEdit = canAdd("campaigns");
    const parts = [["Running", by("Approved"), COL[0]], ["Pending", by("Pending"), COL[1]], ["Rejected", by("Rejected"), COL[2]]];
    const rev = D.billing.filter(b => b.status === "Paid" && b.type !== "Payouts").reduce((a, b) => a + b.amount, 0);
    const months = [], now = new Date();
    for (let i = 6; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ k: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), l: d.toLocaleString("en-IN", { month: "short" }), v: 0 }); }
    D.billing.filter(b => b.status === "Paid" && b.type !== "Payouts").forEach(b => { const m = months.find(x => b.date.startsWith(x.k)); if (m) m.v += b.amount; });
    const pend = c.filter(x => x.status === "Pending");
    $("#view").innerHTML = `<div class="hero"><div><h3>Welcome back, ${esc(ME.name.split(" ")[0])}</h3><p>${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · Here is your platform overview.</p></div><div class="row">${canEdit ? `<button class="btn light" id="hbtn">${ic("plus")}New campaign</button>` : ""}<button class="btn light" id="hcl">${ic("eye")}View client logins</button></div></div>
    <div class="grid g4">${stat("Revenue (paid)", inr(rev))}${stat("Total campaigns", c.length)}${stat("Active devices", D.devices.filter(x => x.status === "Online").length + " / " + D.devices.length)}${stat("Active partners", D.partners.filter(x => x.status === "Active").length)}</div>
    <div class="grid g2" style="margin-top:18px"><div class="card"><h3>Revenue by month (₹ thousands)</h3>${line(months.map(m => Math.round(m.v / 1000)), months.map(m => m.l))}</div>
    <div class="card"><h3>Campaign status</h3><div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">${donut(parts, c.length ? Math.round(parts[0][1] / c.length * 100) + "%" : "0%")}${legend(parts)}</div></div></div>
    <div class="grid g2" style="margin-top:18px"><div class="card"><h3>Pending approvals</h3>${pend.length ? pend.slice(0, 5).map(x => `<div class="pend"><div><b>${esc(x.name)}</b><small>${esc(x.adv)} · ${fdate(x.start)}</small></div>${canEdit ? `<div class="row"><button class="btn ghost" data-q="${x.id}" data-s="Rejected">Reject</button><button class="btn" data-q="${x.id}" data-s="Approved">Approve</button></div>` : badge(x.status)}</div>`).join("") : `<p class="muted">No campaigns waiting for approval.</p>`}</div>
    <div class="card"><h3>Recent activity</h3>${D.audit.slice(0, 6).map(a => `<div class="tg"><span>${esc(a.action)}<small style="display:block;color:var(--mute)">${esc(a.user)}</small></span><span style="color:var(--mute);font-size:12.5px">${fdt(a.at)}</span></div>`).join("")}</div></div>`;
    if ($("#hbtn")) $("#hbtn").onclick = () => { go("campaigns"); formModal("campaigns"); };
    $("#hcl").onclick = () => go("clientlogins");
    $("#view").onclick = e => { const b = e.target.closest("button[data-q]"); if (b) setStatus("campaigns", D.campaigns.find(x => x.id === Number(b.dataset.q)), b.dataset.s); };
  },
  clientHome() {
    const c = D.campaigns, by = s => c.filter(x => x.status === s).length, paid = D.billing.filter(b => b.status === "Paid").reduce((a, b) => a + b.amount, 0);
    const parts = [["Approved", by("Approved"), COL[0]], ["Pending", by("Pending"), COL[1]], ["Rejected", by("Rejected"), COL[2]]];
    $("#view").innerHTML = `<div class="hero"><div><h3>Welcome, ${esc(VIEW ? VIEW.name : ME.name)}</h3><p>Launch campaigns and track their approval status.</p></div>${VIEW ? "" : `<button class="btn light" id="hbtn">${ic("plus")}New campaign</button>`}</div>
    <div class="grid g4">${stat("My campaigns", c.length)}${stat("Approved", by("Approved"))}${stat("Pending review", by("Pending"))}${stat("Total paid", inr(paid))}</div>
    <div class="grid g2" style="margin-top:18px"><div class="card"><h3>Campaign status</h3><div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">${donut(parts, c.length)}${legend(parts)}</div></div>
    <div class="card"><h3>Recent campaigns</h3>${c.slice(0, 5).map(x => `<div class="pend"><div><b>${esc(x.name)}</b><small>${fdate(x.start)} – ${fdate(x.end)}</small></div>${badge(x.status)}</div>`).join("") || `<p class="muted">You have no campaigns yet.</p>`}</div></div>`;
    if ($("#hbtn")) $("#hbtn").onclick = () => { go("campaigns"); formModal("campaigns"); };
  },
  async clientlogins() {
    $("#view").innerHTML = `<div class="card"><p class="muted">Loading client logins…</p></div>`;
    let r; try { r = await API("GET", "/api/client-logins"); } catch (e) { $("#view").innerHTML = `<div class="card"><p class="muted">${esc(e.message)}</p></div>`; return; }
    if (cur !== "clientlogins") return;
    const today0 = new Date(); today0.setHours(0, 0, 0, 0); const recent = r.history.filter(l => new Date(l.at) >= today0).length;
    $("#view").innerHTML = `<div class="grid g4">${stat("Clients", r.clients.length)}${stat("Logins today", recent)}${stat("Total logins", r.clients.reduce((a, c) => a + c.loginCount, 0))}${stat("Never logged in", r.clients.filter(c => !c.lastLogin).length)}</div>
    <div class="card tcard" style="margin-top:18px"><div class="ch"><h3>Client accounts</h3><span>${r.clients.length} clients · open any client's portal view-only, without leaving your admin session</span></div><div class="tw"><table><thead><tr><th>Client</th><th>Login email</th><th>Status</th><th>Last login</th><th>Total logins</th><th>Actions</th></tr></thead><tbody>
    ${r.clients.map(c => `<tr><td data-label="Client"><div class="nm"><span class="ini">${esc(initials(c.name))}</span>${esc(c.name)}</div></td><td data-label="Login email">${esc(c.email)}</td><td data-label="Status">${badge(c.status)}</td><td data-label="Last login">${c.lastLogin ? esc(fdt(c.lastLogin)) + " · " + ago(c.lastLogin) : "Never"}</td><td data-label="Total logins">${c.loginCount}</td><td data-label="Actions"><button class="btn ghost" data-va="${c.id}">${ic("eye")}View portal</button></td></tr>`).join("")}
    </tbody></table></div></div>
    <div class="card tcard" style="margin-top:18px"><div class="ch"><h3>Recent client sign-ins</h3><span>Latest ${r.history.length}</span></div><div class="tw"><table><thead><tr><th>Client</th><th>Email</th><th>Date &amp; time</th><th>IP address</th></tr></thead><tbody>
    ${r.history.map(l => `<tr><td data-label="Client">${esc(l.name)}</td><td data-label="Email">${esc(l.email)}</td><td data-label="Date & time">${esc(fdt(l.at))} · ${ago(l.at)}</td><td data-label="IP address">${esc(l.ip)}</td></tr>`).join("")}
    </tbody></table></div>${r.history.length ? "" : `<div class="empty">No client has signed in yet.</div>`}</div>`;
    $("#view").onclick = e => { const b = e.target.closest("button[data-va]"); if (b) openClientView(Number(b.dataset.va), "clientlogins"); };
  },
  async live() {
    $("#view").innerHTML = `<div class="live"><div class="card lp"><div class="ch"><h3>Devices</h3><span id="lc"></span></div><div class="ld" id="ld"></div><div class="ll" id="ll"></div></div><div class="card mp"><div id="map"></div></div></div>`;
    if (window.L) {
      map = L.map("map").setView([12.9352, 77.6245], 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
      setTimeout(() => map && map.invalidateSize(), 100);
    } else $("#map").innerHTML = `<div class="empty">The map library could not load. Check your internet connection. Live positions still update in the list.</div>`;
    $("#ll").onclick = e => { const b = e.target.closest(".li"); if (b) selectDev(Number(b.dataset.id)); };
    await pollLive(true); if (cur === "live") liveTimer = setInterval(pollLive, 3000);
  },
  analytics() {
    const r = V.range || 30, f = r / 30, ap = D.campaigns.filter(c => c.status === "Approved"), imp = ap.length * 1.7 * f;
    const paid = D.billing.filter(b => b.status === "Paid" && b.type !== "Payouts").reduce((a, b) => a + b.amount, 0);
    const parts = ap.slice(0, 3).map((c, i) => [esc(c.name), [45, 30, 25][i], COL[i]]), v = [40, 55, 38, 62, 70, 48, 80, 66, 90, 58, 75, 84];
    $("#view").innerHTML = `<div class="bar"><select id="rg" style="max-width:180px;margin:0" aria-label="Date range">${[7, 30, 90].map(x => `<option value="${x}" ${x === r ? "selected" : ""}>Last ${x} days</option>`).join("")}</select></div>
    <div class="grid g4">${stat("Impressions", imp.toFixed(1) + "M")}${stat("Clicks", Math.round(imp * 53) + "K")}${stat("CTR", "5.3%")}${stat("Revenue", inr(Math.round(paid * f / 3)))}</div>
    <div class="grid g2" style="margin-top:18px"><div class="card"><h3>Performance overview</h3><svg viewBox="0 0 420 160" width="100%" role="img" aria-label="Impressions">${v.map((x, i) => `<rect x="${14 + i * 34}" y="${150 - x / 90 * 130}" width="22" height="${x / 90 * 130}" rx="3" fill="var(--c1)" opacity="${i % 2 ? .45 : 1}"/>`).join("")}</svg></div>
    <div class="card"><h3>Top campaigns</h3>${parts.length ? `<div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">${donut(parts)}${legend(parts)}</div>` : `<p class="muted">No approved campaigns yet.</p>`}</div></div>`;
    $("#rg").onchange = e => { V.range = Number(e.target.value); V.analytics(); };
  },
  settings() {
    const s = D.settings, su = ME.role === "Super Admin";
    $("#view").innerHTML = `<div class="grid g2"><form class="card" id="sf"><h3>Platform information</h3><label for="s1">Platform name</label><input id="s1" value="${esc(s.name)}" required><label for="s2">Contact email</label><input id="s2" type="email" value="${esc(s.email)}" required><label for="s3">Timezone</label><select id="s3">${["Asia/Kolkata", "UTC", "Asia/Dubai", "Europe/London"].map(z => `<option ${z === s.tz ? "selected" : ""}>${z}</option>`).join("")}</select><button class="btn">Save changes</button></form>
    <div class="card"><h3>Security settings</h3><div class="tg"><span>Two-factor authentication</span><input type="checkbox" id="t1" ${s.tfa ? "checked" : ""}></div><div class="tg"><span>Login notifications</span><input type="checkbox" id="t2" ${s.notify ? "checked" : ""}></div>${su ? `<div class="tg"><span>Reset all demo data</span><button class="btn danger" id="rs" type="button">Reset</button></div>` : ""}</div></div>`;
    const put = async (o, msg) => { try { D.settings = await API("PUT", "/api/settings", o); toast(msg); } catch (e) { toast(e.message); } };
    $("#sf").onsubmit = e => { e.preventDefault(); put({ name: $("#s1").value, email: $("#s2").value, tz: $("#s3").value }, "Settings saved"); };
    $("#t1").onchange = e => put({ tfa: e.target.checked }, "Two-factor " + (e.target.checked ? "on" : "off"));
    $("#t2").onchange = e => put({ notify: e.target.checked }, "Login notifications " + (e.target.checked ? "on" : "off"));
    if (su) $("#rs").onclick = () => { openModal(`<h3>Reset demo data?</h3><p>All records will be replaced with the original sample data.</p><div class="row"><button class="btn ghost" id="cx">Cancel</button><button class="btn danger" id="ok">Reset</button></div>`); $("#cx").onclick = closeModal; $("#ok").onclick = async () => { try { await API("POST", "/api/reset"); await refresh(); closeModal(); toast("Data reset"); go("dashboard"); } catch (e) { toast(e.message); } }; };
  }
};

/* ---------- Shell, navigation and auth ---------- */
function renderNav() {
  const pend = D.campaigns.filter(c => c.status === "Pending").length, open = PORTAL === "admin" ? D.support.filter(t => t.status === "Open").length : 0, cnt = { campaigns: pend, support: open };
  $("#side").innerHTML = `<div class="logo"><i>▶</i><span>AdTech Platform</span></div>` + GROUPS[PORTAL].map(([g, ks]) => `<div class="sg">${g}</div>` + ks.map(k => `<button class="nv ${k === cur ? "on" : ""}" data-k="${k}" title="${title(k)}">${ic(ICON[k])}<span>${title(k)}</span>${cnt[k] ? `<em class="cnt">${cnt[k]}</em>` : ""}</button>`).join("")).join("") + `<div class="sfoot"><div class="suser"><div class="av">${esc(initials(ME.name))}</div><div class="ut"><b>${esc(ME.name)}</b><small>${esc(ME.role)}</small></div></div><button class="nv" id="out" title="Logout">${ic("logout")}<span>Logout</span></button></div>`;
  $("#bd").style.display = pend + open ? "block" : "none";
  $("#crumb").textContent = VIEW ? "Admin / Client view: " + VIEW.name + " / " + title(cur) : (PORTAL === "admin" ? "Admin" : "Client") + " / " + title(cur);
}
function go(k) {
  stopLive(); closeDrawer();
  cur = k; $("#title").textContent = title(k); renderNav();
  $("#view").onclick = null; $("#view").onkeydown = null;
  (V[k] || (() => table(k)))(k); closeMenu(); $("#view").scrollTop = 0;
}
const closeMenu = () => { $("#side").classList.remove("open"); $("#back").classList.remove("on"); };
function showScreen(n) { $("#landing").style.display = n === "landing" ? "flex" : "none"; $("#app").classList.toggle("on", n === "app"); }
function syncChrome() {
  const cv = $("#cview"); cv.style.display = ME.portal === "admin" && !VIEW ? "" : "none"; cv.innerHTML = `${ic("eye")}<span>Client portal</span>`; cv.onclick = clientPicker;
  const bar = $("#impbar"); bar.classList.toggle("on", !!VIEW);
  bar.innerHTML = VIEW ? `${ic("eye")}<span>Client portal view: <b>${esc(VIEW.name)}</b>${VIEW.status !== "Approved" ? " (" + esc(VIEW.status) + ")" : ""} · View-only · You are still signed in as <b>${esc(ME.name)}</b> (${esc(ME.role)})</span><button class="btn light" id="impx">Back to admin</button>` : "";
  if ($("#impx")) $("#impx").onclick = exitClientView;
}
function clientPicker() {
  openModal(`<h3>View a client's portal</h3><p>Opens the client's dashboard in view-only mode. You stay signed in as admin.</p><div class="cvl">${D.advertisers.map(a => `<button data-va="${a.id}"><span><b>${esc(a.name)}</b><small>${esc(a.email)} · ${esc(a.status)}</small></span>${ic("eye")}</button>`).join("") || `<p class="muted">No clients yet.</p>`}</div><div class="row"><button class="btn ghost" id="cx">Close</button><button class="btn" id="cgo">Open Client Logins</button></div>`);
  $("#cx").onclick = closeModal; $("#cgo").onclick = () => { closeModal(); go("clientlogins"); };
  $("#modal").querySelectorAll("[data-va]").forEach(b => { b.onclick = () => { closeModal(); openClientView(Number(b.dataset.va), cur); }; });
}
/* Admin previews a client's portal. The admin's token, identity and session are never touched:
   the server returns a read-only snapshot of that client's data and the UI renders the client views from it. */
async function openClientView(id, from) {
  if (ME.portal !== "admin") return;
  try {
    const r = await API("GET", "/api/client-view/" + id);
    if (!VIEW) ADMIN_D = D;
    const data = Object.fromEntries(Object.keys(S).map(k => [k, []])); Object.assign(data, r.data);
    VIEW = { ...r.client, from: VIEW ? VIEW.from : from }; D = data; PORTAL = "client";
    closeDrawer(); syncChrome(); go("dashboard");
  } catch (e) { toast(e.message); }
}
async function exitClientView() {
  const back = VIEW ? VIEW.from : "dashboard"; VIEW = null; PORTAL = "admin"; D = ADMIN_D || D; ADMIN_D = null;
  try { await refresh(); } catch (e) { return; }
  syncChrome(); go(back && (V[back] || S[back]) ? back : "dashboard");
}
async function enter() {
  await refresh(); cur = "dashboard"; VIEW = null; ADMIN_D = null;
  $("#un").textContent = ME.name; $("#ue").textContent = ME.email; $("#uav").textContent = initials(ME.name);
  syncChrome(); showScreen("app"); go("dashboard");
}
function logout() {
  token = null; VIEW = null; ADMIN_D = null; PORTAL = "admin"; try { localStorage.removeItem(TK); } catch (e) { /* ignore */ }
  const bar = $("#impbar"); if (bar) bar.classList.remove("on");
  stopLive(); closeDrawer(); closeModal(); closeMenu(); ME = null; showScreen("landing");
}
document.querySelectorAll("[data-ic]").forEach(el => el.insertAdjacentHTML("afterbegin", ic(el.dataset.ic)));
document.querySelectorAll(".lc").forEach(f => {
  f.onsubmit = async e => {
    e.preventDefault(); const btn = f.querySelector(".btn"), err = f.querySelector(".merr"); btn.disabled = true; err.textContent = "";
    try {
      const r = await API("POST", "/api/login", { email: f.elements.email.value, password: f.elements.password.value, portal: f.dataset.portal });
      token = r.token; try { localStorage.setItem(TK, token); } catch (x) { /* ignore */ }
      await enter();
    } catch (x) { err.textContent = x.message; } finally { btn.disabled = false; }
  };
});
$("#side").onclick = e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.id === "out") logout(); else if (b.dataset.k) go(b.dataset.k);
};
$("#menu").onclick = () => { $("#side").classList.toggle("open"); $("#back").classList.toggle("on"); };
$("#back").onclick = closeMenu;
$("#collapse").onclick = () => document.body.classList.toggle("collapsed");
$("#bell").onclick = () => go(PORTAL === "admin" ? "support" : "campaigns");
const toggleTheme = () => { const r = document.documentElement, n = r.dataset.theme === "dark" ? "light" : "dark"; r.dataset.theme = n; try { localStorage.setItem("adtech-theme", n); } catch (e) { /* ignore */ } };
$("#theme").onclick = toggleTheme; $("#theme0").onclick = toggleTheme;
const fit = () => document.body.classList.toggle("collapsed", innerWidth > 760 && innerWidth <= 1100);
addEventListener("resize", fit); fit();

(async () => {
  if (!token) return;
  $("#landing").style.display = "none";
  try {
    await enter();
  } catch (e) {
    logout();
  }
})();

}
