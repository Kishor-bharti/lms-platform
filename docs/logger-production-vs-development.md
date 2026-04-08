# Logger behavior: development vs production

This note explains why server logs look different in development and production, and what the request `path` field means in HTTP access logs.

## Development

In development, the server uses a pretty console format with colors and readable timestamps. This is meant to make local debugging easier.

## Production

In production, the logger switches to structured JSON output. That format is intentionally less pretty, but it is better for:

- log collection and search
- parsing by monitoring tools
- filtering by fields like `level`, `method`, `status`, or `user_id`
- shipping logs to hosted platforms and long-term storage

So production should normally stay on the JSON format rather than the colorized development format.

## Why the `path` field can look confusing

The HTTP logger records `req.path`, which is the path Express sees for the request. That can differ from the full browser URL because:

- the API may be mounted under a prefix such as `/api/admin`
- a reverse proxy or frontend dev server may rewrite paths
- query parameters are logged separately in the `query` field

For example, a request may arrive from the browser as `/api/admin/courses/:id/hard-delete`, while logs may show only the path portion that Express handled after routing and proxy behavior.

## Practical takeaway

- Keep colorized pretty logs for development.
- Keep structured JSON logs for production.
- Treat the `path` field as the server-side route path, not always the full client URL.

If a request returns `404`, the first thing to check is whether the active build actually contains the route, not whether the database migration ran successfully.
