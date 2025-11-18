# Google Calendar Integration Setup

## Overview

The project now integrates with Google Calendar API to automatically create calendar events when appointments are scheduled.

## Configuration

Your Google Calendar credentials are already in the `.env` file:

```
GOOGLE_CLIENT_ID=231198513276-gjfqv4mhhd0je09qjmm84juqjhang04c.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/google/callback
GOOGLE_PROJECT_ID=fluted-clock-478522-a2
```

## Installation

Before running the backend, install the required `googleapis` package:

```bash
cd backend
npm install
```

This will install `googleapis` and all other dependencies.

## OAuth Flow

### 1. Get Authorization URL

Request the authorization URL from the backend:

```
GET http://localhost:4000/auth/google
```

Response:

```json
{
  "ok": true,
  "authUrl": "https://accounts.google.com/o/oauth2/auth?..."
}
```

### 2. User Authenticates

Direct users to visit the `authUrl` in a browser. They will be prompted to:

- Sign in with their Google account
- Grant permission to access Google Calendar

### 3. OAuth Callback

After authorization, Google redirects to:

```
http://localhost:4000/auth/google/callback?code=AUTH_CODE&state=STATE
```

The backend automatically exchanges the code for tokens and saves them to `tokens.json`.

### 4. Check Authentication Status

Check if the system is authenticated:

```
GET http://localhost:4000/auth/google/status
```

Response:

```json
{
  "ok": true,
  "authenticated": true
}
```

## How It Works

When a patient schedules an appointment via the agent/API:

1. **Database**: Appointment is created in PostgreSQL
2. **Google Calendar**: A calendar event is created with:
   - Title: "Appointment with Dr. [DoctorName]"
   - Time: Matches the appointment time
   - Attendees: Patient email is added
   - Description: Patient name and notes
3. **Email**: Confirmation email is sent with the calendar event link

## Module Functions

### `getAuthUrl()`

Returns the OAuth authorization URL for users to authenticate.

### `getTokensFromCode(code)`

Exchanges authorization code for access/refresh tokens. Saves tokens to `tokens.json`.

### `hasValidTokens()`

Checks if valid tokens exist (authentication is ready).

### `createCalendarEvent(eventData)`

Creates a calendar event. Parameters:

```javascript
{
  summary: "Appointment with Dr. Ahuja",
  description: "Patient notes",
  patientName: "Jane User",
  patientEmail: "jane@example.com",
  doctorName: "Dr. Ahuja",
  start: "2025-11-19T09:00:00Z",
  end: "2025-11-19T09:30:00Z"
}
```

### `listCalendarEvents(dateFrom, dateTo)`

Lists calendar events in a date range.

## Troubleshooting

**"Not authenticated with Google Calendar"**

- User needs to complete the OAuth flow first
- Ensure tokens.json has valid credentials

**"OAuth2 initialization failed"**

- Check that env variables are set correctly in .env
- Ensure GOOGLE_REDIRECT_URI matches your backend URL

**"Invalid credentials"**

- Tokens may have expired; user should re-authenticate
- Delete tokens.json and start OAuth flow again

## Next Steps

1. **For Development**: The system works in "mock mode" when not authenticated. Appointments are created in the database but calendar events are logged as would-be created.

2. **For Production**:
   - Move token storage from `tokens.json` to a secure database
   - Implement token refresh logic
   - Use environment-based secret management (AWS Secrets Manager, etc.)

## Testing

Test the integration:

```bash
# 1. Start backend
cd backend
npm run dev

# 2. Check status
curl http://localhost:4000/auth/google/status

# 3. Get auth URL and visit it
curl http://localhost:4000/auth/google

# 4. Make an appointment (after auth)
curl -X POST http://localhost:4000/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "schedule",
    "input": {
      "doctorName": "Dr. Ahuja",
      "patientName": "Jane User",
      "patientEmail": "jane@example.com",
      "start": "2025-11-20T09:00:00Z",
      "end": "2025-11-20T09:30:00Z"
    }
  }'
```

A calendar event should now appear on your Google Calendar!
