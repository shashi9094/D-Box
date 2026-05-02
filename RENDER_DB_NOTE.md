# Important: Database Type

This project now uses PostgreSQL for the runtime database.

If you deploy the app on Railway or Render, point the service at a PostgreSQL database using `DATABASE_URL`.

## Use one of these options

1. Use PostgreSQL for the app runtime and set `DATABASE_URL` in the hosting dashboard.
2. Run the MySQL-to-Postgres migration script before cutover if your existing data still lives in MySQL.

## Legacy MySQL source data

Use the template in `render.env.mysql.example` only as a source database reference for migration. It is not the runtime template anymore.
