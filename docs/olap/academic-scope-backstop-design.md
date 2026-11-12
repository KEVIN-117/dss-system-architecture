# Academic scope backstop in olap-service — design

Status: **proposed** · Date: 2026-11-11 · Area: olap-service, auth-service, infra/olap

## 1. Problem

Faculty/career row-level security for DECANO and DIRECTOR is enforced in exactly one place: the
BFF OLAP proxy (`dss-monorepo/apps/bff/src/app/api/olap/[...path]/route.ts`), which injects a
filter built by `_lib/academic-scope.ts`.

olap-service applies no restriction of its own:

- `infra/olap/schemas/uatf-rendimiento-academico.xml` defines no `<Role>`.
- `infra/olap/datasources/uatf-dw.sds` does not set `security.enabled`, so
  `MondrianRolePolicy.modeOf()` returns `DISABLED` and every caller gets the Mondrian root role.

Today a direct bypass is blocked only indirectly (only `dss-bff` tokens carry `aud: olap-service`,
and those stay server-side; the port is bound to 127.0.0.1 in docker-compose). Any caller that
reaches olap-service with a valid token — another internal service, a misconfigured Keycloak
client, a future deployment that exposes the port — reads every faculty's data.

**Goal:** olap-service independently restricts DECANO/DIRECTOR to their academic contexts, so the
BFF filter becomes defence in depth rather than the only control. Failure must deny, never widen.

**Non-goals:** replacing the BFF filter (it stays, and still rejects raw MDX and scope tampering);
changing who may assign contexts; per-measure/PII masking (already handled by the AI policy and
k-anonymity).

## 2. Constraints found in the code

| Fact | Source | Consequence |
|---|---|---|
| Academic contexts live only in the auth-service DB | `SetUserAcademicContextsService` → `contextRepository.replaceAllForUser` | Keycloak tokens do not carry faculty/career. olap-service must ask auth-service, or Keycloak must be synced. |
| Sync is one-way Keycloak → auth-service | `KeycloakUserEventConsumer` (RabbitMQ) | A Keycloak-group design needs a new auth-service → Keycloak Admin API write path. |
| DECANO/DIRECTOR = exactly 1 context; RECTOR/SUPERADMIN = 0 | `validateContextCount` | Role sets are small and predictable. |
| olap-service sees realm roles as `ROLE_<NAME>` | `SaikuKeycloakJwtAuthenticationConverter.extractRoles(realm_access)` | `ROLE_DECANO`, `ROLE_DIRECTOR`, `ROLE_RECTOR` are already available as Spring authorities. |
| Multiple Mondrian roles are unioned | `SaikuMondrianHelper.setRoles` → `RoleImpl.union` | A user can be granted e.g. `Faculty_3` + `Global` without new engine code. |
| Unresolved/rejected role already fails closed | `SecurityAwareConnectionManager.applySecurity`, `enforceRoleResolvedOrAdmin`, `setRole` | New resolution mode can reuse this path unchanged. |
| Connections are cached per user | `resolveConnectionKey` | Per-user role on a cached connection is already safe. |
| **Query cache key uses Spring authorities, not Mondrian roles** | `ThinQueryService.currentRolesForCacheKey()` (≈L270) | Two deans of different faculties both have `{ROLE_DECANO}` → **same cache key → cross-faculty leak**. Must be fixed as part of this work. |
| Scope members are keyed by id | BFF `OLAP_ACADEMIC_SCOPE_FILTERS`: `[Academic Faculty Scope].[Faculty Scope].[Faculty].&[{id}]`, career `…[Career].&[{id}]` | Mondrian grants use the same member unique names, so BFF and backstop stay consistent. |

## 3. Options considered

**A. Keycloak groups → client roles → `security.type=lookup`.**
auth-service writes a group/client role (`SCOPE_FAC_3`) to Keycloak whenever contexts change;
olap-service maps it with the existing `security.mapping`. No olap-service code, but: new
Admin-API credentials and write path in auth-service, two sources of truth that can drift, and a
context change only takes effect when the user's token refreshes. **Rejected.**

**B. Fully dynamic Mondrian role built in code per user** (`RoleImpl` + member grants computed at
connect time). No schema roles to maintain, but bypasses the schema-reviewable, previewable role
model (`/saiku/admin/roles/preview`) and needs Mondrian-internal API work. **Rejected.**

**C. Static, generated schema roles + an `academic` resolution mode that asks auth-service.**
Roles are plain Mondrian `<Role>` elements generated from the academic catalog; olap-service
resolves *which* role names a user gets from auth-service (single source of truth) and feeds them
into the existing `setRole` path. **Chosen.**

