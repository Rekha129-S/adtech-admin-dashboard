"use strict";

/*
  Core application logic.
  - Exports `handler(req, res)` which works as a Vercel serverless function
    AND with a normal http server (used by server.js for local development).
  - Never calls server.listen().
*/

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const supabaseStore = require("../config/supabase-store");

const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = path.join(__dirname, "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

// Never fall back to a well-known device key in production.
const DEVICE_KEY =
  process.env.DEVICE_KEY || (IS_VERCEL ? "" : "device-secret");

/* ---------- Runtime state (one copy per serverless instance) ---------- */

let db = null;
let initPromise = null;
let loadedAt = 0;
let pendingSaves = 0;
let busy = 0;

const REFRESH_MS = 5000; // re-read Supabase if cached data is older than this

/* ---------- Bengaluru areas ---------- */

const AREAS = {
  "Bommanahalli": [12.9082, 77.6246],
  "Silk Board": [12.9172, 77.6228],
  "Koramangala": [12.9352, 77.6245],
  "HSR Layout": [12.9116, 77.6389],
  "BTM Layout": [12.9166, 77.6101],
  "Indiranagar": [12.9784, 77.6408],
  "Whitefield": [12.9698, 77.7500],
  "Electronic City": [12.8452, 77.6602],
  "Jayanagar": [12.9308, 77.5838],
  "JP Nagar": [12.9063, 77.5857],
  "Marathahalli": [12.9591, 77.6974],
  "Bellandur": [12.9304, 77.6784],
  "Hebbal": [13.0358, 77.5970],
  "Yelahanka": [13.1007, 77.5963],
  "Majestic": [12.9767, 77.5713],
  "MG Road": [12.9756, 77.6097],
  "Banashankari": [12.9255, 77.5468],
  "Malleshwaram": [13.0035, 77.5643],
  "Rajajinagar": [12.9916, 77.5520],
  "Kengeri": [12.9177, 77.4833]
};

const AREA_NAMES = Object.keys(AREAS);

const nearest = (lat, lng) =>
  AREA_NAMES.reduce((best, name) => {
    const distance =
      (AREAS[name][0] - lat) ** 2 +
      (AREAS[name][1] - lng) ** 2;

    return distance < best[1]
      ? [name, distance]
      : best;
  }, ["", Infinity])[0];

/* ---------- Schema ---------- */

const ST = ["Active", "Inactive"];
const APP = ["Approved", "Pending", "Rejected"];

const SC = {
  users: {
    f: ["name", "email", "role", "status"],
    en: {
      role: ["Super Admin", "Admin", "Manager", "Viewer", "Support"],
      status: ST
    },
    uniq: "email",
    pw: 1
  },

  advertisers: {
    f: ["name", "email", "status"],
    en: { status: APP },
    uniq: "email",
    pw: 1
  },

  partners: {
    f: ["name", "phone", "vehicle", "status"],
    en: {
      status: ["Active", "Pending", "Inactive"]
    }
  },

  vehicles: {
    f: ["no", "owner", "area", "status"],
    en: {
      area: AREA_NAMES,
      status: ST
    },
    uniq: "no"
  },

  devices: {
    f: ["dev", "vehicle", "status"],
    en: {
      status: ["Online", "Offline", "Maintenance"]
    },
    uniq: "dev"
  },

  campaigns: {
    f: ["name", "adv", "start", "end", "status"],
    en: { status: APP }
  },

  inventory: {
    f: ["name", "dur", "price", "status"],
    en: {
      dur: ["1 week", "1 month", "3 months", "6 months", "1 year"],
      status: ST
    }
  },

  billing: {
    f: ["date", "desc", "adv", "amount", "type", "status"],
    en: {
      type: ["Transactions", "Invoices", "Payouts"],
      status: ["Paid", "Pending", "Failed"]
    }
  },

  support: {
    f: ["subj", "user", "prio", "status"],
    en: {
      prio: ["High", "Medium", "Low"],
      status: ["Open", "In progress", "Resolved", "Closed"]
    }
  }
};

const LBL = {
  name: "Name",
  email: "Email",
  role: "Role",
  status: "Status",
  phone: "Phone",
  vehicle: "Vehicle no.",
  no: "Vehicle no.",
  owner: "Owner",
  area: "Area",
  dev: "Device ID",
  adv: "Advertiser",
  start: "Start date",
  end: "End date",
  dur: "Duration",
  price: "Price",
  date: "Date",
  desc: "Description",
  amount: "Amount",
  type: "Type",
  subj: "Subject",
  user: "User",
  prio: "Priority"
};

const NUM = ["price", "amount"];
const DATE = ["start", "end", "date"];

/* ---------- Crypto helpers ---------- */

const hash = (
  pw,
  salt = crypto.randomBytes(16).toString("hex")
) =>
  salt + ":" +
  crypto.scryptSync(pw, salt, 32).toString("hex");

const verify = (pw, h) => {
  const [salt, k] = String(h || "").split(":");

  if (!k) return false;

  const a = Buffer.from(k, "hex");
  const b = crypto.scryptSync(pw, salt, 32);

  return a.length === b.length &&
    crypto.timingSafeEqual(a, b);
};

/*
  Token signing key. It must be the SAME on every serverless instance,
  otherwise a token created by one instance is rejected by another.
  Priority: AUTH_SECRET env var -> derived from SUPABASE_SECRET_KEY
  (hashed, the real key is never exposed) -> db.meta.secret (local only).
*/
function signingKey() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;

  if (process.env.SUPABASE_SECRET_KEY) {
    return crypto
      .createHash("sha256")
      .update("adtech-auth:" + process.env.SUPABASE_SECRET_KEY)
      .digest("hex");
  }

  return db.meta.secret;
}

