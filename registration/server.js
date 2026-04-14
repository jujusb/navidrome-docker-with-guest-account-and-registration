const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Config
const ND_API = process.env.ND_API_URL || "http://navidrome:4533/rest";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const DB_PATH = process.env.DB_PATH || "/data/navidrome.db";
const SUBSONIC_CLIENT = process.env.ND_CLIENT_NAME || "registration";
const SUBSONIC_VERSION = process.env.ND_API_VERSION || "1.16.1";
const GUEST_EXPIRATION_HOURS = process.env.GUEST_EXPIRATION_HOURS ? parseFloat(process.env.GUEST_EXPIRATION_HOURS) : 24;

function getRestBase(url) {
  const trimmed = (url || "").replace(/\/+$/, "");
  return trimmed.endsWith("/rest") ? trimmed : `${trimmed}/rest`;
}

const ND_REST = getRestBase(ND_API);
const ND_BASE = ND_REST.replace(/\/rest$/, "");

let adminCreated = false;
let ensureAdminAttempts = 0;

function isAdminInDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
    });

    db.get(
      "SELECT 1 FROM user WHERE user_name = ? LIMIT 1",
      [ADMIN_USERNAME],
      (err, row) => {
        console.log(`Checked for admin in DB: ${err ? 'Error' : row ? 'Found' : 'Not found'}`);
        db.close();
        if (err) return reject(err);
        resolve(!!row);
      }
    );
  });
}

async function waitForApiReady() {
  console.log(`Checking Navidrome API readiness at ${ND_REST}/ping.view`);
  try {
    await axios.get(`${ND_REST}/ping.view`, {
      params: {
        u: ADMIN_USERNAME,
        p: ADMIN_PASSWORD,
        v: SUBSONIC_VERSION,
        c: SUBSONIC_CLIENT,
        f: "json",
      },
      timeout: 3000,
      validateStatus: () => true,
    });
    console.log("Navidrome API is reachable");
    return true;
  } catch {
    console.log("Navidrome API is not reachable yet");
    return false;
  }
}

