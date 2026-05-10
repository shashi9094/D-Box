# API Documentation - D-Box Admin Dashboard

Complete REST API documentation for the Super Admin Dashboard.

## Base URL

- **Development**: `http://localhost:5000/api`
- **Production**: `https://your-backend-url.railway.app/api`

## Authentication

All protected endpoints require JWT token in the Authorization header:

```
Authorization: Bearer <JWT_TOKEN>
```

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Additional details (in development)"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized (Missing/Invalid token)
- `403` - Forbidden (Access denied)
- `404` - Not Found
- `500` - Server Error

---

## Authentication Endpoints

### POST /auth/login

Login a user and get JWT token.

**Request:**
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@dbox.com",
    "password": "password123"
  }'
```

**Request Body:**
```json
{
  "email": "admin@dbox.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Admin User",
    "username": "admin",
    "email": "admin@dbox.com",
    "role": "SUPER_ADMIN",
    "storageUsed": 1073741824,
    "storageLimit": 10737418240
  }
}
```

---

### POST /auth/register

Register a new user account.

**Request:**
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "username": "johndoe",
    "email": "john@example.com",
    "password": "SecurePassword123!"
  }'
```

**Request Body:**
```json
{
  "name": "John Doe",
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Registration successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "name": "John Doe",
    "username": "johndoe",
    "email": "john@example.com",
    "role": "USER"
  }
}
```

---

### POST /auth/logout

Logout current user (requires authentication).

**Request:**
```bash
curl -X POST http://localhost:5000/api/auth/logout \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

## User Management Endpoints

**All endpoints require SUPER_ADMIN role**

### GET /admin/users

Get all users with pagination and search.

**Query Parameters:**
- `limit` (optional): Items per page (default: 20, max: 100)
- `offset` (optional): Pagination offset (default: 0)
- `search` (optional): Search by email, username, or name

**Request:**
```bash
curl -X GET "http://localhost:5000/api/admin/users?limit=20&offset=0&search=john" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174001",
      "name": "John Doe",
      "username": "johndoe",
      "email": "john@example.com",
      "role": "USER",
      "is_banned": false,
      "storage_limit": 10737418240,
      "storage_used": 1073741824,
      "created_at": "2024-01-15T10:30:00Z",
      "last_login": "2024-01-20T14:25:00Z"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 20,
    "offset": 0,
    "pages": 8
  }
}
```

---

### GET /admin/users/:userId

Get specific user details with files and login history.

**Request:**
```bash
curl -X GET "http://localhost:5000/api/admin/users/123e4567-e89b-12d3-a456-426614174001" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "name": "John Doe",
    "username": "johndoe",
    "email": "john@example.com",
    "role": "USER",
    "is_banned": false,
    "storage_limit": 10737418240,
    "storage_used": 1073741824,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-20T14:25:00Z",
    "last_login": "2024-01-20T14:25:00Z",
    "files": [
      {
        "id": "file-123",
        "file_name": "document.pdf",
        "file_url": "https://s3.amazonaws.com/...",
        "file_size": 2097152,
        "mime_type": "application/pdf",
        "uploaded_at": "2024-01-20T10:00:00Z"
      }
    ],
    "loginHistory": [
      {
        "id": "login-123",
        "ip_address": "192.168.1.1",
        "login_at": "2024-01-20T14:25:00Z",
        "logout_at": "2024-01-20T15:30:00Z"
      }
    ],
    "activityLogs": [...]
  }
}
```

---

### GET /admin/users/email/:email

Get user by email address.

**Request:**
```bash
curl -X GET "http://localhost:5000/api/admin/users/email/john@example.com" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (200):**
Same as GET /admin/users/:userId

---

### PATCH /admin/users/:userId/ban

Ban a user (prevent login).

**Request:**
```bash
curl -X PATCH "http://localhost:5000/api/admin/users/123e4567-e89b-12d3-a456-426614174001/ban" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (200):**
```json
{
  "success": true,
  "message": "User banned successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "is_banned": true
  }
}
```

---

### PATCH /admin/users/:userId/unban

Unban a user.

**Request:**
```bash
curl -X PATCH "http://localhost:5000/api/admin/users/123e4567-e89b-12d3-a456-426614174001/unban" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (200):**
```json
{
  "success": true,
  "message": "User unbanned successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "is_banned": false
  }
}
```

