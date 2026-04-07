# Important: Database Type

This project currently uses MySQL (`mysql2`) and MySQL SQL syntax.

If you use Render PostgreSQL credentials (from a `postgresql://...` URL), this app will not connect because PostgreSQL is a different database engine.

## Use one of these options

1. Use a public MySQL provider (PlanetScale, Railway MySQL, Aiven MySQL, etc.) and put those values into Render env vars.
2. Migrate the application from MySQL to PostgreSQL (code and SQL changes required).

## If you keep MySQL

Use the template in `render.env.mysql.example` and set all variables in Render dashboard.