## 4. Design (option C)

### 4.1 Request flow

```
Bearer JWT (aud olap-service)
  └─ SaikuKeycloakJwtAuthenticationConverter → authorities {ROLE_DECANO, …}, subject = sub
       └─ SecurityAwareConnectionManager.applySecurity(con, uatf-dw)
            ├─ MondrianRolePolicy.modeOf → ACADEMIC (new)
            ├─ AcademicScopeRoleResolver.resolve(sub, authorities)   (new)
            │     ├─ ROLE_RECTOR            → ["Academic_Global"]
            │     ├─ ROLE_DECANO            → contexts from auth-service → ["Faculty_<facultyId>"]
            │     ├─ ROLE_DIRECTOR          → contexts from auth-service → ["Career_<careerId>"]
            │     └─ anything else / error  → []        (→ deny unless admin, existing code)
            ├─ setRole(con, "Faculty_3")  → Mondrian rejects unknown role → SaikuAccessDeniedException
            └─ ThinQueryService cache key includes the resolved Mondrian roles (fix, §4.5)
```

Role precedence mirrors `SetUserAcademicContextsService.ROLE_PRECEDENCE`: RECTOR composites
include DECANO and DIRECTOR, so the resolver uses the **highest** role only (RECTOR → global),
never the union of all composite roles.

### 4.2 Generated Mondrian roles (infra/olap/schemas)

A generator (`tools/olap-role-generator`, or a step in the existing seed/ETL tooling) reads the
active catalog (`dim_programa`: `id_facultad`, `id_programa`) and emits a roles block into
`uatf-rendimiento-academico.xml` (or an included fragment), e.g.:

```xml
<Role name="Faculty_3">
  <SchemaGrant access="none">
    <CubeGrant cube="Academic Performance" access="all">
      <HierarchyGrant hierarchy="[Academic Faculty Scope].[Faculty Scope]" access="custom" rollupPolicy="partial">
        <MemberGrant member="[Academic Faculty Scope].[Faculty Scope].[Faculty].&amp;[3]" access="all"/>
      </HierarchyGrant>
      <HierarchyGrant hierarchy="[Academic Program].[Program]" access="custom" rollupPolicy="partial">
        <MemberGrant member="[Academic Program].[Program].[Faculty].&amp;[3]" access="all"/>
      </HierarchyGrant>
      <HierarchyGrant hierarchy="[Academic Career Scope].[Career Scope]" access="custom" rollupPolicy="partial">
        <!-- one MemberGrant per career of faculty 3 -->
      </HierarchyGrant>
    </CubeGrant>
    <!-- same CubeGrant for Academic Admission and Academic Retention -->
  </SchemaGrant>
</Role>

<Role name="Career_ABC"> … same shape, restricted to career ABC … </Role>

<Role name="Academic_Global">
  <SchemaGrant access="all"/>
</Role>
```

Why grant all three program-based hierarchies: `Academic Program`, `Academic Faculty Scope` and
`Academic Career Scope` are separate dimensions over the same `dim_programa` rows. Restricting only
the scope dimension would still let a query put `[Academic Program]` on rows and list (and, under
`rollupPolicy="full"`, total) other faculties. `rollupPolicy="partial"` makes `All` totals sum only
granted members. `Academic Campus` needs no grant: its cells already roll up through the restricted
dimensions.

Drift handling: a new faculty/career without a regenerated schema has no role → `setRole` throws →
**deny** (safe). CI check: generator output must match the committed schema (same pattern as
`SeedSchemaDriftTest`).

### 4.3 auth-service: internal context lookup

New endpoint, not exposed through the BFF:

```
GET /internal/users/{keycloakSubject}/academic-contexts
→ 200 {"roles":["DECANO"],"contexts":[{"facultyId":3,"careerId":null}]}
→ 404 unknown user
```

- Secured by a client-credentials token: only the `olap-service` service account
  (new client role, e.g. `uatf-auth-service: CONTEXT_READER`) may call it.
- Keyed by Keycloak `sub`, so it works for live requests **and** for scheduled jobs / alerts that
  run as an owner without a live user token (`OwnerIdentityJobRunner`, `AiMeasureValueReader`).
- Returns roles from the auth-service snapshot as well, so the resolver can cross-check token
  roles against the store (mismatch → deny + audit log).

Keycloak change: the `olap-service` client becomes **confidential** with a service account (today
it is public). That also closes the open question from the bypass analysis — a public
`olap-service` client should not exist for end-user logins.

### 4.4 olap-service changes

