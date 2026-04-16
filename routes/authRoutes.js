const express = require("express");
const router = express.Router();
const passport = require("passport");
const bcrypt = require("bcryptjs");
const authController = require("../controllers/authController");
const db = require("../db/connection");
const { logLoginHistory } = require("../utils/loginHistory");
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function requireSessionUser(req, res, next) {
  if (!req.session?.user?.id) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  return next();
}

function isValidGoogleClientId(value) {
  return /^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i.test(String(value || '').trim());
}

function maskClientId(value) {
  const id = String(value || '').trim();
  if (!id) return '(empty)';
  if (id.length <= 18) return `${id.slice(0, 4)}...`;
  return `${id.slice(0, 10)}...${id.slice(-18)}`;
}

const googleClientId = String(process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_iD || '').trim();
const googleClientSecret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
const googleCallbackUrl = String(process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback').trim();

const googleAuthEnabled = Boolean(
  isValidGoogleClientId(googleClientId) &&
  googleClientSecret
);

// Normal signup
router.post("/signup", authController.signup);

// Normal login
router.post("/login", authController.login);

router.get("/session", (req, res) => {
  const sessionUser = req.session?.user;
  if (sessionUser) {
    const loginAt = Number(sessionUser.loginAt || 0);
    const isExpired = !Number.isFinite(loginAt) || (Date.now() - loginAt) > SESSION_MAX_AGE_MS;

    if (isExpired) {
      return req.session.destroy(() => {
        res.clearCookie("connect.sid");
        return res.json({
          authenticated: false,
          user: null,
          reason: "session-expired",
        });
      });
    }
  }

  res.json({
    authenticated: !!sessionUser,
    user: sessionUser || null,
  });
});

router.get("/google/status", (req, res) => {
  res.json({
    googleAuthEnabled,
    clientIdMasked: maskClientId(googleClientId),
    validClientIdFormat: isValidGoogleClientId(googleClientId),
    hasClientSecret: Boolean(googleClientSecret),
    callbackURL: googleCallbackUrl,
  });
});

router.get("/status", async (req, res) => {
  db.query("SELECT 1 AS ok", (err) => {
    const dbStatus = err
      ? {
          connected: false,
          code: err.code || null,
          message: err.sqlMessage || err.message || "Database error",
        }
      : {
          connected: true,
        };

    return res.json({
      googleAuthEnabled,
      google: {
        clientIdMasked: maskClientId(googleClientId),
        validClientIdFormat: isValidGoogleClientId(googleClientId),
        hasClientSecret: Boolean(googleClientSecret),
        callbackURL: googleCallbackUrl,
      },
      database: dbStatus,
    });
  });
});

router.get("/db-context", requireSessionUser, async (req, res) => {
  const currentUserId = Number(req.session.user.id);

  try {
    const sql = db.promise();

    const [dbNameRows] = await sql.query("SELECT DATABASE() AS dbName");
    const [ownerRows] = await sql.query(
      `SELECT b.id, b.title, b.user_id
       FROM boxes b
       WHERE b.user_id = ?
       ORDER BY b.id DESC`,
      [currentUserId]
    );
    const [memberRows] = await sql.query(
      `SELECT bm.box_id, bm.role, b.title
       FROM box_members bm
       JOIN boxes b ON b.id = bm.box_id
       WHERE bm.user_id = ?
       ORDER BY bm.box_id DESC`,
      [currentUserId]
    );

    return res.json({
      connectedDatabase: dbNameRows[0]?.dbName || process.env.DB_NAME || null,
      dbHost: process.env.DB_HOST || "localhost",
      dbPort: Number(process.env.DB_PORT || 3306),
      sessionUser: {
        id: currentUserId,
        email: req.session.user.email || null,
      },
      ownerBoxes: ownerRows,
      memberBoxes: memberRows,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Unable to resolve db context",
      error: error.message,
    });
  }
});

router.get("/login-history", requireSessionUser, async (req, res) => {
  const currentUserId = Number(req.session.user.id);
  const limitValue = Number(req.query?.limit);
  const limit = Number.isFinite(limitValue) ? Math.min(Math.max(Math.floor(limitValue), 1), 200) : 50;
  const emailFilter = String(req.query?.email || "").trim().toLowerCase();

  try {
    const sql = db.promise();

    const [roleRows] = await sql.query(
      "SELECT role FROM users WHERE id = ? LIMIT 1",
      [currentUserId]
    );

    if (!roleRows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    if (String(roleRows[0].role || "User") !== "Admin") {
      return res.status(403).json({ message: "Only admin can view login history" });
    }

    let query = `
      SELECT lh.id, lh.user_id, lh.email, lh.login_at, lh.ip_address, lh.user_agent,
             lh.device_type, lh.browser, lh.os, u.fullName
      FROM login_history lh
      LEFT JOIN users u ON u.id = lh.user_id
    `;
    const params = [];

    if (emailFilter) {
      query += " WHERE LOWER(lh.email) = LOWER(?)";
      params.push(emailFilter);
    }

    query += ` ORDER BY lh.id DESC LIMIT ${limit}`;

    const [rows] = await sql.query(query, params);

    return res.json({
      success: true,
      data: rows,
      limit,
      totalFetched: rows.length,
    });
  } catch (error) {
    if (error && error.code === "ER_NO_SUCH_TABLE") {
      return res.json({
        success: true,
        data: [],
        limit,
        totalFetched: 0,
        message: "login_history table not found yet",
      });
    }

    return res.status(500).json({
      message: "Unable to fetch login history",
      error: error.message,
    });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Logout failed" });
    }

    res.clearCookie("connect.sid");
    return res.json({ message: "Logout successful" });
  });
});