async function getAdminToken() {
  const response = await axios.post(
    `${ND_BASE}/auth/login`,
    { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
    { timeout: 5000, validateStatus: () => true }
  );

  if (response.status !== 200 || !response.data?.token) {
    throw new Error(
      `Admin login failed (${response.status}): ${response.data?.error || "no token"}`
    );
  }

  return response.data.token;
}

// Helper to create a user through Navidrome native API
async function createUser(username, password, role = "user") {
  const isAdmin = role === "admin";

  try {
    const token = await getAdminToken();

    const response = await axios.post(`${ND_BASE}/api/user`, {
      userName: username,
      password,
      isAdmin,
    }, {
      headers: {
        "Content-Type": "application/json",
        "x-nd-authorization": `Bearer ${token}`,
      },
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      const errMsg = response.data?.error || `HTTP ${response.status}`;
      console.error(`Failed to create user ${username}: ${errMsg}`);
      return { ok: false, error: errMsg };
    }

    console.log(`Created ${role} user: ${username}`);
    return { ok: true };
  } catch (e) {
    console.error(`Failed to create user ${username}:`, e.response?.data || e.message);
    return { ok: false, error: e.message };
  }
}

async function removeUnusedGuestsMoreThanOneDay() {
  try {
    const token = await getAdminToken();
    
    const response = await axios.get(`${ND_BASE}/api/user`, {
      headers: { "x-nd-authorization": `Bearer ${token}` },
      validateStatus: () => true,
    });
    console.log("Fetched users for cleanup:", response);
    if (response.status !== 200) {
      console.error(`Failed to fetch users for cleanup: HTTP ${response.status}`);
      console.error('Full response data:', data);
      return;
    }
    
    let data = null;
    try { data = await response.data; } catch (_) {}
    console.log("Fetched users for cleanup:", data);
      if (!data) {
        console.error('Failed to fetch users for cleanup: response.data is null or undefined');
        if (response.request && response.request.res && response.request.res.responseUrl) {
          console.error('Raw response URL:', response.request.res.responseUrl);
        }
        return;
      }
      if (!Array.isArray(data)) {
        console.error('Failed to fetch users for cleanup: users array missing in response');
        console.error('Full response data:', data);
        return;
      }

    const guests = data
      .filter(u => u.userName.startsWith("guest_"));
    console.log(`Found ${guests.length} guest users, checking for old ones...`);
    console.log("Guest users:", guests);
    const oldGuests = guests
      .filter(g => {
        const createdAt = new Date(g.created);
        const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
        return ageHours > GUEST_EXPIRATION_HOURS;
      }
    );
    console.log(`Found ${oldGuests.length} old guest users, removing...`);
    for (const guest of oldGuests) {
      await axios.delete(`${ND_BASE}/api/user/${guest.id}`, {
        headers: { "x-nd-authorization": `Bearer ${token}` },
        validateStatus: () => true,
      });
      console.log(`Removed unused guest user: ${guest.userName}`);
    }
  } catch (e) {
    console.error("Failed to remove unused guests:", e.response?.data || e.message);
  }
}

async function createAdminInDB() {
  console.log("Starting admin bootstrap check...");
  const apiReady = await waitForApiReady();
  if (!apiReady) {
    throw new Error("Navidrome API not ready");
  }

  const adminExists = await isAdminInDatabase();
  if (adminExists) {
    console.log(`Admin user '${ADMIN_USERNAME}' already exists in database`);
    return;
  }

  console.log("No admin found, creating in database...");

  const created = await createUser(ADMIN_USERNAME, ADMIN_PASSWORD, "admin");
  if (!created.ok) {
    if ((created.error || "").toLowerCase().includes("already exists")) {
      console.log(`Admin user '${ADMIN_USERNAME}' already exists in database`);
      return;
    }

    throw new Error(`Failed while creating admin via API: ${created.error}`);
  }

  const createdInDb = await isAdminInDatabase();
  if (!createdInDb) {
    throw new Error("Admin creation request succeeded but user not found in database yet");
  }

  console.log(`Admin user '${ADMIN_USERNAME}' created successfully in database`);
}

// On startup: check if admin exists, if not create it
async function ensureAdmin() {
  ensureAdminAttempts += 1;
  console.log(`ensureAdmin attempt #${ensureAdminAttempts}`);
  try {
    await createAdminInDB();
    adminCreated = true;
    console.log("Admin bootstrap complete. Registration is ready.");
  } catch (e) {
    console.log(`Admin bootstrap failed: ${e.message}. Retrying in 5s...`);
    setTimeout(ensureAdmin, 5000);
  }
}

app.get('/guest', async (req, res) => {
  await removeUnusedGuestsMoreThanOneDay();
  const guestUserName = `guest_${Date.now()}`;
  const guestPassword = Math.random().toString(36).slice(-8);
  let result = await createUser(guestUserName, guestPassword, "user");
  res.json({
    success: result.ok,
    username: guestUserName,
    password: guestPassword,
    error: result.error || null
  });
});

// Self-registration endpoint
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send("Username & password required");

  if (!adminCreated) return res.status(503).send("Admin not ready yet");

  console.log(`Registration requested for user: ${username}`);

  const result = await createUser(username, password, "user");
  console.log(`Registration result for ${username}: ${result.ok ? 'success' : 'failed'}`);
  res.json({
    success: result.ok,
    user: username,
    error: result.error || null
  });
});

// Start the server
(async () => {
  try {
    console.log("Starting registration service bootstrap...");
    await ensureAdmin();
    app.listen(3000, () => {
      console.log("Registration service running on port 3000");
    });
  } catch (e) {
    console.error("Error ensuring admin user:", e);
  }
})();