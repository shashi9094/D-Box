const express = require("express");
const router = express.Router();
const passport = require("passport");
const bcrypt = require("bcryptjs");
const authController = require("../controllers/authController");
const db = require("../db/connection");
const { logLoginHistory, isNewDeviceLogin } = require("../utils/loginHistory");
const {
  listUserNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
  deleteNotification,
  createNotification,
  createNotificationsForUsers,
} = require("../utils/notifications");
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

router.get('/account-exists', authController.checkAccountExists);

router.get('/notifications', requireSessionUser, async (req, res) => {
  const currentUserId = Number(req.session.user.id);
  const limitValue = Number(req.query?.limit);
  const limit = Number.isFinite(limitValue)
    ? Math.min(Math.max(Math.floor(limitValue), 1), 200)
    : 30;

  try {
    const [items, unreadCount] = await Promise.all([
      listUserNotifications(currentUserId, limit),
      getUnreadNotificationCount(currentUserId),
    ]);

    return res.json({
      success: true,
      data: items,
      unreadCount,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to load notifications',
      error: error.message,
    });
  }
});

router.post('/notifications/read', requireSessionUser, async (req, res) => {
  const currentUserId = Number(req.session.user.id);
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : null;

  try {
    const updated = await markNotificationsRead(currentUserId, ids);
    const unreadCount = await getUnreadNotificationCount(currentUserId);

    return res.json({
      success: true,
      updated,
      unreadCount,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to mark notifications as read',
      error: error.message,
    });
  }
});

router.delete('/notifications/:id', requireSessionUser, async (req, res) => {
  const currentUserId = Number(req.session.user.id);
  const notificationId = Number(req.params?.id);

  try {
    const deleted = await deleteNotification(currentUserId, notificationId);
    const unreadCount = await getUnreadNotificationCount(currentUserId);

    if (!deleted) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    return res.json({
      success: true,
      message: 'Notification deleted',
      unreadCount,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to delete notification',
      error: error.message,
    });
  }
});

router.post('/notifications/ask', requireSessionUser, async (req, res) => {
  const currentUserId = Number(req.session.user.id);
  const questionText = String(req.body?.message || '').trim();
  const boxId = Number(req.body?.boxId);

  if (!questionText) {
    return res.status(400).json({ message: 'Question is required' });
  }

  if (questionText.length > 1000) {
    return res.status(400).json({ message: 'Question is too long' });
  }

  if (!Number.isFinite(boxId) || boxId <= 0) {
    return res.status(400).json({ message: 'Valid box ID is required' });
  }

  try {
    const sql = db.promise();

    const [senderRows] = await sql.query(
      'SELECT id, fullName, email FROM users WHERE id = ? LIMIT 1',
      [currentUserId]
    );

    if (!senderRows.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    const sender = senderRows[0];
    const senderName = String(sender.fullName || sender.email || `User ${currentUserId}`).trim();
    const senderEmail = String(sender.email || '').trim().toLowerCase();

    // Get box details
    const [boxRows] = await sql.query(
      'SELECT id, title FROM boxes WHERE id = ? LIMIT 1',
      [boxId]
    );

    if (!boxRows.length) {
      return res.status(404).json({ message: 'Box not found' });
    }

    const boxTitle = String(boxRows[0].title || `Box ${boxId}`).trim();

    // Get box owner and admin members
    const [adminRows] = await sql.query(
      `SELECT DISTINCT bm.user_id FROM box_members bm
       WHERE bm.box_id = ? AND bm.role IN ('Admin', 'admin')
       UNION
       SELECT b.user_id FROM boxes b WHERE b.id = ?`,
      [boxId, boxId]
    );

    const adminIds = adminRows
      .map((row) => Number(row.user_id))
      .filter((id) => Number.isFinite(id) && id !== currentUserId);

    const uniqueAdminIds = [...new Set(adminIds)];

    await createNotificationsForUsers(uniqueAdminIds, {
      type: 'user_question',
      title: `New question in ${boxTitle}`,
      message: `${senderName} asked: ${questionText}`,
      details: {
        fromUserId: currentUserId,
        fromName: senderName,
        fromEmail: senderEmail,
        boxId: boxId,
        boxTitle: boxTitle,
        question: questionText,
      },
    });

    await createNotification({
      userId: currentUserId,
      type: 'question_sent',
      title: `Question sent in ${boxTitle}`,
      message: 'Your question has been sent to admins. They will review it soon.',
      details: {
        boxId: boxId,
        boxTitle: boxTitle,
        question: questionText,
      },
    });

    return res.json({
      success: true,
      notifiedAdmins: uniqueAdminIds.length,
      message: 'Question sent successfully',
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Unable to send question',
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
          if (failed) {
            return res.status(500).json({ message: "Logout failed" });
          }

          res.clearCookie("connect.sid");
          return res.json({ message: "Logout successful" });
        }
      });
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
  async (req, res) => {
    req.session.user = {
      id: req.user.id,
      email: req.user.email,
      loginAt: Date.now(),
    };

    req.session.cookie.maxAge = SESSION_MAX_AGE_MS;

    let shouldNotifyNewDevice = false;
    try {
      shouldNotifyNewDevice = await isNewDeviceLogin({ userId: req.user.id, req });
    } catch (deviceErr) {
      console.warn('Unable to evaluate device novelty for Google login:', deviceErr.message);
    }

    req.session.save(() => {
      logLoginHistory({
        userId: req.user.id,
        email: req.user.email,
        req,
      });

      if (shouldNotifyNewDevice) {
        const ipAddress = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim()
          || req?.ip
          || req?.socket?.remoteAddress
          || 'Unknown IP';

        const userAgent = String(req?.headers?.['user-agent'] || '').trim() || 'Unknown device';

        createNotification({
          userId: req.user.id,
          type: 'new_device_login',
          title: 'New device login detected',
          message: 'Your account was logged in from a new device/browser.',
          details: {
            ipAddress,
            userAgent,
            email: String(req.user.email || '').trim().toLowerCase(),
          },
        }).catch((notifyErr) => {
          console.warn('Google login device notification failed:', notifyErr.message);
        });
      }

      res.redirect("/home");
    });
  }
);

module.exports = router;
