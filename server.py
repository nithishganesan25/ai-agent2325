import os
import random
import logging
import datetime
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import google_auth_oauthlib.flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

class EmailRequest(BaseModel):
    to_email: str
    guardian_name: str
    patient_name: str
    med_name: str

# Professional Logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MedBro Professional API Engine", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email',
    'openid'
]
CLIENT_SECRETS_FILE = "credentials.json"

from google.auth.transport.requests import Request as AuthRequest

# --- AUTH BOILERPLATE ---
def get_google_credentials():
    if not os.path.exists('token.json'):
        raise HTTPException(status_code=401, detail="User not authenticated with Google.")
    try:
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(AuthRequest())
            with open('token.json', 'w') as f:
                f.write(creds.to_json())
        return creds
    except Exception as e:
        logger.error(f"Credentials error: {e}")
        raise HTTPException(status_code=401, detail="Google authentication expired or invalid. Please Connect Google Account again.")

# Global store for OAuth flows to preserve PKCE code_verifier
oauth_flows = {}

@app.get("/login")
def login(request: Request):
    if not os.path.exists(CLIENT_SECRETS_FILE):
        return {"error": "Missing credentials.json from Google Cloud Console."}
    flow = google_auth_oauthlib.flow.Flow.from_client_secrets_file(CLIENT_SECRETS_FILE, scopes=SCOPES)
    flow.redirect_uri = 'http://localhost:8000/auth/callback'
    url, state = flow.authorization_url(access_type='offline', include_granted_scopes='true', prompt='consent')
    
    # Save the flow instance to preserve the automatically generated PKCE code_verifier
    oauth_flows[state] = flow
    return RedirectResponse(url)

@app.get("/auth/callback")
def auth_callback(state: str, code: str, request: Request):
    try:
        flow = oauth_flows.get(state)
        if not flow:
             return {"error": "Session expired or state mismatch. Please log in again."}
             
        flow.fetch_token(code=code)
        with open('token.json', 'w') as f:
            f.write(flow.credentials.to_json())
        return RedirectResponse("http://localhost:5173") # Redirect back to React UI
    except Exception as e:
        logger.error(f"Auth error: {str(e)}")
        return {"error": "Authentication failed", "details": str(e)}


# ---------------------------------------------------------
# CALENDAR SYNC ENGINE
# ---------------------------------------------------------
@app.get("/api/calendar/events")
def get_upcoming_events(days: int = 30):
    """Fetches real events from the user's Google Calendar"""
    try:
        creds = get_google_credentials()

        user_info = {}
        try:
            oauth2_service = build('oauth2', 'v2', credentials=creds)
            user_info = oauth2_service.userinfo().get().execute()
        except Exception as e:
            logger.error(f"Userinfo fetch failed: {e}")

        service = build('calendar', 'v3', credentials=creds)
        now = datetime.datetime.utcnow().isoformat() + 'Z'
        time_max = (datetime.datetime.utcnow() + datetime.timedelta(days=days)).isoformat() + 'Z'
        
        events_result = service.events().list(
            calendarId='primary', timeMin=now, timeMax=time_max,
            maxResults=10, singleEvents=True, orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        formatted_events = []
        for e in events:
            start = e['start'].get('dateTime', e['start'].get('date'))
            formatted_events.append({
                "id": e['id'],
                "title": e.get('summary', 'Untitled Event'),
                "start": start,
                "link": e.get('htmlLink')
            })
        return {"status": "success", "events": formatted_events, "user": user_info}
    except Exception as e:
        logger.error(f"Calendar fetch failed: {e}")
        return {"status": "error", "message": "Failed to fetch calendar", "events": []}

@app.post("/api/calendar/schedule")
def schedule_event(title: str, description: str, hours_from_now: float = 1.0, duration_mins: int = 30):
    """Creates a highly detailed Google Calendar Event"""
    try:
        creds = get_google_credentials()
        service = build('calendar', 'v3', credentials=creds)
        start_time = datetime.datetime.utcnow() + datetime.timedelta(hours=hours_from_now)
        end_time = start_time + datetime.timedelta(minutes=duration_mins)

        event = {
            'summary': title,
            'description': description,
            'start': {'dateTime': start_time.isoformat() + 'Z', 'timeZone': 'UTC'},
            'end': {'dateTime': end_time.isoformat() + 'Z', 'timeZone': 'UTC'},
            'reminders': {'useDefault': False, 'overrides': [{'method': 'popup', 'minutes': 15}]},
            'colorId': '11', # Vibrant Red/Tomato
        }
        res = service.events().insert(calendarId='primary', body=event).execute()
        return {"status": "success", "link": res.get('htmlLink')}
    except Exception as e:
        logger.error(f"Event creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/mail/send-alert")
def send_guardian_alert(req: EmailRequest):
    """
    Sends an automated SOS/Skipped Med alert via Gmail SMTP.
    Requires GMAIL_ADDRESS and GMAIL_APP_PASSWORD environment variables.
    """
    sender = os.environ.get("GMAIL_ADDRESS", "demo")
    password = os.environ.get("GMAIL_APP_PASSWORD", "demo")
    
    # In a real hackathon demo, if env vars aren't set, we simulate success
    if sender == "demo":
        logger.info(f"[SIMULATED] Email sent to {req.to_email} regarding {req.med_name}.")
        return {"status": "success", "simulated": True, "message": "Email alert simulated."}
        
    try:
        msg = MIMEMultipart()
        msg['From'] = sender
        msg['To'] = req.to_email
        msg['Subject'] = f"🚨 URGENT: Health Alert for {req.patient_name}"
        
        body = f"Hello {req.guardian_name},\n\nThis is an automated alert from MedBro.\n{req.patient_name} has SKIPPED their scheduled dose of {req.med_name}.\n\nPlease check in with them immediately.\n\n- MedBro Automated AI"
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender, password)
        server.send_message(msg)
        server.quit()
        return {"status": "success", "simulated": False}
    except Exception as e:
        logger.error(f"Email failed: {e}")
        return {"status": "error", "message": str(e)}

