/**
 * Role-Based Authorization Middleware
 * Handles role checks and permissions for admin operations
 */

/**
 * Require authenticated user with role check
 * @param {string|array} requiredRoles - Single role or array of allowed roles
 * @returns {function} - Express middleware
 */
function requireRole(requiredRoles = []) {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  return (req, res, next) => {
    // Check authentication
    if (!req.session?.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Get user role
    const userRole = req.session.user.role || 'employee';

    // Check role permission
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}. Your role: ${userRole}`,
      });
    }

    // Attach user to request
    req.user = req.session.user;
    req.userRole = userRole;

    return next();
  };
}

/**
 * Require admin role specifically
 * @returns {function} - Express middleware
 */
function requireAdmin(req, res, next) {
  return requireRole('admin')(req, res, next);
}

/**
 * Require admin or manager role
 * @returns {function} - Express middleware
 */
function requireAdminOrManager(req, res, next) {
  return requireRole(['admin', 'manager'])(req, res, next);
}

/**
 * Check if user has specific permission
 * @param {string} permission - Permission to check
 * @returns {function} - Express middleware
 */
function requirePermission(permission) {
  const ROLE_PERMISSIONS = {
    'admin': [
      'send_invites',
      'manage_invites',
      'view_all_users',
      'manage_roles',
      'view_analytics',
      'manage_system',
      'revoke_invites',
      'resend_invites',
    ],
    'manager': [
      'send_invites',
      'view_assigned_users',
      'view_analytics',
      'revoke_invites',
    ],
    'employee': [
      'view_own_profile',
      'upload_files',
    ],
  };

  return (req, res, next) => {
    if (!req.session?.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const userRole = req.session.user.role || 'employee';
    const allowedPermissions = ROLE_PERMISSIONS[userRole] || [];

    if (!allowedPermissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        message: `Permission denied. Required: ${permission}`,
      });
    }

    return next();
  };
}

/**
 * Attach user info to request
 * @param {function} - Express middleware
 */
function attachUserInfo(req, res, next) {
  if (req.session?.user?.id) {
    req.user = {
      id: req.session.user.id,
      email: req.session.user.email,
      fullname: req.session.user.fullname,
      role: req.session.user.role || 'employee',
    };
  }

  return next();
}

/**
 * Check if user is owner or has higher role
 * @param {function} - Express middleware
 */
function requireOwnerOrAdmin(req, res, next) {
  if (!req.session?.user?.id) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  const userRole = req.session.user.role || 'employee';
  const targetUserId = Number(req.params.userId || req.body.userId || 0);
  const currentUserId = req.session.user.id;

  // Allow if admin or if user is editing their own profile
  if (userRole === 'admin' || currentUserId === targetUserId) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: 'Access denied. You can only edit your own profile or you must be an admin',
  });
}

module.exports = {
  requireRole,
  requireAdmin,
  requireAdminOrManager,
  requirePermission,
  attachUserInfo,
  requireOwnerOrAdmin,
};