const mac = body =>
  crypto
    .createHmac("sha256", signingKey())
    .update(body)
    .digest("base64url");

const sign = p => {
  const body = Buffer
    .from(JSON.stringify({
      ...p,
      exp: Date.now() + 12 * 3600e3
    }))
    .toString("base64url");

  return body + "." + mac(body);
};

function unsign(t) {
  const [body, sig] = String(t || "").split(".");

  if (!body || !sig) return null;

  const expected = mac(body);

  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(
      Buffer.from(sig),
      Buffer.from(expected)
    )
  ) {
    return null;
  }

  try {
    const p = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    );

    return p.exp > Date.now() ? p : null;
  } catch (e) {
    return null;
  }
}

/* ---------- Database seed (only used if Supabase is empty) ---------- */

function seed() {
  const now = Date.now();

  const iso = minutes =>
    new Date(now - minutes * 60000).toISOString();

  const jit = () =>
    (Math.random() - 0.5) * 0.01;

  const mk = (rows, keys) =>
    rows.map((r, i) =>
      Object.assign(
        {
          id: i + 1,
          created: iso(1440 * (40 - i * 2))
        },
        Object.fromEntries(
          keys.map((k, j) => [k, r[j]])
        )
      )
    );

  const d = {
    meta: {
      secret: crypto.randomBytes(32).toString("hex")
    },

    settings: {
      name: "AdTech Platform",
      email: "support@adtech.in",
      tz: "Asia/Kolkata",
      tfa: true,
      notify: true
    }
  };

  d.users = mk([
    ["Rekha Patil", "admin@adtech.in", "Super Admin", "Active"],
    ["Amit Sharma", "amit@adtech.in", "Admin", "Active"],
    ["Priya Singh", "priya@adtech.in", "Manager", "Active"],
    ["Rahul Kumar", "rahul@adtech.in", "Viewer", "Inactive"],
    ["Sneha Iyer", "sneha@adtech.in", "Support", "Active"]
  ], ["name", "email", "role", "status"])
    .map(u => ({
      ...u,
      pw: hash("Admin@123")
    }));

  d.advertisers = mk([
    ["ABC Enterprises", "ads@abc.com", "Approved"],
    ["TechGlobal Ltd", "ads@techglobal.com", "Approved"],
    ["Dream Ads Co.", "ads@dreamads.com", "Pending"],
    ["Future Brands", "hello@futurebrands.com", "Approved"],
    ["Mega Media", "ads@megamedia.com", "Approved"]
  ], ["name", "email", "status"])
    .map(a => ({
      ...a,
      pw: hash("Client@123")
    }));

  d.vehicles = mk([
    ["KA-01-AA-1001", "Ramesh Kumar", "Bommanahalli", "Active"],
    ["KA-01-BB-2002", "Suresh Patel", "Silk Board", "Active"],
    ["KA-01-CC-3003", "Mahesh Rao", "Koramangala", "Inactive"],
    ["KA-01-DD-4004", "Lakshmi Devi", "HSR Layout", "Active"],
    ["KA-01-EE-5005", "Rajesh Gowda", "Indiranagar", "Active"],
    ["KA-01-FF-6006", "Anil Shetty", "Whitefield", "Active"],
    ["KA-01-GG-7007", "Divya Nair", "Jayanagar", "Active"],
    ["KA-01-HH-8008", "Kiran Reddy", "Electronic City", "Active"]
  ], ["no", "owner", "area", "status"]);

  d.partners = mk([
    ["Ramesh Kumar", "9876543210", "KA-01-AA-1001", "Active"],
    ["Suresh Patel", "9123456789", "KA-01-BB-2002", "Active"],
    ["Mahesh Rao", "9988776655", "KA-01-CC-3003", "Pending"],
    ["Lakshmi Devi", "9765432109", "KA-01-DD-4004", "Active"],
    ["Rajesh Gowda", "8899887654", "KA-01-EE-5005", "Active"],
    ["Anil Shetty", "9845012345", "KA-01-FF-6006", "Active"],
    ["Divya Nair", "9901234567", "KA-01-GG-7007", "Active"],
    ["Kiran Reddy", "9886543210", "KA-01-HH-8008", "Active"]
  ], ["name", "phone", "vehicle", "status"]);

  d.devices = mk([
    ["DEV-001", "KA-01-AA-1001", "Online"],
    ["DEV-002", "KA-01-BB-2002", "Online"],
    ["DEV-003", "KA-01-CC-3003", "Offline"],
    ["DEV-004", "KA-01-DD-4004", "Online"],
    ["DEV-005", "KA-01-EE-5005", "Maintenance"],
    ["DEV-006", "KA-01-FF-6006", "Online"],
    ["DEV-007", "KA-01-GG-7007", "Online"],
    ["DEV-008", "KA-01-HH-8008", "Online"]
  ], ["dev", "vehicle", "status"]).map(x => {
    const h =
      AREAS[
        (d.vehicles.find(v => v.no === x.vehicle) || {}).area
      ] || AREAS["MG Road"];

    return {
      ...x,
      lat: h[0] + jit(),
      lng: h[1] + jit(),
      speed: 0,
      lastSeenAt: iso(
        x.status === "Online" ? 0 :
        x.status === "Offline" ? 60 : 10
      )
    };
  });

  d.campaigns = mk([
    ["Festive Offers 2026", "ABC Enterprises", "2026-11-01", "2026-11-30", "Approved"],
    ["Tech Sale", "TechGlobal Ltd", "2026-11-05", "2026-11-20", "Pending"],
    ["Dream Big Campaign", "Dream Ads Co.", "2026-11-10", "2026-11-25", "Approved"],
    ["Winter Bonanza", "Future Brands", "2026-11-15", "2026-12-15", "Rejected"],
    ["Mega Sale", "Mega Media", "2026-11-20", "2026-12-05", "Approved"],
    ["New Year Launch", "ABC Enterprises", "2026-12-20", "2027-01-10", "Pending"]
  ], ["name", "adv", "start", "end", "status"]);

  d.inventory = mk([
    ["Basic Plan", "1 week", 5000, "Active"],
    ["Standard Plan", "1 month", 18000, "Active"],
    ["Premium Plan", "3 months", 45000, "Active"],
    ["Enterprise Plan", "6 months", 80000, "Active"],
    ["Custom Plan", "1 year", 150000, "Active"]
  ], ["name", "dur", "price", "status"]);

  d.billing = mk([
    ["2026-11-01", "Campaign revenue", "ABC Enterprises", 150000, "Transactions", "Paid"],
    ["2026-10-28", "Partner payout", "Platform", 75000, "Payouts", "Paid"],
    ["2026-10-25", "Campaign payment", "TechGlobal Ltd", 200000, "Invoices", "Pending"],
    ["2026-10-20", "Device fees", "Platform", 50000, "Transactions", "Paid"],
    ["2026-10-18", "Partner commission", "Platform", 40000, "Payouts", "Paid"],
    ["2026-10-05", "Campaign revenue", "Mega Media", 180000, "Transactions", "Paid"],
    ["2026-09-12", "Campaign revenue", "Future Brands", 160000, "Transactions", "Paid"],
    ["2026-09-02", "Campaign revenue", "ABC Enterprises", 140000, "Transactions", "Paid"],
    ["2026-08-15", "Campaign revenue", "TechGlobal Ltd", 120000, "Transactions", "Paid"],
    ["2026-07-20", "Campaign revenue", "Dream Ads Co.", 90000, "Transactions", "Paid"],
    ["2026-06-10", "Campaign revenue", "Mega Media", 110000, "Transactions", "Paid"],
    ["2026-05-08", "Campaign revenue", "ABC Enterprises", 80000, "Transactions", "Paid"]
  ], ["date", "desc", "adv", "amount", "type", "status"]);

  d.support = mk([
    ["Device offline issue", "ABC Enterprises", "High", "Open"],
    ["Campaign not playing", "TechGlobal Ltd", "Medium", "In progress"],
    ["Payment delay", "Mega Media", "Low", "Resolved"],
    ["Login problem", "Future Brands", "Medium", "Open"],
    ["Report issue", "ABC Enterprises", "Low", "Closed"]
  ], ["subj", "user", "prio", "status"]);

  d.logins = [
    ["ads@abc.com", 1, 300],
    ["ads@techglobal.com", 2, 1500],
    ["ads@abc.com", 1, 2900],
    ["hello@futurebrands.com", 4, 4400],
    ["ads@megamedia.com", 5, 6000]
  ].map((l, i) => {
    const a = d.advertisers[l[1] - 1];

    return {
      id: 5 - i,
      advId: a.id,
      name: a.name,
      email: l[0],
      at: iso(l[2]),
      ip: "127.0.0.1"
    };
  });

  d.advertisers.forEach(a => {
    const mine = d.logins.filter(l => l.advId === a.id);
    a.loginCount = mine.length;
    a.lastLogin = mine.length ? mine[0].at : null;
  });

  d.audit = [
    ["System initialised", "System", 30],
    ["Signed in (admin)", "Rekha Patil", 20],
    ['campaigns: approved "Festive Offers 2026"', "Amit Sharma", 10]
  ].map((a, i) => ({
    id: 3 - i,
    action: a[0],
    user: a[1],
    at: iso(a[2]),
    ip: "127.0.0.1"
  }));

  return d;
}

