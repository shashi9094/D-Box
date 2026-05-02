# Railway Deployment

This app now uses PostgreSQL via `DATABASE_URL`, so Railway should be configured with a PostgreSQL service and the web service should use the same GitHub repo.

Use [railway.env.example](railway.env.example) as the reference for the exact environment variables Railway should contain.

## Required environment variables

- `DATABASE_URL` from Railway Postgres
- `SESSION_SECRET`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `EMAIL_USER`
- `EMAIL_PASSWORD`
- `PUBLIC_APP_URL`
- `UPLOADS_ROOT`

## Upload storage

Railway’s filesystem is ephemeral. Mount a persistent volume and point `UPLOADS_ROOT` to that mount path so profile photos and box uploads survive restarts.

Example:

- `UPLOADS_ROOT=/data/uploads`

## Start command

Use the existing npm start script:

```bash
npm start
```

## MySQL To Postgres Migration

Before cutover, copy data from the old MySQL database into PostgreSQL with:

```bash
npm run migrate:mysql-to-postgres
```

Set the following source database variables when running that script locally or from a secure admin machine:

- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`

The destination database is read from `DATABASE_URL` or the `PG*` variables.

## Notes

- The database adapter accepts either `DATABASE_URL` or the older split PG env vars.
- Uploaded files default to the local `uploads/` directory only if `UPLOADS_ROOT` is not set.
- Existing MySQL data must be migrated into PostgreSQL separately before cutover.
