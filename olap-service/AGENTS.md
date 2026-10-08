# AGENTS.md

Guidance for AI coding agents working in this repository. This is the source of truth for `CLAUDE.md`, Copilot and editor instructions.

## Build, test, run

JDK 22 + Maven 3.9+ build the full reactor because `saiku-proptest` uses Java 22 FFM. Shipped Java artifacts target Java 21. The reactor is `saiku-bom → saiku-core → saiku-api → saiku-launcher → saiku-proptest`.

On Windows, use `git config core.autocrlf false` before checkout; Spotless expects LF.

```bash
mvn verify
mvn spotless:apply
mvn -pl saiku-core/saiku-service -am test
mvn -pl saiku-core/saiku-service test -Dtest=RepositoryDatasourceManagerTest
mvn -pl saiku-api,saiku-launcher clean
mvn -pl saiku-launcher -am -Dmaven.test.skip=true package
mvn -P security verify
./scripts/install-hooks.sh
```

Run the API launcher (Jetty 12 EE10):

```bash
SAIKU_ALLOW_DEFAULT_ADMIN=true java -jar saiku-launcher/target/saiku-<version>.jar serve --port 8080 --home ./saiku-home
```

The HTTP surface is REST at `/rest/*` and XMLA at `/xmla/*`. The launcher embeds `saiku-api.war`; the web client is not part of this service distribution.

Never run `mvn clean` while the launcher is running: stop it first, rebuild, then restart.

Live AI API regression script: `saiku-launcher/test-ai-live.sh` (requires a running launcher).

## GitHub Packages auth (non-obvious gotcha)

Saiku depends on Spicule-published artifacts hosted on **GitHub Packages, which requires authentication for downloads even when public**. The root `pom.xml` registers five repos (`github-mondrian-saiku`, `github-olap4j`, `github-olap4j-xmlaserver`, `github-saiku-query`, `github-ossie`); each needs a matching `<server>` entry in `~/.m2/settings.xml` with a GitHub username + PAT. One PAT covers all five — mirror the five `<server>` blocks CI writes in `.github/workflows/ci.yml`. CI uses `secrets.GH_PACKAGES_TOKEN`; the auto-issued `GITHUB_TOKEN` will NOT work cross-org. Local forks of `mondrian-saiku`, `olap4j`, `olap4j-xmlaserver`, `saiku-query` installed in `~/.m2` will be preferred over the remote.

The PAT must be a **classic** token with the `read:packages` scope — [GitHub only supports classic PATs for the Maven registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-apache-maven-registry), so a fine-grained token 401s. All five source repos are public, so `read:packages` alone suffices; no `repo` scope. **A fine-grained token and a classic token missing `read:packages` produce an identical bare `401 Unauthorized` that never mentions scopes** — so diagnose before re-minting: `curl -sI -H "Authorization: token $PAT" https://api.github.com/user | grep -i x-oauth-scopes`. HTTP 200 with a scope list lacking `read:packages` means the token is valid but under-scoped; classic PAT scopes are editable in place (Settings → Developer settings → Tokens (classic) → tick `read:packages` → Update token) and the value doesn't change, so `settings.xml` needs no edit.

`lib/repo/` is an in-tree file-based Maven repo for vendored deps that aren't reachable on any public remote (currently `miredot-annotations`, Bintray-only). Use `${maven.multiModuleProjectDirectory}` (not `${project.basedir}`) when adding new entries so child modules inherit a URL pointing at the reactor root.

## Architecture

