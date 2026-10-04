# Apache Hop environment files

The active `dev-env.json`, `integration-env.json`, `integration-test.json`, and `prod-env.json` files are local runtime configuration and are intentionally not versioned. They can contain real endpoints, account names, or passwords.

Use the matching `*-env.example.json` as the format reference. Copy it to the corresponding local filename (`dev-env.json`, `integration-env.json`, or `prod-env.json`); use `integration-env.example.json` as the format reference for `integration-test.json`. Replace every `REPLACE_WITH_...` and `INJECT_FROM_...` marker before running Hop. The examples are deliberately nonfunctional until configured.

Never commit populated environment files or put production credentials in Git. Supply secrets from a local ignored `.env`, Docker secrets, or the environment's approved secret manager. The OLTP account must remain read-only; the DW account must be a restricted Hop runtime account, not the migration owner. Keep endpoints appropriate to the network where Hop runs (for example, Docker service DNS from a container, not `localhost` unless the database is in the same network namespace).

Before committing, verify the local files remain ignored:

```powershell
git check-ignore -v etl-layer/apache-hop/projects/dss-uatf-etl/environments/dev-env.json
git check-ignore -v etl-layer/apache-hop/projects/dss-uatf-etl/environments/integration-env.json
git check-ignore -v etl-layer/apache-hop/projects/dss-uatf-etl/environments/integration-test.json
git check-ignore -v etl-layer/apache-hop/projects/dss-uatf-etl/environments/prod-env.json
```
