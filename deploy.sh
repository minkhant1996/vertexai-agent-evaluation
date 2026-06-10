#!/bin/bash

# Deploy Founder Validation Agent to Google Cloud Run
# Usage: ./deploy.sh [project-id] [region]

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
PROJECT_ID=${1:-$GOOGLE_CLOUD_PROJECT}
REGION=${2:-"us-central1"}
SERVICE_NAME="founder-validation-agent"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}  Deploy to Cloud Run${NC}"
echo -e "${BLUE}================================${NC}"

# Check prerequisites
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}Error: Project ID required${NC}"
    echo "Usage: ./deploy.sh <project-id> [region]"
    echo "Or set GOOGLE_CLOUD_PROJECT environment variable"
    exit 1
fi

if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI not installed${NC}"
    echo "Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

echo -e "\n${YELLOW}Configuration:${NC}"
echo "  Project: $PROJECT_ID"
echo "  Region:  $REGION"
echo "  Service: $SERVICE_NAME"
echo "  Image:   $IMAGE_NAME"

# Confirm
echo -e "\n${YELLOW}Press Enter to continue or Ctrl+C to cancel...${NC}"
read

# Set project
echo -e "\n${GREEN}Setting project...${NC}"
gcloud config set project $PROJECT_ID

# Enable required APIs
echo -e "\n${GREEN}Enabling required APIs...${NC}"
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    secretmanager.googleapis.com \
    artifactregistry.googleapis.com \
    aiplatform.googleapis.com

# Create secret for Gemini API key (if not exists)
echo -e "\n${GREEN}Setting up secrets...${NC}"
if ! gcloud secrets describe gemini-api-key --project=$PROJECT_ID &> /dev/null; then
    echo "Creating secret: gemini-api-key"
    echo -e "${YELLOW}Enter your Gemini API key:${NC}"
    read -s GEMINI_KEY
    echo -n "$GEMINI_KEY" | gcloud secrets create gemini-api-key \
        --data-file=- \
        --project=$PROJECT_ID
else
    echo "Secret gemini-api-key already exists"
fi

# Build and push image
echo -e "\n${GREEN}Building container image...${NC}"
gcloud builds submit --tag $IMAGE_NAME --project=$PROJECT_ID

# Deploy to Cloud Run
echo -e "\n${GREEN}Deploying to Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
    --image $IMAGE_NAME \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars "NODE_ENV=production,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,GOOGLE_CLOUD_LOCATION=$REGION" \
    --set-secrets "GEMINI_API_KEY=gemini-api-key:latest" \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --timeout 300 \
    --concurrency 80 \
    --project=$PROJECT_ID

# Get service URL
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
    --platform managed \
    --region $REGION \
    --project=$PROJECT_ID \
    --format 'value(status.url)')

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}================================${NC}"
echo -e "\nService URL: ${BLUE}${SERVICE_URL}${NC}"
echo -e "\nTest with:"
echo "  curl ${SERVICE_URL}/health"
echo ""
echo -e "View logs:"
echo "  gcloud run logs read --service=$SERVICE_NAME --region=$REGION --project=$PROJECT_ID"
echo ""

# Save URL for frontend
echo "$SERVICE_URL" > .deployed_url
echo -e "URL saved to .deployed_url"