/* ---------- Loading and saving ---------- */

const COLLECTIONS = [
  "users",
  "advertisers",
  "partners",
  "vehicles",
  "devices",
  "campaigns",
  "inventory",
  "billing",
  "support",
  "logins",
  "audit"
];

// Local JSON file is only a migration source for an EMPTY Supabase.
function loadInitialData() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch (e) {
    return seed();
  }
}

function normalize(loaded, initial) {
  const d = loaded || {};

  for (const c of COLLECTIONS) {
    if (!Array.isArray(d[c])) d[c] = [];
  }

  d.meta = {
    ...(initial.meta || {}),
    ...(d.meta || {})
  };

  d.settings = {
    ...(initial.settings || {}),
    ...(d.settings || {})
  };

  if (!d.meta.secret) {
    d.meta.secret = crypto.randomBytes(32).toString("hex");
  }

  return d;
}

async function loadFromStore() {
  const initial = loadInitialData();
  const loaded = await supabaseStore.initializeDatabase(initial);
  return normalize(loaded, initial);
}

/* Local-only backup (Vercel's file system is read-only). */
function flush() {
  if (!db || IS_VERCEL) return;

  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DB_FILE + ".tmp", JSON.stringify(db, null, 2));
    fs.renameSync(DB_FILE + ".tmp", DB_FILE);
  } catch (e) {
    console.error("Could not save local backup:", e.message);
  }
}

