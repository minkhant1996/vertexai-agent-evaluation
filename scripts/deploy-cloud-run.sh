#!/bin/bash
# Deploy to Google Cloud Run
# Usage: ./scripts/deploy-cloud-run.sh

set -e

PROJECT_ID=${GOOGLE_CLOUD_PROJECT:-"inner-suprstate-498116-a1"}
REGION="us-central1"
SERVICE_NAME="founder-validation-agent"

echo "=== Deploying to Cloud Run ==="
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Service: $SERVICE_NAME"

# Deploy
gcloud run deploy $SERVICE_NAME \
  --source . \
  --project=$PROJECT_ID \
  --region=$REGION \
  --platform=managed \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_LOCATION=$REGION" \
  --memory=1Gi \
  --cpu=1 \
  --timeout=300 \
  --quiet

# Get URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --platform=managed \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format='value(status.url)')

echo ""
echo "=== Deployment Complete ==="
echo "Service URL: $SERVICE_URL"
echo "Web UI: $SERVICE_URL/dev-ui"
echo ""
echo "$SERVICE_URL" > .deployed_url
