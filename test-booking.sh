#!/bin/bash

# Quick test script to book an appointment with calendar integration

echo "🏥 MCP Doctor Assistant - Appointment Booking Test"
echo "=================================================="
echo ""

# Configuration
BACKEND_URL="http://localhost:3000"
DOCTOR_NAME="Dr. Ahuja"
PATIENT_NAME="Jane User"
PATIENT_EMAIL="jane@example.com"

# Calculate appointment times
TOMORROW=$(date -d "+1 day" -u +"%Y-%m-%dT09:00:00Z" 2>/dev/null || date -u -v+1d +"%Y-%m-%dT09:00:00Z" 2>/dev/null || echo "2025-11-19T09:00:00Z")
TOMORROW_END=$(date -d "+1 day 09:30" -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v+1d -v+9H30M +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "2025-11-19T09:30:00Z")

echo "📝 Booking Details:"
echo "   Doctor: $DOCTOR_NAME"
echo "   Patient: $PATIENT_NAME"
echo "   Email: $PATIENT_EMAIL"
echo "   Start: $TOMORROW"
echo "   End: $TOMORROW_END"
echo ""

# Check if backend is running
echo "🔍 Checking backend status..."
HEALTH=$(curl -s "$BACKEND_URL/health")
if [[ $HEALTH == *"ok"* ]]; then
    echo "✅ Backend is running!"
else
    echo "❌ Backend is not running. Start it with: cd backend && npm run dev"
    exit 1
fi

echo ""
echo "📅 Booking appointment..."
echo ""

# Make the booking request
RESPONSE=$(curl -s -X POST "$BACKEND_URL/mcp/invoke" \
  -H "Content-Type: application/json" \
  -d "{
    \"tool\": \"schedule\",
    \"input\": {
      \"doctorName\": \"$DOCTOR_NAME\",
      \"patientName\": \"$PATIENT_NAME\",
      \"patientEmail\": \"$PATIENT_EMAIL\",
      \"start\": \"$TOMORROW\",
      \"end\": \"$TOMORROW_END\"
    }
  }")

echo "📤 Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"

echo ""
echo "✅ Appointment booking test complete!"
echo ""
echo "📚 Next steps:"
echo "   1. Check the backend console for calendar event details"
echo "   2. Open http://localhost:3000/frontend/index.html in your browser"
echo "   3. Try booking appointments through the UI"
echo "   4. To enable real Google Calendar:"
echo "      curl http://localhost:3000/auth/google"
echo ""
