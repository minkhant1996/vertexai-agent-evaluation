# Configure Quality Alerts

> **Preview** — Agent evaluation on Gemini Enterprise Agent Platform is subject to the
> "Pre-GA Offerings Terms", the Generative AI Service Specific Terms, and the "Agentic AI
> Services" Service Specific Terms. Pre-GA products are provided "as is" and might have limited
> support.

Quality alerts notify you when your agent's performance drops below a defined threshold. Use
them to detect **quality drift** — a decrease in agent performance over time that can occur even
when the underlying model is unchanged, often driven by changes in real-world user behavior,
evolving data patterns, or subtle interactions in complex prompt chains.

Quality alerts build on Online Monitors — see [ONLINE_MONITORS.md](./ONLINE_MONITORS.md).

## Why use quality alerts?

- **Automatic detection** — identify performance drops without manual spot-checks.
- **Proactive response** — get notified via Slack, email, or Pub/Sub.
- **Traceability** — link alerting policies directly back to the specific traces that caused the
  drift.

When you configure an Online Monitor, the system automatically exports numeric evaluation scores
to **Cloud Monitoring**. These metrics trigger incidents, and you create **alerting policies** to
notify your team when quality issues arise.

## Create a targeted alerting policy (per monitor)

1. Navigate to **Agent Platform > Agents**, then select **Evaluation** in the left nav.
2. Select the **Online monitors** tab. Click More options (⋮) for a monitor and select
   **Create alerting policy**.
3. Review the **Alerting policy templates** available for that monitor (one template per metric
   configured on the monitor).
4. Select the templates you want to enable.
5. **Configure Notifications** — select your Notification Channels. If you uncheck
   **Use notification channels**, the system performs checks but does not proactively notify
   users; you can still view triggered incidents on the **Monitoring > Alerting** page.
6. Click **Create**.

## Create recommended alerts from the dashboard

A shortcut to enable broad quality guardrails for **all** active monitors:

1. Navigate to **Agent Platform > Agents**, then **Deployments**, and select your agent.
2. Select the **Dashboard** tab and the **Evaluation** subsection.
3. Click **Recommended Alerts** (top-right).
4. Review available templates, such as:
   - **Online Monitor - Low evaluation score** — triggers if the aggregate score for a monitor
     falls too low.
   - **Individual Metric Alerts** — specific thresholds for metrics like Task Success or Tool
     Use Quality.
5. Select the templates and notification channels, then click **Create**.

## Programmatic alert creation

For large-scale deployments, configure alerts with the gcloud CLI or the Cloud Monitoring API.

### Using gcloud

```bash
gcloud monitoring policies create --policy-from-file="policy.yaml"
```

Example `policy.yaml` — triggers if the average Task Success score falls below 80% over a
30-minute window:

```yaml
displayName: "Low Task Success Score"
conditions:
- displayName: "Task Success < 0.8"
  conditionThreshold:
    filter: >
      metric.type="aiplatform.googleapis.com/online_evaluator/scores"
      AND metric.labels.evaluation_metric_name="task_success"
    comparison: COMPARISON_LT
    thresholdValue: 0.8
    duration: 1800s
    aggregations:
    - alignmentPeriod: 60s
      perSeriesAligner: ALIGN_MEAN
combiner: OR
enabled: true
notificationChannels:
- "projects/YOUR_PROJECT_ID/notificationChannels/CHANNEL_ID"
```

### Using the Cloud Monitoring SDK

```python
from google.cloud import monitoring_v3

client = monitoring_v3.AlertPolicyServiceClient()
project_name = "projects/YOUR_PROJECT_ID"

policy = {
    "display_name": "Agent Quality Drift",
    "conditions": [{
        "display_name": "Low Evaluation Score",
        "condition_threshold": {
            "filter": (
                'metric.type="aiplatform.googleapis.com/online_evaluator/scores"'
            ),
            "comparison": monitoring_v3.ComparisonType.COMPARISON_LT,
            "threshold_value": 0.7,
            "duration": {"seconds": 3600},
            "aggregations": [{
                "alignment_period": {"seconds": 60},
                "per_series_aligner": monitoring_v3.Aggregation.Aligner.ALIGN_MEAN,
            }],
        },
    }],
    "combiner": monitoring_v3.AlertPolicy.ConditionCombinerType.OR,
    "enabled": True,
}

response = client.create_alert_policy(name=project_name, alert_policy=policy)
print(f"Created alerting policy {response.name}")
```

## Manage alerting policies

Use the Cloud Monitoring console to view where your alerting policies live and refine their
configurations. Each incident includes labels for the associated Online Monitor to help you
investigate the root cause.