/*
  Make sure the database is loaded. Safe to call on every request:
  - first call (cold start) loads from Supabase once, even if many
    requests arrive at the same time
  - later calls re-read Supabase if the cache is older than REFRESH_MS,
    so several serverless instances stay roughly in sync
*/
async function init() {
  if (!db) {
    if (!initPromise) {
      initPromise = loadFromStore()
        .then(d => {
          db = d;
          loadedAt = Date.now();
          flush();
        })
        .finally(() => {
          initPromise = null;
        });
    }

    return initPromise;
  }

  if (
    busy === 0 &&
    pendingSaves === 0 &&
    Date.now() - loadedAt > REFRESH_MS
  ) {
    if (!initPromise) {
      initPromise = loadFromStore()
        .then(d => {
          db = d;
          loadedAt = Date.now();
        })
        .catch(e => {
          console.error("Supabase refresh failed:", e.message);
          loadedAt = Date.now(); // keep using cached data, retry later
        })
        .finally(() => {
          initPromise = null;
        });
    }

    return initPromise;
  }
}

/*
  Save to Supabase. In serverless the function is frozen as soon as the
  response is sent, so we MUST finish saving BEFORE responding.
*/
async function save() {
  if (!db) return;

  flush();
  pendingSaves++;

  try {
    await supabaseStore.saveDatabase(db);
    loadedAt = Date.now();
  } catch (error) {
    console.error("Supabase save failed:", error.message);
    throw E(500, "Could not save data. Please try again.");
  } finally {
    pendingSaves--;
  }
}

const nextId = col =>
  Math.max(0, ...(db[col] || []).map(r => Number(r.id) || 0)) + 1;

const clean = r => {
  const { pw, ...x } = r;
  return x;
};

function audit(user, action, ip) {
  db.audit.unshift({
    id: nextId("audit"),
    action,
    user,
    at: new Date().toISOString(),
    ip: ip || "127.0.0.1"
  });

  db.audit.length = Math.min(db.audit.length, 500);
}

/* ---------- HTTP helpers ---------- */

function E(code, msg) {
  return Object.assign(new Error(msg), { code });
}