---

### PATCH /admin/users/:userId/role

Change user role.

**Request:**
```bash
curl -X PATCH "http://localhost:5000/api/admin/users/123e4567-e89b-12d3-a456-426614174001/role" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"role": "ADMIN"}'
```

**Request Body:**
```json
{
  "role": "ADMIN"
}
```

**Valid Roles:** `USER`, `ADMIN`, `SUPER_ADMIN`

**Response (200):**
```json
{
  "success": true,
  "message": "User role changed successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "email": "john@example.com",
    "role": "ADMIN"
  }
}
```

---

### PATCH /admin/users/:userId/storage

Update user storage limit.

**Request:**
```bash
curl -X PATCH "http://localhost:5000/api/admin/users/123e4567-e89b-12d3-a456-426614174001/storage" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"storageLimit": 21474836480}'
```

**Request Body:**
```json
{
  "storageLimit": 21474836480
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Storage limit updated successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "storage_limit": 21474836480
  }
}
```

---

### PATCH /admin/users/:userId/login-as

Login as a user (support access without password).

**Request:**
```bash
curl -X PATCH "http://localhost:5000/api/admin/users/123e4567-e89b-12d3-a456-426614174001/login-as" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged in as user",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174001",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "USER"
  }
}
```

---

### DELETE /admin/users/:userId

Delete a user and all associated data.

**Request:**
```bash
curl -X DELETE "http://localhost:5000/api/admin/users/123e4567-e89b-12d3-a456-426614174001" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (200):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

---

## File Management Endpoints

### GET /admin/files

Get all files with pagination.

**Query Parameters:**
- `limit`: Items per page (default: 50)
- `offset`: Pagination offset (default: 0)

**Request:**
```bash
curl -X GET "http://localhost:5000/api/admin/files?limit=50&offset=0" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "file-123",
      "user_id": "123e4567-e89b-12d3-a456-426614174001",
      "file_name": "document.pdf",
      "file_url": "https://s3.amazonaws.com/bucket/uploads/file-123.pdf",
      "file_size": 2097152,
      "mime_type": "application/pdf",
      "uploaded_at": "2024-01-20T10:00:00Z",
      "user": {
        "id": "123e4567-e89b-12d3-a456-426614174001",
        "email": "john@example.com"
      }
    }
  ],
  "pagination": {
    "total": 500,
    "limit": 50,
    "offset": 0,
    "pages": 10
  }
}
```

---

### GET /admin/files/user/:userId

Get files uploaded by specific user.

**Request:**
```bash
curl -X GET "http://localhost:5000/api/admin/files/user/123e4567-e89b-12d3-a456-426614174001?limit=20&offset=0" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (200):**
Similar to GET /admin/files

---

### DELETE /admin/files/:fileId

Delete a file.