**Multi-module Maven reactor** (all artifacts `org.saikuanalytics:*`, sharing the root pom's `<version>`):

- `saiku-bom` — central dependency catalogue. Versions live here (Spring 6.2.x, Spring Security 6.5.x, slf4j 2.0.16, log4j 2.24.3, Jackson 2.18.6, Jersey 3.1.9, Arrow 18, Caffeine 3.1.8, mondrian fork 4.8.1.x). Child poms reference `${...}` and must `<import>` the BOM via `dependencyManagement`. The root pom shadows the same versions defensively so a child that forgets to import the BOM doesn't silently inherit stale numbers — keep them in sync.
- `saiku-core/saiku-olap-util` — olap4j helpers.
- `saiku-core/saiku-service` — business logic: OLAP queries (`OlapQueryService`, `ThinQueryService`), schema discovery, drill-through, async, totals, AI plan/translate (`olap/ai/`), schema generation (`schema/generate/`), datasource/session/user/cache services.
- `saiku-core/saiku-semantic` — YAML semantic layer (Phase 3 work).
- `saiku-core/saiku-web` — JAX-RS (Jersey 3.1) REST resources under `org.saiku.web.rest.resources.*` (`AiQueryResource`, `Query2Resource`, `OlapDiscoverResource`, `BasicRepositoryResource2`, `DataSourceResource`, `ExporterResource`, `AdminResource`, `InfoResource`, `SessionResource`, `StatisticsResource`, `schemagen/`). REST mount is `/saiku/api/*`. Co-located markdown (`AiQueryPlan.md`) documents agent-facing contracts alongside the code.
- `saiku-api` — packages the Servlet web app (`packaging=war`). Spring 6 wiring lives in `src/main/webapp/WEB-INF/applicationContext*.xml` + `spring-rest.xml` + `spring-servlet.xml`. Auth is Spring Security 6.5 (memory-backed for the embedded build via `applicationContext-spring-security-memory.xml`; `users.properties` seeds admin/admin).
- `saiku-launcher` — runnable distribution. Picocli CLI (`SaikuLauncher.ServeCommand`) + embedded **Jetty 12 EE10** WebApp serving the saiku-api WAR. Shade-plugin produces `saiku-<version>.jar` containing the WAR under `api/saiku-api.war`, the H2 FoodMart seed SQL, and the Mondrian schema template `seed/foodmart.sds.template`. On first run it materialises `saiku-home/` (data, repository, sessions, logs, plugins) next to the JAR. Sessions persist via Jetty `FileSessionDataStore`.


**Mondrian backend chain** (see `../docs/olap/reference/mondrian-fork.md`): Saiku uses the Spicule fork `pentaho:mondrian:4.8.1.x` which ships a Calcite-based SQL planner alongside the original SqlQuery builder. **Calcite is the default**; force legacy with `-Dmondrian.backend=legacy`. Native Calcite dialect mappings live in `mondrian.calcite.CalciteDialectMap` (H2, HSQLDB, MSSQL, MySQL/MariaDB, Oracle, PostgreSQL); unknown DBs fall through to Calcite's `SqlDialectFactoryImpl` and on failure to legacy with a one-shot WARN. Un-excluding Calcite from `saiku-api/pom.xml` pulls in `calcite-core:1.41`, `avatica-core:1.27`, `guava:33.4.8-jre` (pinned — Calcite needs a newer API than Mondrian's historical 18.0), `protobuf-java:3.25.8` (pinned — beats the 2.4.1 transitive from `serenity-bdd → operadriver`).

**AI Query API** (`/saiku/api/ai/*`, see `../docs/olap/reference/AI-QUERY-API.md`): typed REST surface so agents query cubes **without ever seeing MDX**. Three core endpoints: `GET /ai/cubes`, `GET /ai/schema/{connection/catalog/schema/cube}` (self-describing — measures, dims, sample members with unique names, JSON Schema, example bodies), `POST /ai/query` (records or matrix output, typed `{value, formatted, unit}` cells). Server validates names against the live cube and returns `VALIDATION_ERROR` 400s with `field` + `available` candidate lists for self-correction. Phase 3 enrichment overlays display-name renames from `<datasource>.generated.json` and accepts either canonical or display names in any field.

