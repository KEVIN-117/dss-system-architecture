# PRED-004 comparison evidence

`PRED-004-synthetic-comparison.json` is an executed software-validation report,
not an institutional model evaluation. It was produced by fitting real
Random Forest and XGBoost classifiers with the `pred003_synthetic` fixture:

- Fixture digest: `4690ca3d8c816d1e09cc05ff7d75a7ddb7857a9cf3a909052990493714cc91b2`.
- Same global temporal holdout and partition fingerprint for both models.
- Seed `42`; 3-fold grouped validation; 10 estimators and depth 3 for each
  algorithm; one CPU.
- The candidates tied on the declared validation criteria, so the report does
  not force a winner. Test metrics are reported only after selection is frozen.
- The report decision is `EVIDENCIA_INSUFICIENTE`: perfect or tied metrics on
  synthetic observations do not demonstrate institutional utility.

The JSON contains each model/version and artifact digest, dataset and target
references, partition fingerprint, configuration, validation selection
evidence, final test metrics, and the CRISP-DM next step. It contains no student
identifiers. The institutional assessment still needs an authorized DW
snapshot and DSA-approved target, population, evaluation unit, error-cost
policy, and utility criteria.

For later job artifacts, regenerate a comparison with:

```powershell
cd prediction-service
uv run python -m evaluation.comparison --output ../docs/prediction/evidence/PRED-004-synthetic-comparison.json `
  <random-forest-artifact-dir> <xgboost-artifact-dir>
```