const send = (res, code, obj) => {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });

  res.end(JSON.stringify(obj));
};

/*
  Vercel may already have parsed the body into req.body. If so the
  stream is empty, so use req.body instead of waiting for stream events.
*/
const readBody = req =>
  new Promise((ok, no) => {
    if (req.body !== undefined && req.body !== null) {
      try {
        if (Buffer.isBuffer(req.body)) {
          const t = req.body.toString("utf8");
          return ok(t ? JSON.parse(t) : {});
        }

        if (typeof req.body === "string") {
          return ok(req.body ? JSON.parse(req.body) : {});
        }

        return ok(req.body);
      } catch (e) {
        return no(E(400, "Invalid JSON"));
      }
    }

    let s = "";
    let done = false;

    req.on("data", c => {
      if (done) return;

      s += c;

      if (s.length > 1e5) {
        done = true;
        req.pause();
        no(E(413, "Payload too large"));
      }
    });

    req.on("end", () => {
      if (done) return;
      done = true;

      try {
        ok(s ? JSON.parse(s) : {});
      } catch (e) {
        no(E(400, "Invalid JSON"));
      }
    });

    req.on("error", err => {
      if (done) return;
      done = true;
      no(err);
    });
  });

const ipOf = req => {
  const fwd = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();

  return (
    fwd ||
    String(req.socket && req.socket.remoteAddress || "")
      .replace("::ffff:", "")
      .replace("::1", "127.0.0.1")
  );
};

// Per-instance only (resets on cold start). Good enough as a basic guard.
const tries = new Map();

/* ---------- Authentication ---------- */

function auth(req) {
  const p = unsign(
    (req.headers.authorization || "").replace(/^Bearer /, "")
  );

  if (!p) return null;

  const rec = (
    p.p === "client" ? db.advertisers : db.users
  ).find(x => x.id === p.id);

  if (!rec) return null;

  if (
    p.p === "client"
      ? rec.status !== "Approved"
      : rec.status !== "Active"
  ) {
    return null;
  }

  return {
    portal: p.p,
    rec,
    name: rec.name,
    role: p.p === "client" ? "Client" : rec.role
  };
}

const meOf = au => ({
  name: au.name,
  email: au.rec.email,
  role: au.role,
  portal: au.portal
});

function can(au, col, m) {
  if (au.portal === "client") {
    return (
      col === "campaigns" ||
      col === "support" ||
      (m === "GET" && (col === "billing" || col === "inventory"))
    );
  }

  if (m === "GET") return true;
  if (au.role === "Viewer") return false;

  return col === "users"
    ? ["Super Admin", "Admin"].includes(au.role)
    : true;
}

const scoped = (au, col) =>
  au.portal === "admin"
    ? db[col]
    : col === "inventory"
      ? db.inventory.filter(i => i.status === "Active")
      : col === "campaigns"
        ? db.campaigns.filter(c => c.adv === au.name)
        : col === "billing"
          ? db.billing.filter(b => b.adv === au.name)
          : db.support.filter(t => t.user === au.name);

/* ---------- Validation ---------- */

function validate(col, b, existing, au) {
  const sc = SC[col];
  const o = {};

  if (au.portal === "client") {
    b = col === "campaigns"
      ? {
          name: b.name,
          start: b.start,
          end: b.end,
          adv: au.name,
          status: "Pending"
        }
      : {
          subj: b.subj,
          prio: b.prio,
          user: au.name,
          status: "Open"
        };
  }

  for (const f of sc.f) {
    let v = b[f];

    if (NUM.includes(f)) {
      v = Number(v);

      if (!Number.isFinite(v) || v < 0) {
        throw E(400, LBL[f] + " must be a valid number");
      }
    } else {
      v = String(v == null ? "" : v).trim();

      if (!v) {
        throw E(400, LBL[f] + " is required");
      }

      if (v.length > 120) {
        throw E(400, LBL[f] + " is too long");
      }
    }

    if (sc.en && sc.en[f] && !sc.en[f].includes(v)) {
      throw E(400, "Invalid " + LBL[f].toLowerCase());
    }

    if (
      DATE.includes(f) &&
      !/^\d{4}-\d{2}-\d{2}$/.test(v)
    ) {
      throw E(400, LBL[f] + " must be a valid date");
    }

    if (
      f === "email" &&
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)
    ) {
      throw E(400, "Enter a valid email address");
    }

    o[f] = v;
  }

  if (
    sc.uniq &&
    db[col].some(x =>
      (!existing || x.id !== existing.id) &&
      String(x[sc.uniq]).toLowerCase() ===
        String(o[sc.uniq]).toLowerCase()
    )
  ) {
    throw E(409, LBL[sc.uniq] + " already exists");
  }

  if (
    (col === "devices" || col === "partners") &&
    !db.vehicles.some(v => v.no === o.vehicle)
  ) {
    throw E(400, "Vehicle not found. Add the vehicle first.");
  }

  if (
    col === "campaigns" &&
    !db.advertisers.some(a => a.name === o.adv)
  ) {
    throw E(400, "Advertiser not found");
  }

  if (col === "campaigns" && o.end < o.start) {
    throw E(400, "End date must be after the start date");
  }

  if (
    col === "billing" &&
    o.adv !== "Platform" &&
    !db.advertisers.some(a => a.name === o.adv)
  ) {
    throw E(400, "Advertiser not found");
  }

  if (sc.pw) {
    const pw = String(b.password || "");

    if ((!existing && pw.length < 6) || (pw && pw.length < 6)) {
      throw E(400, "Password must be at least 6 characters");
    }

    if (pw) o.pw = hash(pw);
  }

  return o;
}