router.post("/logout-all", requireSessionUser, (req, res) => {
  const currentUserId = Number(req.session.user.id);
  const store = req.sessionStore;

  if (!store || typeof store.all !== "function" || typeof store.destroy !== "function") {
    return req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      return res.json({
        message: "Logged out from current device. Logout-all is not supported by this session store.",
      });
    });
  }

  store.all((allErr, sessions) => {
    if (allErr) {
      return res.status(500).json({ message: "Unable to fetch active sessions" });
    }

    const sessionEntries = Object.entries(sessions || {});
    const matchingSessionIds = sessionEntries
      .filter(([, sess]) => Number(sess?.user?.id) === currentUserId)
      .map(([sid]) => sid);

    if (!matchingSessionIds.length) {
      return req.session.destroy((err) => {
        if (err) {
          return res.status(500).json({ message: "Logout failed" });
        }
        res.clearCookie("connect.sid");
        return res.json({ message: "Logout successful" });
      });
    }

    let pending = matchingSessionIds.length;
    let failed = false;

    matchingSessionIds.forEach((sid) => {
      store.destroy(sid, (destroyErr) => {
        if (destroyErr) {
          failed = true;
        }

        pending -= 1;
        if (pending === 0) {
          res.clearCookie("connect.sid");
          if (failed) {
            return res.status(500).json({ message: "Some sessions could not be terminated" });
          }
          return res.json({ message: "Logged out from all active devices" });
        }
      });
    });
  });
});

router.get("/profile", requireSessionUser, (req, res) => {
  const currentUserId = Number(req.session.user.id);
  const loginAt = Number(req.session.user.loginAt || 0);

  const userSql = "SELECT id, fullName, email, role, created_at FROM users WHERE id = ? LIMIT 1";
  db.query(userSql, [currentUserId], (userErr, userRows) => {
    if (userErr) {
      return res.status(500).json({ message: "Unable to fetch profile" });
    }

    if (!userRows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userRows[0];
    const role = String(user.role || 'User');
    const emailHash = require("crypto").createHash("md5").update(String(user.email || "").trim().toLowerCase()).digest("hex");

    return res.json({
      profile: {
        name: user.fullName,
        email: user.email,
        role,
        joinedAt: user.created_at,
        lastLoginAt: Number.isFinite(loginAt) && loginAt > 0 ? new Date(loginAt).toISOString() : null,
        profilePhoto: `https://www.gravatar.com/avatar/${emailHash}?d=identicon&s=160`,
      },
    });
  });
});

router.put("/profile", requireSessionUser, (req, res) => {
  const currentUserId = Number(req.session.user.id);
  const fullName = String(req.body?.fullName || "").trim();

  if (!fullName) {
    return res.status(400).json({ message: "Name is required" });
  }

  if (fullName.length > 255) {
    return res.status(400).json({ message: "Name is too long" });
  }

  db.query("UPDATE users SET fullName = ? WHERE id = ?", [fullName, currentUserId], (err) => {
    if (err) {
      return res.status(500).json({ message: "Unable to update profile" });
    }

    req.session.user.fullName = fullName;
    return res.json({ message: "Profile updated successfully" });
  });
});

router.post("/change-password", requireSessionUser, async (req, res) => {
  const currentUserId = Number(req.session.user.id);
  const currentPassword = String(req.body?.currentPassword || "");
  const newPassword = String(req.body?.newPassword || "");

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Current and new password are required" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: "New password must be at least 6 characters" });
  }

  db.query("SELECT password FROM users WHERE id = ? LIMIT 1", [currentUserId], async (err, rows) => {
    if (err) {
      return res.status(500).json({ message: "Unable to change password" });
    }

    if (!rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    const savedPassword = String(rows[0].password || "");
    let isMatch = false;

    if (savedPassword.startsWith("$2")) {
      isMatch = await bcrypt.compare(currentPassword, savedPassword);
    } else {
      isMatch = currentPassword === savedPassword;
    }

    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    db.query("UPDATE users SET password = ? WHERE id = ?", [hashedNewPassword, currentUserId], (updateErr) => {
      if (updateErr) {
        return res.status(500).json({ message: "Unable to update password" });
      }

      return res.json({ message: "Password changed successfully" });
    });
  });
});

router.post('/accept-invite', authController.acceptInviteForSession);

// Google login start
router.get("/google", (req, res, next) => {
  if (!googleAuthEnabled) {
    return res.redirect("/login.html?google=disabled");
  }

  return passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
});

// Google callback
router.get("/google/callback", (req, res, next) => {
  if (!googleAuthEnabled) {
    return res.redirect("/login.html?google=disabled");
  }

  return passport.authenticate("google", { failureRedirect: "/login.html" })(req, res, next);
},
  (req, res) => {
    req.session.user = {
      id: req.user.id,
      email: req.user.email,
      loginAt: Date.now(),
    };

    req.session.cookie.maxAge = SESSION_MAX_AGE_MS;

    req.session.save(() => {
      logLoginHistory({
        userId: req.user.id,
        email: req.user.email,
        req,
      });

      res.redirect("/home");
    });
  }
);

module.exports = router;
