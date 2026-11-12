# OLAP Workspace integration E2E

This Playwright flow exercises the real login, BFF session, Saiku discovery, metadata, query execution, and chart rendering. It does not stub the OLAP or BFF responses.

1. Start the local Keycloak, auth-service, BFF, and OLAP service stack. Confirm the BFF can reach the OLAP service and the test account is allowed to discover and query a published cube. The test starts an isolated OLAP Workspace server at port `3017` by default; it does not reuse the normal workspace on `3007`. Add `http://localhost:3017` to `BFF_ALLOWED_ORIGINS` in `apps/bff/.env` before starting the BFF so session cookies and the OAuth return URL are permitted.
2. Copy `.env.e2e.example` to `.env.e2e` and provide a non-production OLAP-enabled account. Keep `.env.e2e` out of Git.
3. Run `bun nx run @dss-monorepo/olap-workspace-e2e:e2e -- --project=chromium` from `dss-monorepo`.
4. The test signs in through the BFF login flow, discovers the first visible cube, adds an available measure and dimension, executes the query, then switches to the chart view.
5. The test also verifies OLAP browser requests target only the BFF and contain no bearer `Authorization` header. The BFF adds the verified token server-side.

Without local E2E credentials, Playwright marks this integration test skipped. Unit and proxy tests remain runnable without the integration services.