**Agent Skills** (`saiku-home/skills/*.md`, see `../docs/olap/reference/SKILLS-SPEC.md`, saiku#1426): admin-authored markdown workflows with YAML frontmatter, discoverable from `/ai/ask` and `/ai/ossie/ask`. Scanned lazily on mtime signature; parse errors surface via `GET /ai/skills?errors=true` with stable codes (`INVALID_NAME`, `DUPLICATE_NAME`, etc). Invocation: prefix an ask with `/<skill-name>` (body expanded verbatim) OR ask naturally and let the LLM route via the catalogue in its system prompt. Registry wired in `saiku-beans.xml` (`agentSkillRegistryBean`, root `${saiku.home}/skills`), consumed by `AiAskService` via `setSkills()`. Fresh installs stage `weekly-foodmart-rollup.md` from `saiku-launcher/src/main/resources/seed/skills/` on first boot.

**Agent Spaces** (`saiku-home/agent-spaces/*.json`, see `../docs/olap/reference/AGENT-SPACES-SPEC.md`, saiku#1440): named admin-authored personas that scope an ask. Each bundles a `systemPrompt`, `cubeAllowlist`, `skillAllowlist`, and `suggestedPrompts` list. `POST /ai/spaces/{id}/ask` enforces the persona server-side: cube refs outside the allowlist return 403 FORBIDDEN, the system prompt is prepended to the built-in `SYSTEM_PROMPT`, and the skill catalogue seen by the LLM is filtered to the space's allowlist. Users can't override the prompt via `history` or `question`. Registry wired in `saiku-beans.xml` (`agentSpaceRegistryBean`, root `${saiku.home}/agent-spaces`), consumed by `AiAskService` via `setSpaces()`. Fresh installs stage two personas — FoodMart Sales Analyst + FoodMart Finance Ops — from `saiku-launcher/src/main/resources/seed/agent-spaces/`.

**Ossie AI surface** (`/saiku/api/ai/ossie/*`, see `../docs/olap/reference/AI-OSSIE-API.md`): SQL-side equivalent of the MDX AI Query API. Same shape (list → schema → query, `VALIDATION_ERROR` self-correction, `POST /ask` for NL), same MCP tools alongside the MDX ones. Uses `bi.saiku.ossie:ossie-core` semantic YAML — datasets/fields/metrics with `ai_context.synonyms` for aliases and `custom_extensions` (`saiku.display`, `saiku.roles`) for enrichment. Ontology block exposed via `GET /ai/ossie/ontology/{c}/{m}` + MCP `describe_ossie_ontology`. Anomaly / forecast endpoints (typed REST at `/ai/anomaly`, `/ai/forecast`) share the AI Query MDX contract — same envelope, same validation.

**Headless snapshot renderer** (see `../docs/olap/reference/SNAPSHOT-RENDERER.md`, saiku#1810): renders a dashboard server-side to **PDF** (OpenPDF) and **PNG** (headless AWT) with **no browser attached** — the attachment for scheduled subscriptions (#943) and digest thumbnails (#1099). The unit of work is a **signed, self-origin reference** (relative repository path + panels + owner + expiry, HMAC'd under a key derived from the per-install key, same pattern as `UnsubscribeTokens`) and **never a URL**: the payload has no field that could name a fetch target, the dashboard resolves locally, and the renderer makes **no outbound request**, so there is nothing to redirect off-origin. The signed owner must equal the caller's authenticated name, and reads reuse the off-request `MeasureValueReader` seam so a snapshot carries exactly the owner's RLS rows. Renders are bounded fail-closed (panel cap, wall-clock timeout, output byte cap) on a fixed pool, so a pathological dashboard is abandoned rather than wedging a scheduler thread. Wired in `saiku-beans.xml` (`snapshotRenderService`); `DASHBOARD_DIGEST` remains the lean link-based version and does not call it yet. The Dockerfile installs `fontconfig` + `fonts-dejavu-core` — the PNG path needs a font, and the pinned `eclipse-temurin` JRE base ships none.

**Observability** (see `../docs/olap/reference/observability.md`): opt-in OpenTelemetry via the OTel Java agent (`io.opentelemetry.javaagent:opentelemetry-javaagent`), vendored into the Docker image at `/opt/saiku/otel/opentelemetry-javaagent.jar`. Activated only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set — the entrypoint (`docker/saiku-entrypoint`) and dist wrappers (`dist/run.sh`, `dist/run.bat`) conditionally append `-javaagent` based on the env var. With the var unset, the agent is never loaded (zero overhead). Auto-instruments Jetty, Jersey, JDBC (every Mondrian SQL emission), `java.net.http.HttpClient`, Log4j 2 (trace_id/span_id in MDC), JVM metrics, DBCP2 pool stats. `log4j2.xml` PatternLayout uses `%notEmpty{[trace_id=%X{trace_id} span_id=%X{span_id}] }` so trace brackets vanish cleanly when the agent isn't attached. Custom spans (Tier 2 — `ThinQueryService.execute`, AI Query metrics, cellset cache) are out of scope until Tier 1 produces data telling us which spans matter.

## Testing baseline

**`TESTING.md` is the source of truth — read it rather than trusting any count restated here.** This section is deliberately thin: it previously carried a duplicated snapshot that rotted badly (it claimed 10 tests total and "zero coverage" for `saiku-core/saiku-web`, a module that by then ran 500 green tests behind a CI floor of 330). A number copied next to its source will drift from it; get current figures by running the suite, not by reading this paragraph. For orientation only: `mvn -B -ntp -DskipITs=false verify` was ~1,480 tests green at 4.6.1, across `saiku-service`, `saiku-web`, `saiku-launcher` (plus failsafe ITs), `saiku-semantic` and `saiku-sql`.

**Test floors are a hard gate.** `.github/test-floors.json` fails CI when a module's surefire total drops below its declared floor (`saiku-core/saiku-service` and `saiku-core/saiku-web` are floored today). Bump a floor explicitly when you add tests; never delete tests to get green. Coverage floors in `.coverage-thresholds.json` are gated the same way via `scripts/check-coverage.sh` (saiku#2011).

**The quality dashboard is a report, not a gate** (saiku#2098). `.github/workflows/quality-report.yml` runs weekly + on demand, read-only, and renders those same signals as one Markdown table in the run's job summary — where each module stands and by how much headroom. `scripts/quality-report.sh` renders the Java half locally from `target/` output. Never wire the dashboard up as a gate; the gates live in `ci.yml`. See `../docs/olap/reference/quality.md`.

CI (`.github/workflows/ci.yml`) runs the Maven verification gate on ubuntu-latest with JDK 22. The `dist` job publishes the launcher distribution zip; branch protection requires the aggregate `ci` check.


## Conventions specific to this repo

- **Java format**: Palantir Java Format via Spotless. `mvn spotless:apply` before committing or the pre-commit hook will reject. The check is bound to the `verify` phase — `mvn spotless:check` standalone fails on `saiku-bom` (pom-only, no spotless binding).
- **Spring XML wiring, not JavaConfig**: the API runtime wires beans through `saiku-api/src/main/webapp/WEB-INF/applicationContext-*.xml` files. New beans go there, not via `@Configuration`.
- **JAX-RS over Spring MVC**: REST resources are Jersey 3.1 (`jakarta.ws.rs.*`), not Spring `@RestController`. The mount point is configured in `spring-rest.xml`.
- **Reactor compiler pinned to JDK 6 source in root pom** but `saiku-launcher` overrides to `<release>21</release>`. Don't "fix" the root pom — modules that need 21 set it locally. `saiku-proptest` follows the same pattern with `<configuration combine.self="override"><release>22</release>` (Hegel needs 22); the `combine.self="override"` is load-bearing — without it the inherited `source/target 1.6` collides with the bare `<release>` and the compiler plugin errors.
- **`saiku-proptest`** is a test-only module (no main sources, never published) holding Hegel property-based tests against real Saiku code (`JdbcUrlValidator`, `CryptoUtil`, …). It depends on `saiku-web`/`saiku-service` in test scope, needs JDK 22, and its surefire sets `--enable-native-access=ALL-UNNAMED` for Hegel's native engine. See `saiku-proptest/README.md`.
- **Commit message format**: `#<issue> - <description>` per `CONTRIBUTING.md`. Default branch is `development`; PRs go there, not `master`. The repo uses `jgitflow` (`mvn jgitflow:feature-start`, `release-start`, `hotfix-start`).
- **Branching strategy: Gitflow.** All new work goes on a `feature/<name>` branch off `development`. Hotfixes branch off `main` as `hotfix/<name>` and merge back to both `main` and `development`. Release prep happens on `release/<version>` branches off `development`, which then merge to `main` (tagged) and back to `development`. Never push directly to `main` or `development` — always PR. Chores and refactors that don't fit `feature/` use `chore/<name>`. Stick to Gitflow conventions; the `mvn jgitflow:*` commands enforce them automatically when used.
- **Planning docs**: `../docs/olap/reference/plans/` holds the backend/API modernisation plans (build hygiene, filesystem repository, YAML semantic layer, Arrow IPC / async cache, API and platform features). The Phase 0 dependency audit is at `../docs/olap/reference/phase-0/dependency-audit.md`. Read these before invasive changes. Historical frontend plans are retained for context and are not implementation work for this API-only repository.
- **Mondrian 4 virtual cubes**: when adding a MeasureGroup to a virtual cube, declare `<NoLink dimension="X"/>` for every dim that doesn't apply — Mondrian doesn't infer it, the cube fails to load with "No link for dimension X in measure group Y". The **canonical, git-tracked FoodMart schema is `saiku-launcher/src/main/resources/seed/FoodMart4.xml`** — edit that. The runtime copy `saiku-home/data/FoodMart4.xml` is under the gitignored `saiku-home/` and is only ever *seeded-if-absent* (`stageSeedAssets` never overwrites an existing home to preserve user edits), so an **established local home never picks up seed changes** — that's how a dev home drifted 2,000+ lines behind (saiku#1662). After editing the seed, re-materialise every local home you test against: delete `saiku-home/data/FoodMart4.xml` (or `cp` the seed over it) and relaunch. The launcher now prints a boot-time WARNING when the two diverge.

## Agent resources

- **Skills** — `.claude/skills/<name>/SKILL.md`: step-by-step workflows for recurring repo tasks (rebuilding the API launcher, cutting a release). Claude Code loads them automatically; other agents can read them as plain markdown.
- **Prompts** — `.github/prompts/*.prompt.md`: reusable task prompts (fix a bug test-first, add a REST endpoint, review a PR). Copilot exposes them as `/` commands; for other tools, paste or reference the file.
- **Review rubric** — `../docs/olap/reference/review-rubric.md`: the shared review vocabulary for this repo (correctness, tests, conventions, security, compatibility, hygiene) plus severity labels and a short agent procedure. `../docs/olap/reference/review-rubric.md` cites the conventions in this file rather than restating them, so read both when reviewing.
- **Permissions** — `.claude/settings.json`: the checked-in Claude Code project policy. The `allow` list is the read-only git/build/test surface (`mvn`, `gh … view|list|checks`) so routine verification runs without prompting; `ask` covers the actions that need a human (`git push`, the opt-in OWASP `mvn -P security verify` profile); `deny` is the hard floor — force-push, pushes straight to `main`/`development`, `mvn deploy`/`release`, `gh secret`/`gh release`, `--no-verify` (which would skip the Spotless pre-commit hook), and reads of `.env` / `secrets/**`. Extend it rather than working around it; other agents can read the same file to learn the boundary.
- **Session summary** — `.claude/session-summary.md`: the hand-off between sessions — what the last one left in flight, what it learned, and what to do first. Read it before starting work, and append an entry (format and rules are in the file) at the end of any session that touched the repo, was cut short, or is waiting on a decision. Keep it to the last ~10 entries; anything durable belongs in this file or in `.claude/memory/corrections.md` instead.
- **Corrections log** — `.claude/memory/corrections.md`: conventions a human had to correct an agent on. Read it before starting work. When a maintainer corrects you on something this file doesn't already cover, append an entry (format at the top of that file) in the same PR. If a correction is general enough, promote it into this file instead and delete the entry.