# ---------------------------------------------------------
# AGENT 1: FITNESS & WEARABLE TRACKER
# ---------------------------------------------------------
class WearableData(BaseModel):
    steps: int
    active_minutes: int
    sleep_quality: str # 'Excellent', 'Fair', 'Poor'
    focus: str = "Hypertrophy"

@app.post("/api/agents/fitness/analyze")
def analyze_fitness(data: WearableData):
    """
    Advanced fitness analysis algorithm
    """
    plan = {"workout": f"45m Full Body Strength ({data.focus})", "intensity": "Medium", "focus": data.focus}
    insight = f"Standard operational routine targeting {data.focus} based on historical baselines."
    
    if data.steps < 4000 and data.focus != "Cardio":
        insight = "You've been highly sedentary today. We're suggesting cardiovascular mobilization instead."
        plan = {"workout": "30m Brisk Walk + 15m Mobility", "intensity": "Low", "focus": "Cardio"}
    elif data.sleep_quality == 'Poor':
        insight = "System detected poor CNS recovery (Sleep: Poor). Downgrading intensity to prevent injury."
        plan = {"workout": "20m Restorative Yoga & Stretching", "intensity": "Very Low", "focus": "Recovery"}
        
    return {"agent": "Fitness Intelligence", "suggested_plan": plan, "medical_insight": insight}


# ---------------------------------------------------------
# AGENT 2: NUTRITION & DIET
# ---------------------------------------------------------
@app.get("/api/agents/diet/plan")
def get_daily_macros(workout_intensity: str = "Medium", preference: str = "Non-Veg"):
    if workout_intensity == "High":
        meal_suggest = "Lentil Quinoa Bowl" if preference == "Veg" else "Salmon Quinoa Bowl"
        return {
            "calories": 2800,
            "macros": {"protein": "180g", "carbs": "300g", "fats": "80g"},
            "meal_suggestion": meal_suggest,
            "warning": "Ensure sodium replenishment post-workout."
        }
    
    meal_suggest = "Tofu and Roasted Vegetables" if preference == "Veg" else "Grilled Chicken and Broccoli"
    return {
        "calories": 2200,
        "macros": {"protein": "160g", "carbs": "150g", "fats": "90g"},
        "meal_suggestion": meal_suggest,
        "warning": "Monitor hydration levels."
    }

# ---------------------------------------------------------
# AGENT 3: CONVERSATIONAL ASSISTANT (Chatbot)
# ---------------------------------------------------------
class ChatMessage(BaseModel):
    message: str

@app.post("/api/chatbot/message")
def chat_with_bot(chat: ChatMessage):
    """
    Handles conversational interactions from the frontend.
    Simulates a sophisticated medical LLM response.
    """
    user_msg = chat.message.lower()
    
    # Generic intelligence responses depending on what they ask
    if any(w in user_msg for w in ["headache", "pain", "fever", "sick", "nausea"]):
        response = "I'm analyzing your symptom parameters. Ensure you're hydrated. If symptoms persist for >4 hours, I can alert your connected Health Guardian. Should I initiate a Telehealth SOS module?"
    elif "workout" in user_msg or "fitness" in user_msg or "exercise" in user_msg or "gym" in user_msg:
        response = "Based on your recent recovery score, I've prioritized your session for maximum output. Want me to push the routine to your Google Calendar automatically?"
    elif "diet" in user_msg or "food" in user_msg or "eat" in user_msg or "hungry" in user_msg:
        response = "I calculate your metabolic expenditure in real-time. Feel free to snap a picture of your plate via the Vision AI in the Diet tab, and I'll break down the exact macros."
    elif "meds" in user_msg or "pill" in user_msg or "supplement" in user_msg:
        response = "My pharmacological engine constantly monitors your doses. Note that you have pending supplements. Ensure you log them to maintain your streak!"
    elif "sync" in user_msg or "calendar" in user_msg or "schedule" in user_msg:
        response = "I integrate exclusively with Google Calendar. Once connected, your daily routines, fitness, and lifestyle actions will be autonomously scheduled."
    elif "thank" in user_msg:
        response = "You're welcome. Optimizing your physiological longevity is my highest priority."
    elif "hello" in user_msg or "hi" in user_msg or "hey" in user_msg:
         response = "Hello! I am MedBro AI, your autonomous health system. I am online and tracking your vitals. How can I assist your protocol today?"
    else:
        responses = [
            "I'm continuously processing your bio-markers. How can I optimize your protocol today?",
            "As your personal health AI, I can evaluate your symptoms, schedule your routines, or answer medical queries. Proceed?",
            "I can analyze your meals via Vision AI, sync workouts, and cross-reference your pharmacological interactions. Action requested?"
        ]
        response = random.choice(responses)

    return {"reply": response}

# Run: uvicorn server:app --reload
