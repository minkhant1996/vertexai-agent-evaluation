#!/bin/bash

# Deploy Founder Validation Agent to Google Cloud Run
# Usage: ./scripts/deploy-cloud-run.sh
#
# Reads credentials from .env file (never hardcoded)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Founder Validation Agent - Cloud Run Deployment ===${NC}"

# Load environment variables from .env
if [ -f .env ]; then
    echo -e "${YELLOW}Loading environment from .env...${NC}"
    export $(grep -v '^#' .env | xargs)
else
    echo -e "${RED}Error: .env file not found${NC}"
    echo "Please create a .env file with the required variables:"
    echo "  - GOOGLE_CLOUD_PROJECT"
    echo "  - GOOGLE_CLOUD_LOCATION"
    echo "  - AUTH_USERNAME"
    echo "  - AUTH_PASSWORD"
    echo "  - AUTH_SECRET"
    exit 1
fi

# Verify required variables
REQUIRED_VARS="GOOGLE_CLOUD_PROJECT AUTH_USERNAME AUTH_PASSWORD AUTH_SECRET"
for var in $REQUIRED_VARS; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}Error: $var is not set in .env${NC}"
        exit 1
    fi
done

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT}"
REGION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
SERVICE_NAME="founder-validation-agent"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo -e "${YELLOW}Project: ${PROJECT_ID}${NC}"
echo -e "${YELLOW}Region: ${REGION}${NC}"
echo -e "${YELLOW}Service: ${SERVICE_NAME}${NC}"

# Step 1: Build and push Docker image
echo -e "\n${GREEN}Step 1: Building Docker image...${NC}"
gcloud builds submit --tag "${IMAGE_NAME}" --timeout=20m --quiet

# Step 2: Deploy to Cloud Run
echo -e "\n${GREEN}Step 2: Deploying to Cloud Run...${NC}"
gcloud run deploy "${SERVICE_NAME}" \
    --image "${IMAGE_NAME}" \
    --platform managed \
    --region "${REGION}" \
    --allow-unauthenticated \
    --set-env-vars="NODE_ENV=production" \
    --set-env-vars="GOOGLE_CLOUD_PROJECT=${GOOGLE_CLOUD_PROJECT}" \
    --set-env-vars="GOOGLE_CLOUD_LOCATION=${GOOGLE_CLOUD_LOCATION}" \
    --set-env-vars="GOOGLE_GENAI_USE_VERTEXAI=true" \
    --set-env-vars="AUTH_USERNAME=${AUTH_USERNAME}" \
    --set-env-vars="AUTH_PASSWORD=${AUTH_PASSWORD}" \
    --set-env-vars="AUTH_SECRET=${AUTH_SECRET}" \
    --set-env-vars="RATE_LIMIT_WINDOW_MS=${RATE_LIMIT_WINDOW_MS:-60000}" \
    --set-env-vars="RATE_LIMIT_MAX_REQUESTS=${RATE_LIMIT_MAX_REQUESTS:-100}" \
    --memory 1Gi \
    --cpu 1 \
    --timeout 300 \
    --min-instances 0 \
    --max-instances 10 \
    --quiet

# Get the service URL
SERVICE_URL=$(gcloud run services describe "${SERVICE_NAME}" --region="${REGION}" --format='value(status.url)')

echo -e "\n${GREEN}=== Deployment Complete ===${NC}"
echo -e "Service URL: ${YELLOW}${SERVICE_URL}${NC}"
echo -e "\nLogin credentials (from .env):"
echo -e "  Username: ${AUTH_USERNAME}"
echo -e "  Password: ********** (hidden)"
echo ""