| Component | Change |
|---|---|
| `MondrianRolePolicy` | New `Mode.ACADEMIC` for `security.type=academic`; `resolveMondrianRoles` delegates to the resolver. `/saiku/admin/roles/preview` keeps working because it calls the same method. |
| `AcademicScopeRoleResolver` (new, saiku-service) | Maps highest DSS role + contexts to role names (`Faculty_<id>`, `Career_<id>`, `Academic_Global`). Validates ids (`^[0-9]+$` faculty, `^[A-Za-z0-9]{3}$` career — same rule as the BFF). Any exception → empty list. |
| `AuthServiceContextClient` (new) | Client-credentials call to §4.3, 2 s timeout, **no** fallback to stale data on error. Cache per subject, TTL 60 s (configurable), invalidated by the existing RabbitMQ user events when practical. |
| `SecurityAwareConnectionManager.applySecurity` | Treat `ACADEMIC` like `LOOKUP`/`ONE2ONE`: resolved list → `setRole`; empty → `enforceRoleResolvedOrAdmin`. No new deny logic. |
| `infra/olap/datasources/uatf-dw.sds` | Add `security.enabled=true`, `security.type=academic`. |
| SUPERADMIN | Unchanged: `OLAP_ADMIN` → `ROLE_ADMIN` → admin keeps root role. |
| Embed / share tokens | **Open question (§6).** They carry `ROLE_EMBED_GUEST`, not a DSS role, so they would be denied once security is on. |

### 4.5 Query cache key (required fix)

`ThinQueryService.currentRolesForCacheKey()` must return the **resolved Mondrian role set** for the
connection (e.g. read back from the `ISaikuConnection` after `applySecurity`, or from the
resolver), not `UserService.getCurrentUserRoles()`. Otherwise:

1. Dean of faculty 3 runs query Q → cached under `{ROLE_DECANO}`.
2. Dean of faculty 5 runs Q → cache hit → sees faculty 3's numbers.

This bug is latent today (no Mondrian roles exist) and becomes live the moment §4.4 ships, so it
must land in the same change. Add a regression test with two DECANO users in different faculties.

## 5. Rollout

1. **auth-service:** internal endpoint + `CONTEXT_READER` role; Keycloak: make `olap-service`
   confidential with a service account. No behaviour change yet. *(Implemented: endpoint
   `/internal/users/{keycloakId}/academic-contexts`, `InternalAcademicScopeController` also
   requires `azp` ∈ `AUTH_CONTEXT_READER_CLIENTS`; realm export + `KEYCLOAK_OLAP_CLIENT_SECRET`.
   Existing realms need the manual steps in `docs/envs/keycloak.md`.)*
2. **Generator + schema roles** committed; drift test in CI. Roles exist but nothing selects them.
3. **olap-service:** resolver, `Mode.ACADEMIC`, cache-key fix, behind `security.enabled=false`.
   Use `/saiku/admin/roles/preview` to check resolutions for one user per role.
4. **Enable** on `uatf-dw.sds` in a staging stack; run the BFF e2e suites for all three dashboards
   (results must be unchanged — the BFF filter and the Mondrian grant select the same members).
5. Production enable; alert on `SaikuAccessDeniedException` rate for the first days.

Rollback: set `security.enabled=false` on the datasource (back to today's BFF-only enforcement).

## 6. Open questions

1. **Embeds/share links:** map `ROLE_EMBED_GUEST` to `Academic_Global` (today's behaviour; their
   forced JWT filters still apply), or derive a scoped role from the embed token's owner? The
   second is stricter but changes existing embeds.
2. **Context changes mid-session:** is a 60 s TTL acceptable, or must a context change take effect
   immediately (requires the RabbitMQ invalidation, not just TTL)?
3. **Generator home:** `tools/` vs the ETL `loadmanager` (which already knows when the catalog
   changes and could regenerate on load).
4. **Metadata reads:** with grants in place, `discover/.../metadata` will also hide other
   faculties' members for scoped users — confirm the dashboards don't rely on seeing them.

## 7. Tests

- Resolver unit tests: each role, multiple composite roles (RECTOR wins), bad ids, auth-service
  404/timeout/500 → empty list.
- `SecurityAwareConnectionManager`: `ACADEMIC` + resolver empty → non-admin denied, admin root.
- Mondrian integration (H2 or the DW test container): `Faculty_3` sees only faculty 3 on all three
  program hierarchies; `All` totals equal the faculty-3 sum; unknown role → denied.
- Cache: two deans, different faculties, same query → different keys, different results.
- Scheduled job as a DECANO owner resolves through the service-account path.
- Direct call to olap-service with a DECANO `dss-bff` token, no BFF filter → only own faculty.
