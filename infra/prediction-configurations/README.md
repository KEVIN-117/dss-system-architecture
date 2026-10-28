# Prediction configuration catalog

Place operator-approved, versioned JSON training configurations here using the
opaque `configuration_ref` plus `.json` as the filename (for example, `approved-v1.json`).
Compose mounts this directory read-only into `prediction-worker` at
`/app/configurations`; the API accepts only the reference, never policy values.

For threshold selection, a configuration may contain:

```json
{
  "decision_policy": {
    "approved": false,
    "policy_ref": "dsa:<pending-approval-reference>",
    "false_negative_cost": null,
    "false_positive_cost": null
  }
}
```

This pending template is intentionally rejected by the worker. Set approval
and costs only from a DSA-approved policy; at least one cost must be greater
than zero. Configuration JSON files are ignored by Git; this
README is the only catalog content intended for version control. The worker
records the configuration reference and SHA-256 digest with the model artifact.