/* ---------- Live device simulation (computed on request) ---------- */

/*
  The old version used setInterval, which cannot run on serverless.
  Now the simulated movement is advanced whenever /api/live is called.
  Simulated positions are kept in memory only (never saved), so they
  never overwrite real GPS data stored in Supabase.
*/
const simState = new Map();
let lastTick = 0;

function tickSimulation() {
  const now = Date.now();

  if (now - lastTick < 2500) return;
  lastTick = now;

  db.devices.forEach(d => {
    if (
      d.status !== "Online" ||
      (d.real && now - d.real < 30000)
    ) {
      simState.delete(d.dev);
      return;
    }

    const s = simState.get(d.dev) || {
      lat: Number(d.lat),
      lng: Number(d.lng),
      speed: 0
    };

    const h = AREAS[
      (db.vehicles.find(v => v.no === d.vehicle) || {}).area
    ] || AREAS["MG Road"];

    const dist = Math.hypot(h[0] - s.lat, h[1] - s.lng);
    const pull = dist > 0.04 ? 0.35 : 0.04;

    s.lat +=
      (h[0] - s.lat) * pull +
      (Math.random() - 0.5) * 0.0016;

    s.lng +=
      (h[1] - s.lng) * pull +
      (Math.random() - 0.5) * 0.0016;

    s.speed = Math.round(10 + Math.random() * 25);

    simState.set(d.dev, s);
  });
}

/* ---------- API ---------- */

