# Container releases

Four images are versioned independently with Google Release Please:

| Component | Release Please path | Docker Hub image |
| --- | --- | --- |
| Auth service | `auth-service/` | `DOCKERHUB_USERNAME/dss-auth-service` |
| Keycloak | `infra/keycloak/` | `DOCKERHUB_USERNAME/dss-keycloak` |
| OLAP service | `olap-service/` | `DOCKERHUB_USERNAME/dss-olap-service` |
| Apache Hop | `etl-layer/apache-hop/` | `DOCKERHUB_USERNAME/dss-apache-hop` |

Pull requests run CI without Docker Hub credentials. Merging code to `main` reruns all four verification workflows and lets Release Please open or update a release PR for each component with releasable Conventional Commits. Merging a release PR creates the component's GitHub Release and starts the corresponding image publish job. A component is published only when its release is created.

Images receive the full semantic version, the major and major.minor tags, `latest`, and an immutable short SHA tag. The release tag uses the component name, for example `apache-hop-v1.2.0`; Docker Hub uses `1.2.0`.

## Repository setup

Add these Actions secrets before merging the release workflow:

- `RELEASE_PLEASE_TOKEN`: a fine-grained GitHub token or GitHub App token with repository contents, pull requests, and issues read/write permissions. Release Please uses this token so its release PRs trigger the normal CI checks.
- `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`: credentials for pushing the four images.
- `GH_PACKAGES_TOKEN`: read access to the private Maven packages required by the OLAP build.

The initial release baseline is the commit recorded as `bootstrap-sha` in `.github/release-please-config.json`; this avoids interpreting the repository's older history as new component releases. The manifest starts each image at `0.0.0`, so the first `feat` release becomes `0.1.0` and the first `fix` release becomes `0.0.1`.

Use Conventional Commit messages with component scopes, for example `feat(apache-hop): add publication workflow` or `fix(auth-service): handle missing role`. A `BREAKING CHANGE:` footer or `!` marker requests a major version. Keep changes to a component under its configured path so Release Please can attribute them correctly.

The Keycloak provider JAR is checked into `infra/keycloak/providers/` for local image builds. When changing `keycloak-webhook/`, rebuild and commit that JAR with the source change so Release Please sees a change under `infra/keycloak/`. CI runs the provider's Maven tests, builds the image using the JAR produced by that build, and publishes that tested artifact.

For OLAP CI, the launcher JAR produced by `mvn verify` is uploaded as a short-lived workflow artifact and reused by the image publishing job. Apache Hop's PostgreSQL JDBC driver is downloaded at a fixed version and checked against its SHA-256 before image builds.

## Local Apache Hop regression

Install the repository's optional pre-push hook with `git config core.hooksPath .githooks`. Pushes that change Apache Hop or the DW integration/schema files then run the vertical workflow regression locally. To run it directly, execute `infra/dw-integration/run-local-vertical.sh` from Git Bash. The script uses disposable containers, temporary volumes, and host ports 55432/55433 by default; it prints the PostgreSQL fixture logs if a service exits early and removes the test containers and volumes afterward. Override `DW_INTEGRATION_SOURCE_PORT` or `DW_INTEGRATION_TARGET_PORT` if those ports are already in use.

## Deployment

Set `DOCKERHUB_USERNAME` and the desired image versions in the deployment `.env`. Use the version tags from the corresponding GitHub Releases, then run `docker compose pull` and `docker compose up -d --no-build`. Keep production database credentials and the Hop production environment file in the deployment secret store; do not add them to the image or `.env.example`.

The Compose deployment still supplies operational assets from the checked-out repository: DW migrations, the Keycloak database bootstrap SQL, and OLAP home initialization files. Keep the deployment checkout aligned with the image release until those assets are moved into dedicated immutable artifacts.
