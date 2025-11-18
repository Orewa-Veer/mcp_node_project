# Booking Appointments with Google Calendar Integration

## How It Works

When you book an appointment through the patient interface, the system:

1. **Creates the appointment in the database** (PostgreSQL)
2. **Attempts to create a Google Calendar event** (if authenticated)
3. **Sends a confirmation email** (mock for now)
4. **Returns a success response** with calendar event details

## Booking an Appointment

### Step 1: Access the Patient Interface

Open your browser to:

```
http://localhost:3000/frontend/index.html
```

### Step 2: Check Availability

Type a natural language request:

```
Check Dr. Ahuja availability tomorrow morning
```

The AI will respond with available appointment slots.

### Step 3: Book an Appointment

Click on any available time slot to book the appointment.

**Response Examples:**

**Without Google Calendar Authentication:**

```json
{
  "ok": true,
  "success": true,
  "appointment": {
    "id": 3,
    "doctorId": 1,
    "patientName": "Jane User",
    "patientEmail": "jane@example.com",
    "startTs": "2025-11-19T09:00:00.000Z",
    "endTs": "2025-11-19T09:30:00.000Z"
  },
  "calendar": null,
  "summary": "✅ Appointment successfully scheduled!"
}
```

**With Google Calendar Authentication:**

```json
{
  "ok": true,
  "success": true,
  "appointment": { ... },
  "calendar": {
    "eventId": "abc123def456",
    "eventLink": "https://calendar.google.com/calendar/u/0/r/eventedit/abc123def456"
  },
  "summary": "✅ Appointment successfully scheduled!"
}
```

## Console Output

When an appointment is booked, you'll see:

**In Mock Mode (no Google auth):**

```
📅 [MOCK] Google Calendar Event Created:
   Summary: Appointment with Dr. Ahuja
   Start: 11/19/2025, 9:00:00 AM
   End: 11/19/2025, 9:30:00 AM
   Attendee: jane@example.com
   Patient: Jane User
   Note: To use real Google Calendar, authenticate via GET /auth/google
```

**In Real Mode (with Google auth):**

```
✅ Calendar event created: abc123def456
📧 Confirmation email sent to jane@example.com
```

## Enable Real Google Calendar Integration

### Option 1: OAuth Flow (Recommended)

1. Get the authorization URL:

   ```bash
   curl http://localhost:3000/auth/google
   ```

2. Visit the URL in your browser and authenticate with your Google account

3. Grant permission to access Google Calendar

4. You'll be redirected to the callback, and tokens will be saved

5. Future appointment bookings will create real Google Calendar events

### Option 2: Manual Token Setup (For Testing)

If you have a Google API access token, you can manually create a `tokens.json` file:

```bash
# Create tokens.json in the project root (mcp_node_project/)
cat > tokens.json << 'EOF'
{
  "type": "authorized_user",
  "client_id": "231198513276-gjfqv4mhhd0je09qjmm84juqjhang04c.apps.googleusercontent.com",
  "client_secret": "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",
  "refresh_token": "YOUR_REFRESH_TOKEN_HERE",
  "access_token": "YOUR_ACCESS_TOKEN_HERE",
  "expiry_date": 2000000000000
}
EOF
```

## API Endpoints

### Book Appointment (Direct)

```bash
curl -X POST http://localhost:3000/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "schedule",
    "input": {
      "doctorName": "Dr. Ahuja",
      "patientName": "Jane User",
      "patientEmail": "jane@example.com",
      "start": "2025-11-19T09:00:00Z",
      "end": "2025-11-19T09:30:00Z"
    }
  }'
```

### Book via Agent (Natural Language)

```bash
curl -X POST http://localhost:3000/agent/prompt \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Book an appointment with Dr. Ahuja for tomorrow at 9 AM",
    "sessionId": "user-session-1"
  }'
```

### Check Google Calendar Status

```bash
curl http://localhost:3000/auth/google/status
```

Response:

```json
{
  "ok": true,
  "authenticated": false
}
```

## Troubleshooting

### "Not authenticated with Google Calendar"

- This is expected in demo/mock mode
- All appointments are still created in the database
- Events are logged to the server console
- Complete OAuth flow to enable real Google Calendar integration

### Calendar event not created

- Check server logs for error messages
- Verify Google Calendar credentials are correct
- Ensure the Google Calendar API is enabled in your Google Cloud project

### Tokens not saving

- Ensure the `tokens.json` file can be written to the project root
- Check file permissions
- Verify the directory exists

## What Gets Saved to Google Calendar

When authenticated, each appointment creates a calendar event with:

- **Title**: "Appointment with Dr. [DoctorName]"
- **Time**: Exact appointment date and time
- **Attendees**: Patient email is added
- **Description**: Patient name and appointment notes
- **Calendar**: Saved to your "primary" calendar

## Next Steps

1. **Test the patient interface**: Book some appointments
2. **Monitor the console**: See mock calendar events being created
3. **Set up Google OAuth**: For real calendar integration
4. **Try the doctor interface**: View booked appointments

---

**Setup Status**: ✅ Booking with calendar integration is ready!