**Request:**
```bash
curl -X DELETE "http://localhost:5000/api/admin/files/file-123" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (200):**
```json
{
  "success": true,
  "message": "File deleted successfully"
}
```

---

## Analytics Endpoints

### GET /admin/analytics/stats

Get system statistics and analytics.

**Request:**
```bash
curl -X GET "http://localhost:5000/api/admin/analytics/stats" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 150,
      "activeUsers": 45,
      "totalFiles": 1200,
      "totalStorageUsed": 107374182400,
      "avgStoragePerUser": 715827880
    },
    "actionStats": [
      {
        "action": "USER_BANNED",
        "count": 5
      },
      {
        "action": "FILE_DELETED",
        "count": 25
      }
    ],
    "dailyActivity": [
      {
        "date": "2024-01-20",
        "activity_count": 45
      },
      {
        "date": "2024-01-21",
        "activity_count": 67
      }
    ]
  }
}
```

---

### GET /admin/analytics/metrics

Get dashboard metrics with formatted data.

**Request:**
```bash
curl -X GET "http://localhost:5000/api/admin/analytics/metrics" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "totalUsers": 150,
      "activeUsers": 45,
      "totalFiles": 1200,
      "totalStorageUsed": 107374182400,
      "storageUsedGB": "100.00",
      "avgStoragePerUser": "0.67",
      "recentRegistrations": 12
    }
  }
}
```

---

## Activity Logs Endpoints

### GET /admin/activity

Get all activity logs.

**Query Parameters:**
- `limit`: Items per page (default: 50)
- `offset`: Pagination offset (default: 0)
- `action`: Filter by action type (optional)

**Request:**
```bash
curl -X GET "http://localhost:5000/api/admin/activity?limit=50&offset=0&action=USER_BANNED" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "log-123",
      "admin_id": "admin-id-123",
      "action": "USER_BANNED",
      "target_user": "user-id-456",
      "target_file": null,
      "description": "User john@example.com has been banned",
      "created_at": "2024-01-20T14:30:00Z",
      "admin": {
        "id": "admin-id-123",
        "email": "admin@dbox.com",
        "name": "Admin User"
      },
      "targetUserData": {
        "id": "user-id-456",
        "email": "john@example.com",
        "name": "John Doe"
      }
    }
  ],
  "pagination": {
    "total": 300,
    "limit": 50,
    "offset": 0,
    "pages": 6
  }
}
```

---

### GET /admin/activity/user/:userId

Get activity logs for specific user.

**Request:**
```bash
curl -X GET "http://localhost:5000/api/admin/activity/user/user-id-456?limit=20&offset=0" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (200):**
Similar to GET /admin/activity

---

## Settings Endpoints

### GET /admin/settings

Get all system settings.

**Request:**
```bash
curl -X GET "http://localhost:5000/api/admin/settings" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "site_name": "D-Box Admin",
    "max_upload_size": "10737418240",
    "maintenance_mode": "false",
    "daily_backup": "true"
  }
}
```

---

### GET /admin/settings/:key

Get specific setting.

**Request:**
```bash
curl -X GET "http://localhost:5000/api/admin/settings/site_name" \
  -H "Authorization: Bearer <TOKEN>"
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "setting-123",
    "key": "site_name",
    "value": "D-Box Admin"
  }
}
```

---

### PATCH /admin/settings

Update multiple settings.

**Request:**
```bash
curl -X PATCH "http://localhost:5000/api/admin/settings" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "site_name": "D-Box Pro",
      "maintenance_mode": "false"
    }
  }'
```

**Request Body:**
```json
{
  "settings": {
    "site_name": "D-Box Pro",
    "max_upload_size": "21474836480",
    "maintenance_mode": "false"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Settings updated successfully",
  "data": {
    "site_name": "D-Box Pro",
    "max_upload_size": "21474836480",
    "maintenance_mode": "false"
  }
}
```

---

## Rate Limiting

API endpoints are rate-limited:
- **Standard**: 100 requests per 15 minutes
- **Admin**: 500 requests per 15 minutes

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642700400
```

---

## Testing Endpoints

### Health Check

```bash
curl http://localhost:5000/health
```

Response:
```json
{
  "success": true,
  "message": "Server is running"
}
```

---

## Common Response Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | User retrieved |
| 201 | Created | User registered |
| 400 | Bad Request | Missing required fields |
| 401 | Unauthorized | Invalid/expired token |
| 403 | Forbidden | Not SUPER_ADMIN |
| 404 | Not Found | User doesn't exist |
| 500 | Server Error | Database error |

---

## Pagination

All list endpoints support pagination:

```
GET /api/admin/users?limit=20&offset=0
```

Response includes:
```json
{
  "pagination": {
    "total": 150,      // Total items
    "limit": 20,       // Items per page
    "offset": 0,       // Current offset
    "pages": 8         // Total pages
  }
}
```

---

## Best Practices

1. **Always include Authorization header** for protected endpoints
2. **Handle rate limiting** - implement exponential backoff
3. **Validate input** - check data before sending
4. **Cache responses** - reduce server load
5. **Use pagination** - don't fetch all data at once
6. **Log errors** - track failures for debugging
7. **Update token** - refresh before expiration
8. **Handle timeouts** - implement retry logic

---

**API Version**: 1.0
**Last Updated**: January 2024