async function api(req, res, pathname) {
  const parts = pathname
    .split("/")
    .filter(Boolean)
    .slice(1);

  const m = req.method;
  const ip = ipOf(req);

  if (m === "POST" && parts[0] === "login") {
    const t = tries.get(ip) || {
      n: 0,
      at: Date.now()
    };

    if (Date.now() - t.at > 300000) {
      t.n = 0;
      t.at = Date.now();
    }

    if (t.n >= 10) {
      throw E(429, "Too many attempts. Try again in a few minutes.");
    }

    const b = await readBody(req);
    const portal = b.portal === "client" ? "client" : "admin";
    const email = String(b.email || "").trim().toLowerCase();

    const rec = (
      portal === "client" ? db.advertisers : db.users
    ).find(x => String(x.email).toLowerCase() === email);

    if (!rec || !verify(String(b.password || ""), rec.pw)) {
      t.n++;
      tries.set(ip, t);
      throw E(401, "Invalid email or password");
    }

    if (portal === "admin" && rec.status !== "Active") {
      throw E(403, "This account is inactive");
    }

    if (portal === "client" && rec.status !== "Approved") {
      throw E(
        403,
        rec.status === "Pending"
          ? "Your account is pending approval"
          : "Your account was not approved"
      );
    }

    audit(rec.name, "Signed in (" + portal + ")", ip);

    if (portal === "client") {
      const at = new Date().toISOString();

      db.logins.unshift({
        id: Math.max(0, ...db.logins.map(l => l.id)) + 1,
        advId: rec.id,
        name: rec.name,
        email: rec.email,
        at,
        ip
      });

      db.logins.length = Math.min(db.logins.length, 500);
      rec.lastLogin = at;
      rec.loginCount = (rec.loginCount || 0) + 1;
    }

    await save();

    return send(res, 200, {
      token: sign({ p: portal, id: rec.id }),
      me: meOf({
        portal,
        rec,
        name: rec.name,
        role: portal === "client" ? "Client" : rec.role
      })
    });
  }

  if (m === "POST" && parts[0] === "device-location") {
    const b = await readBody(req);

    if (!DEVICE_KEY || b.key !== DEVICE_KEY) {
      throw E(401, "Invalid device key");
    }

    const d = db.devices.find(x => x.dev === b.dev);

    if (!d) throw E(404, "Unknown device");

    const lat = Number(b.lat);
    const lng = Number(b.lng);

    if (
      !(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)
    ) {
      throw E(400, "Invalid coordinates");
    }

    Object.assign(d, {
      lat,
      lng,
      speed: Math.max(0, Number(b.speed) || 0),
      status: "Online",
      lastSeenAt: new Date().toISOString(),
      real: Date.now()
    });

    await save();

    return send(res, 200, { ok: true });
  }

  const au = auth(req);

  if (!au) throw E(401, "Please sign in again");

  const col = parts[0];
  const id = parts[1] ? Number(parts[1]) : null;

  if (m === "GET" && col === "me") {
    return send(res, 200, meOf(au));
  }

  if (col === "client-logins") {
    if (au.portal !== "admin") {
      throw E(403, "Not allowed");
    }

    if (m !== "GET") {
      throw E(405, "Method not allowed");
    }

    return send(res, 200, {
      clients: db.advertisers.map(a => ({
        id: a.id,
        name: a.name,
        email: a.email,
        status: a.status,
        lastLogin: a.lastLogin || null,
        loginCount: a.loginCount || 0
      })),
      history: db.logins.slice(0, 200)
    });
  }

  /* Admin opens a client's portal in VIEW-ONLY mode. */

  if (col === "client-view") {
    if (au.portal !== "admin") {
      throw E(403, "Not allowed");
    }

    if (m !== "GET") {
      throw E(405, "View-only");
    }

    const a = db.advertisers.find(x => x.id === id);

    if (!a) throw E(404, "Client not found");

    const cau = {
      portal: "client",
      name: a.name
    };

    const data = {};

    for (const k of ["campaigns", "inventory", "billing", "support"]) {
      data[k] = scoped(cau, k).map(clean);
    }

    audit(
      au.name,
      `Opened client portal view for "${a.name}" (view-only)`,
      ip
    );

    await save();

    return send(res, 200, {
      client: {
        id: a.id,
        name: a.name,
        email: a.email,
        status: a.status
      },
      data
    });
  }

  if (m === "GET" && col === "bootstrap") {
    const data = {};

    for (const k of Object.keys(SC)) {
      if (au.portal === "admin" || can(au, k, "GET")) {
        data[k] = scoped(au, k).map(clean);
      }
    }

    if (au.portal === "admin") {
      data.audit = db.audit.slice(0, 200);
      data.settings = db.settings;
    }

    return send(res, 200, {
      me: meOf(au),
      areas: AREA_NAMES,
      data
    });
  }

  if (au.portal !== "admin" && !SC[col]) {
    throw E(403, "Not allowed");
  }

  if (m === "GET" && col === "live") {
    tickSimulation();

    const ap = db.campaigns.filter(
      c => c.status === "Approved"
    );

    return send(res, 200, {
      at: Date.now(),

      devices: db.devices.map((d, i) => {
        const v = db.vehicles.find(
          x => x.no === d.vehicle
        ) || {};

        const s = simState.get(d.dev);
        const lat = s ? s.lat : d.lat;
        const lng = s ? s.lng : d.lng;

        return {
          id: d.id,
          dev: d.dev,
          vehicle: d.vehicle,
          owner: v.owner || "-",
          homeArea: v.area || "-",
          near: nearest(lat, lng),
          status: d.status,
          lat,
          lng,
          speed: d.status === "Online"
            ? (s ? s.speed : d.speed || 0)
            : 0,
          lastSeenAt: s ? new Date().toISOString() : d.lastSeenAt,
          ad: d.status === "Online" && ap.length
            ? ap[i % ap.length].name
            : null
        };
      })
    });
  }

  if (m === "GET" && col === "audit") {
    return send(res, 200, db.audit.slice(0, 200));
  }

  if (col === "settings" && m === "PUT") {
    if (!["Super Admin", "Admin"].includes(au.role)) {
      throw E(403, "Not allowed");
    }

    const b = await readBody(req);
    const s = db.settings;

    if (b.name !== undefined) {
      s.name = String(b.name).slice(0, 80);
    }

    if (b.email !== undefined) {
      s.email = String(b.email).slice(0, 120);
    }

    if (b.tz !== undefined) {
      s.tz = String(b.tz).slice(0, 40);
    }

    if (b.tfa !== undefined) s.tfa = !!b.tfa;
    if (b.notify !== undefined) s.notify = !!b.notify;

    audit(au.name, "settings: updated", ip);
    await save();

    return send(res, 200, s);
  }

  if (col === "reset" && m === "POST") {
    if (au.role !== "Super Admin") {
      throw E(403, "Only a Super Admin can reset data");
    }

    // Protects real production data from being replaced with demo data.
    if (IS_VERCEL && process.env.ALLOW_DEMO_RESET !== "true") {
      throw E(
        403,
        "Demo reset is disabled in production. " +
        "Set ALLOW_DEMO_RESET=true in Vercel only if you really want this."
      );
    }

    db = normalize(seed(), {});

    audit(au.name, "Demo data reset", ip);

    await save();

    return send(res, 200, { ok: true });
  }

  if (!SC[col]) {
    throw E(404, "Not found");
  }

  if (!can(au, col, m)) {
    throw E(403, "You do not have permission to do that");
  }

  const first = SC[col].f[0];

  if (m === "GET") {
    return send(res, 200, scoped(au, col).map(clean));
  }

  if (m === "POST") {
    const o = validate(col, await readBody(req), null, au);

    const rec = {
      id: nextId(col),
      created: new Date().toISOString(),
      ...o
    };

    if (col === "devices") {
      const h = AREAS[
        db.vehicles.find(v => v.no === o.vehicle).area
      ] || AREAS["MG Road"];

      Object.assign(rec, {
        lat: h[0] + (Math.random() - 0.5) * 0.01,
        lng: h[1] + (Math.random() - 0.5) * 0.01,
        speed: 0,
        lastSeenAt: new Date().toISOString()
      });
    }

    db[col].unshift(rec);

    audit(au.name, `${col}: created "${o[first]}"`, ip);

    await save();

    return send(res, 201, clean(rec));
  }

  const rec = db[col].find(r => r.id === id);

  if (!rec) {
    throw E(404, "Record not found");
  }

  if (au.portal === "client") {
    const own =
      col === "campaigns" ? rec.adv === au.name : false;

    if (!own || rec.status !== "Pending") {
      throw E(403, "Only your pending campaigns can be changed");
    }
  }

  if (m === "PUT") {
    const o = validate(col, await readBody(req), rec, au);

    if (col === "advertisers" && o.name !== rec.name) {
      db.campaigns.forEach(c => {
        if (c.adv === rec.name) c.adv = o.name;
      });

      db.billing.forEach(b => {
        if (b.adv === rec.name) b.adv = o.name;
      });

      db.support.forEach(t => {
        if (t.user === rec.name) t.user = o.name;
      });

      db.logins.forEach(l => {
        if (l.advId === rec.id) l.name = o.name;
      });
    }

    if (col === "vehicles" && o.no !== rec.no) {
      db.devices.forEach(d => {
        if (d.vehicle === rec.no) d.vehicle = o.no;
      });

      db.partners.forEach(p => {
        if (p.vehicle === rec.no) p.vehicle = o.no;
      });
    }

    Object.assign(rec, o);

    audit(au.name, `${col}: updated "${o[first]}"`, ip);

    await save();

    return send(res, 200, clean(rec));
  }

  if (m === "DELETE") {
    if (col === "users" && rec.id === au.rec.id) {
      throw E(400, "You cannot delete your own account");
    }

    if (
      col === "vehicles" &&
      (
        db.devices.some(d => d.vehicle === rec.no) ||
        db.partners.some(p => p.vehicle === rec.no)
      )
    ) {
      throw E(409, "This vehicle is still linked to a device or partner");
    }

    if (
      col === "advertisers" &&
      db.campaigns.some(c => c.adv === rec.name)
    ) {
      throw E(409, "This advertiser still has campaigns");
    }

    db[col] = db[col].filter(r => r !== rec);

    audit(au.name, `${col}: deleted "${rec[first]}"`, ip);

    await save();

    return send(res, 200, { ok: true });
  }

  throw E(405, "Method not allowed");
}

/* ---------- Request handler (used by Vercel AND by server.js) ---------- */

async function handler(req, res) {
  try {
    const url = new URL(req.url, "http://localhost");
    let pathname = url.pathname;

    // vercel.json rewrites /api/xyz -> /api/index?route=xyz.
    // Normally req.url keeps the original path; this is a safety net.
    const route = url.searchParams.get("route");

    if (!pathname.startsWith("/api/") && route !== null) {
      pathname = "/api/" + route;
    } else if (pathname === "/api/index" && route !== null) {
      pathname = "/api/" + route;
    }

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      });
      return res.end();
    }

    await init();

    busy++;

    try {
      await api(req, res, pathname);
    } finally {
      busy--;
    }
  } catch (e) {
    if (!e.code) {
      console.error(e);
    }

    if (!res.headersSent) {
      send(res, e.code || 500, {
        error: e.code ? e.message : "Server error"
      });
    }
  }
}

module.exports = {
  handler,
  init,
  save,
  flush,
  getDb: () => db
};