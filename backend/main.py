from fastapi import FastAPI, HTTPException, Depends, status, WebSocket, WebSocketDisconnect, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, field_validator
from typing import List, Optional
from datetime import datetime, timedelta
import os
import re
import joblib
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import jwt
import bcrypt
import asyncio
from bson import ObjectId
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- NOTIFICATION CONFIGURATION ---
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")

# Initialize Twilio client only if credentials are present
twilio_client = None
if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
    try:
        from twilio.rest import Client
        twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        print("Twilio SMS client initialized successfully!")
    except Exception as e:
        print(f"Warning: Twilio initialization failed: {e}")

app = FastAPI(title="Telehealth Triage API (Enterprise)")

# Allow the React frontend to communicate with this backend
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- WEBSOCKET MANAGER ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                pass

manager = ConnectionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# --- MODEL, DATABASE & CALENDAR ---
MODEL_PATH = os.path.join(os.path.dirname(__file__), "ml", "triage_model.pkl")
try:
    triage_model = joblib.load(MODEL_PATH)
    print("AI Model loaded successfully!")
except Exception as e:
    triage_model = None
    print(f"Warning: Could not load AI model at {MODEL_PATH}. Error: {e}")

class CalendarManager:
    @staticmethod
    def _round_to_slot(dt: datetime) -> datetime:
        """Round a datetime to the nearest 30-minute block."""
        discard = timedelta(minutes=dt.minute % 30, seconds=dt.second, microseconds=dt.microsecond)
        dt -= discard
        if discard >= timedelta(minutes=15):
            dt += timedelta(minutes=30)
        return dt
    
    @staticmethod
    def _enforce_business_hours(dt: datetime) -> datetime:
        """Push time into 9 AM - 5 PM window."""
        if dt.hour < 9:
            dt = dt.replace(hour=9, minute=0)
        elif dt.hour >= 17:
            dt = (dt + timedelta(days=1)).replace(hour=9, minute=0)
        return dt

    @staticmethod
    async def get_next_available_slot(urgency: str) -> datetime:
        now = datetime.utcnow()
        if urgency == "Emergency":
            scheduled = now + timedelta(minutes=30)
        elif urgency == "Urgent":
            scheduled = now + timedelta(days=1, hours=2)
        else:
            scheduled = now + timedelta(days=3, hours=4)
            
        scheduled = CalendarManager._round_to_slot(scheduled)
            
        # Loop until we find a completely free slot
        while True:
            scheduled = CalendarManager._enforce_business_hours(scheduled)
            conflict = await db.appointments.find_one({"scheduled_time": scheduled})
            if conflict:
                scheduled += timedelta(minutes=30)
            else:
                break
                
        return scheduled

    @staticmethod
    async def preempt_for_emergency(background_tasks: BackgroundTasks) -> datetime:
        """
        Emergency Preemption: Find the earliest pending non-emergency appointment,
        steal its time slot for the emergency patient, and reschedule the bumped patient.
        """
        now = datetime.utcnow()
        
        # Find the earliest scheduled non-emergency pending appointment
        bumped = await db.appointments.find_one(
            {
                "ai_urgency_score": {"$in": ["Routine", "Urgent"]},
                "final_status": "Pending",
                "scheduled_time": {"$gte": now}
            },
            sort=[("scheduled_time", 1)]
        )
        
        if not bumped:
            # No non-emergency patients to preempt, just find a normal slot
            return await CalendarManager.get_next_available_slot("Emergency")
        
        # Steal the bumped patient's time slot
        stolen_time = bumped["scheduled_time"]
        
        # Find a new slot for the bumped patient (search AFTER the stolen slot)
        new_slot_for_bumped = CalendarManager._round_to_slot(stolen_time + timedelta(minutes=30))
        while True:
            new_slot_for_bumped = CalendarManager._enforce_business_hours(new_slot_for_bumped)
            conflict = await db.appointments.find_one({"scheduled_time": new_slot_for_bumped})
            if conflict:
                new_slot_for_bumped += timedelta(minutes=30)
            else:
                break
        
        # Update the bumped patient's record in MongoDB
        await db.appointments.update_one(
            {"_id": bumped["_id"]},
            {"$set": {
                "scheduled_time": new_slot_for_bumped,
                "preempted": True,
                "preempted_at": now,
                "original_time": stolen_time,
                "preempt_reason": "Rescheduled due to incoming Emergency patient"
            }}
        )
        
        # Log the preemption event for staff dashboard visibility
        await db.preemption_log.insert_one({
            "bumped_patient": bumped["patient_name"],
            "bumped_username": bumped["username"],
            "original_time": stolen_time,
            "new_time": new_slot_for_bumped,
            "reason": "Emergency patient preemption",
            "timestamp": now
        })
        
        # Send reschedule notification email to the bumped patient
        bumped_user = await db.users.find_one({"username": bumped["username"]})
        if bumped_user and bumped_user.get("email"):
            background_tasks.add_task(
                send_reschedule_email,
                bumped_user["email"],
                bumped["patient_name"],
                stolen_time,
                new_slot_for_bumped
            )
        
        # Send SMS notification to the bumped patient (if Twilio is configured)
        if bumped_user and bumped_user.get("mobile"):
            background_tasks.add_task(
                send_sms_notification,
                bumped_user["mobile"],
                bumped["patient_name"],
                stolen_time,
                new_slot_for_bumped
            )
        
        print(f"--- PREEMPTION: {bumped['patient_name']} bumped from {stolen_time} to {new_slot_for_bumped} ---")
        
        return stolen_time

MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://baruaprotik234972_db_user:vY0FHCnBb8q1Pe1c@cluster0.c0pht6s.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
client = AsyncIOMotorClient(MONGO_URI)
db = client.telehealth_db

# --- AUTHENTICATION CONFIGURATION ---
SECRET_KEY = os.getenv("SECRET_KEY", "super-secret-telehealth-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# Seed initial users on startup
@app.on_event("startup")
async def startup_event():
    # Check if admin exists
    admin = await db.users.find_one({"username": "admin"})
    if not admin:
        await db.users.insert_one({
            "username": "admin",
            "hashed_password": bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            "role": "admin"
        })
    # Check if staff exists
    staff = await db.users.find_one({"username": "doctor_bob"})
    if not staff:
        await db.users.insert_one({
            "username": "doctor_bob",
            "hashed_password": bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            "role": "staff"
        })

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if username is None or role is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"username": username})
    if user is None:
        raise credentials_exception
        
    return {"username": user["username"], "role": user["role"]}

class UserCreate(BaseModel):
    username: str
    password: str
    email: str  # Email is now required for notifications
    mobile: Optional[str] = None
    role: str = "patient"

    @field_validator('email')
    @classmethod
    def validate_email(cls, v):
        email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        if not re.match(email_regex, v):
            raise ValueError('A valid email address is required for appointment notifications')
        return v

@app.post("/register")
async def register(user: UserCreate):
    existing_user = await db.users.find_one({"username": user.username})
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Store plain bcrypt hash instead of using passlib context
    hashed_password = bcrypt.hashpw(user.password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    new_user = {
        "username": user.username,
        "hashed_password": hashed_password,
        "email": user.email,
        "mobile": user.mobile,
        "role": user.role
    }
    await db.users.insert_one(new_user)
    return {"message": "User registered successfully"}

@app.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await db.users.find_one({"username": form_data.username})
    if not user or not bcrypt.checkpw(form_data.password.encode('utf-8'), user["hashed_password"].encode('utf-8')):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user["username"], "role": user["role"]})
    return {"access_token": access_token, "token_type": "bearer", "role": user["role"]}

# --- API ENDPOINTS ---
class SymptomRequest(BaseModel):
    patient_name: str
    contact_info: str
    symptom_text: str

@app.post("/submit-symptoms")
async def submit_symptoms(request: SymptomRequest, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Only patients can submit symptoms")
        
    if triage_model is None:
        raise HTTPException(status_code=500, detail="AI Model is not loaded. Cannot process triage.")
    
    prediction = triage_model.predict([request.symptom_text])
    urgency = prediction[0]
    
    urgent_keywords = ["pain", "severe", "breathing", "blood", "chest", "unconscious", "stroke", "numbness", "heart", "choking", "bleeding", "allergic", "fever", "vomiting", "broken", "migraine"]
    extracted = [word for word in urgent_keywords if word in request.symptom_text.lower()]
    
    # EMERGENCY PREEMPTION: If emergency, steal earliest non-emergency slot
    if urgency == "Emergency":
        scheduled_time = await CalendarManager.preempt_for_emergency(background_tasks)
    else:
        scheduled_time = await CalendarManager.get_next_available_slot(urgency)
    
    appointment = {
        "username": current_user["username"],
        "patient_name": request.patient_name,
        "contact_info": request.contact_info,
        "raw_symptom_text": request.symptom_text,
        "ai_urgency_score": urgency,
        "critical_keywords": extracted,
        "submission_time": datetime.utcnow(),
        "scheduled_time": scheduled_time,
        "final_status": "Pending"
    }
    
    try:
        result = await db.appointments.insert_one(appointment)
        
        # Broadcast to all connected clients that an update occurred!
        # Send "preemption" event type so the dashboard can show a special banner
        if urgency == "Emergency":
            await manager.broadcast("emergency_preemption")
        else:
            await manager.broadcast("update")
        
        # Send emergency confirmation email to the emergency patient
        if urgency == "Emergency":
            submitting_user = await db.users.find_one({"username": current_user["username"]})
            if submitting_user and submitting_user.get("email"):
                background_tasks.add_task(
                    send_emergency_confirmation_email,
                    submitting_user["email"],
                    request.patient_name,
                    scheduled_time
                )
        
        response_data = appointment.copy()
        response_data["_id"] = str(result.inserted_id)
        
        return {
            "message": "Symptoms successfully triaged and recorded.",
            "urgency": urgency,
            "appointment_details": response_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database insertion failed: {str(e)}")

@app.get("/get-queue")
async def get_queue(current_user: dict = Depends(get_current_user)):
    try:
        # If staff/admin, show all pending. If patient, show ONLY their appointments (any status)
        if current_user["role"] in ["admin", "staff"]:
            query = {"final_status": "Pending"}
        else:
            query = {"username": current_user["username"]}
            
        cursor = db.appointments.find(query)
        appointments = await cursor.to_list(length=100)
        
        priority_map = {"Emergency": 1, "Urgent": 2, "Routine": 3}
        appointments.sort(key=lambda x: (
            priority_map.get(x.get("ai_urgency_score", "Routine"), 4),
            x.get("submission_time", datetime.max)
        ))
        
        for appt in appointments:
            appt["_id"] = str(appt["_id"])
            
        return {"queue": appointments}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch queue: {str(e)}")

class StatusUpdate(BaseModel):
    status: str
    assigned_to: Optional[str] = None
    doctor_notes: Optional[str] = None

# --- NOTIFICATION DISPATCH FUNCTIONS ---

def _send_email(to_email: str, subject: str, html_body: str):
    """Core email sender using environment-configured SMTP credentials."""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print(f"--- EMAIL SKIPPED: SMTP credentials not configured in .env ---")
        return
    if not to_email:
        print(f"--- EMAIL SKIPPED: No recipient address provided ---")
        return
    
    msg = MIMEMultipart("alternative")
    msg['Subject'] = subject
    msg['From'] = SMTP_EMAIL
    msg['To'] = to_email
    msg.attach(MIMEText(html_body, 'html'))

    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        print(f"--- EMAIL SUCCESSFULLY SENT TO {to_email} ---")
    except Exception as e:
        print(f"--- FAILED TO SEND EMAIL TO {to_email}: {e} ---")


def send_real_email(patient_email: str, patient_name: str, doctor_name: str, scheduled_time: datetime, notes: str):
    """Send appointment confirmation email when assigned to a doctor."""
    html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">✅ Appointment Confirmed</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 16px 16px;">
            <p style="font-size: 16px; color: #374151;">Dear <strong>{patient_name}</strong>,</p>
            <p style="color: #6b7280;">You have been assigned to <strong>Dr. {doctor_name}</strong>.</p>
            <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #166534; font-weight: bold;">📅 Scheduled Time</p>
                <p style="margin: 5px 0 0; color: #15803d; font-size: 18px;">{scheduled_time.strftime('%B %d, %Y at %I:%M %p')}</p>
            </div>
            <p style="color: #6b7280;"><strong>Doctor's Notes:</strong><br>{notes if notes else 'No additional notes.'}</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">TeleTriage AI Telehealth Platform</p>
        </div>
    </div>
    """
    _send_email(patient_email, '✅ Your Telehealth Appointment Confirmation', html)


def send_reschedule_email(patient_email: str, patient_name: str, old_time: datetime, new_time: datetime):
    """Send reschedule notification email to bumped patient during emergency preemption."""
    html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Schedule Change Notice</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 16px 16px;">
            <p style="font-size: 16px; color: #374151;">Dear <strong>{patient_name}</strong>,</p>
            <p style="color: #6b7280;">Your appointment has been rescheduled due to an incoming <strong style="color: #ef4444;">emergency case</strong> that requires immediate priority.</p>
            <div style="display: flex; gap: 12px; margin: 20px 0;">
                <div style="flex: 1; background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; border-radius: 8px;">
                    <p style="margin: 0; color: #991b1b; font-weight: bold; font-size: 12px;">❌ PREVIOUS TIME</p>
                    <p style="margin: 5px 0 0; color: #dc2626; font-size: 15px; text-decoration: line-through;">{old_time.strftime('%B %d, %Y')}<br>{old_time.strftime('%I:%M %p')}</p>
                </div>
                <div style="flex: 1; background: #f0fdf4; border-left: 4px solid #22c55e; padding: 16px; border-radius: 8px;">
                    <p style="margin: 0; color: #166534; font-weight: bold; font-size: 12px;">✅ NEW TIME</p>
                    <p style="margin: 5px 0 0; color: #15803d; font-size: 15px; font-weight: bold;">{new_time.strftime('%B %d, %Y')}<br>{new_time.strftime('%I:%M %p')}</p>
                </div>
            </div>
            <p style="color: #6b7280;">We sincerely apologize for any inconvenience. If this new time does not work for you, please contact the clinic coordinator.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">TeleTriage AI Telehealth Platform</p>
        </div>
    </div>
    """
    _send_email(patient_email, '⚠️ SCHEDULE CHANGE: Your Appointment Has Been Rescheduled', html)


def send_emergency_confirmation_email(patient_email: str, patient_name: str, scheduled_time: datetime):
    """Send confirmation to the emergency patient that they have been fast-tracked."""
    html = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🚨 Emergency Fast-Track Confirmation</h1>
        </div>
        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 16px 16px;">
            <p style="font-size: 16px; color: #374151;">Dear <strong>{patient_name}</strong>,</p>
            <p style="color: #6b7280;">Your symptoms have been classified as an <strong style="color: #dc2626;">EMERGENCY</strong> by our AI triage system. You have been <strong>fast-tracked</strong> to the earliest available appointment slot.</p>
            <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; color: #991b1b; font-weight: bold;">🚨 Your Emergency Appointment</p>
                <p style="margin: 5px 0 0; color: #dc2626; font-size: 20px; font-weight: bold;">{scheduled_time.strftime('%B %d, %Y at %I:%M %p')}</p>
            </div>
            <p style="color: #6b7280;">Please arrive as early as possible. A coordinator will be in touch shortly to prepare for your visit.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">TeleTriage AI Telehealth Platform</p>
        </div>
    </div>
    """
    _send_email(patient_email, '🚨 EMERGENCY: Your Fast-Track Appointment Confirmation', html)


def send_sms_notification(mobile: str, patient_name: str, old_time: datetime, new_time: datetime):
    """Send SMS notification to bumped patient via Twilio (if configured)."""
    if not twilio_client or not TWILIO_PHONE_NUMBER:
        print(f"--- SMS SKIPPED: Twilio not configured. Would have sent to {mobile} ---")
        return
    if not mobile:
        print(f"--- SMS SKIPPED: No mobile number for {patient_name} ---")
        return
    
    message_body = (
        f"TeleTriage Alert: Hi {patient_name}, your appointment on "
        f"{old_time.strftime('%b %d at %I:%M %p')} has been rescheduled to "
        f"{new_time.strftime('%b %d at %I:%M %p')} due to an emergency case. "
        f"We apologize for the inconvenience. Contact the clinic if this doesn't work for you."
    )
    
    try:
        message = twilio_client.messages.create(
            body=message_body,
            from_=TWILIO_PHONE_NUMBER,
            to=mobile
        )
        print(f"--- SMS SENT TO {mobile} (SID: {message.sid}) ---")
    except Exception as e:
        print(f"--- FAILED TO SEND SMS TO {mobile}: {e} ---")

@app.patch("/update-status/{appointment_id}")
async def update_status(appointment_id: str, status_update: StatusUpdate, background_tasks: BackgroundTasks, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Not authorized to update status")
        
    if not ObjectId.is_valid(appointment_id):
        raise HTTPException(status_code=400, detail="Invalid appointment ID format")
        
    appointment = await db.appointments.find_one({"_id": ObjectId(appointment_id)})
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    update_fields = {"final_status": status_update.status}
    if status_update.assigned_to:
        update_fields["assigned_to"] = status_update.assigned_to
    if status_update.doctor_notes:
        update_fields["doctor_notes"] = status_update.doctor_notes
    update_fields["updated_by"] = current_user["username"]
    update_fields["updated_at"] = datetime.utcnow()
    
    result = await db.appointments.update_one(
        {"_id": ObjectId(appointment_id)},
        {"$set": update_fields}
    )
    
    # Broadcast to all connected clients that an update occurred!
    await manager.broadcast("update")
    
    # Trigger Email Notification if assigned to a doctor
    if status_update.assigned_to:
        print(f"DEBUG: Assignment triggered for username: {appointment.get('username')}")
        patient_user = await db.users.find_one({"username": appointment.get("username")})
        if patient_user:
            email = patient_user.get("email")
            print(f"DEBUG: Found patient_user in DB. Email is: {email}")
            if email:
                print(f"DEBUG: Adding send_real_email to background tasks...")
                background_tasks.add_task(
                    send_real_email, 
                    email, 
                    appointment.get("patient_name", "Unknown"), 
                    status_update.assigned_to,
                    appointment.get("scheduled_time", datetime.utcnow()),
                    status_update.doctor_notes
                )
            else:
                print(f"DEBUG: Skipping email - Patient user has no email address.")
        else:
            print(f"DEBUG: Skipping email - Could not find patient_user in DB for username {appointment.get('username')}")
        
    return {"message": f"Appointment {appointment_id} updated to {status_update.status}"}

class PriorityOverride(BaseModel):
    new_priority: str

@app.patch("/override-priority/{appointment_id}")
async def override_priority(appointment_id: str, override: PriorityOverride, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if not ObjectId.is_valid(appointment_id):
        raise HTTPException(status_code=400, detail="Invalid appointment ID format")
        
    new_time = await CalendarManager.get_next_available_slot(override.new_priority)
    
    result = await db.appointments.update_one(
        {"_id": ObjectId(appointment_id)},
        {"$set": {
            "ai_urgency_score": override.new_priority,
            "scheduled_time": new_time,
            "overridden_by": current_user["username"]
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    await manager.broadcast("update")
    return {"message": "Priority updated", "new_time": new_time}

class ScheduleOverride(BaseModel):
    new_time: datetime

@app.patch("/override-schedule/{appointment_id}")
async def override_schedule(appointment_id: str, override: ScheduleOverride, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if not ObjectId.is_valid(appointment_id):
        raise HTTPException(status_code=400, detail="Invalid appointment ID format")
        
    result = await db.appointments.update_one(
        {"_id": ObjectId(appointment_id)},
        {"$set": {
            "scheduled_time": override.new_time,
            "schedule_overridden_by": current_user["username"]
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    await manager.broadcast("update")
    return {"message": "Schedule manually updated"}

@app.get("/staff-list")
async def get_staff_list(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    cursor = db.users.find({"role": {"$in": ["staff", "admin"]}}, {"username": 1, "role": 1, "_id": 0})
    staff = await cursor.to_list(length=50)
    return {"staff": staff}

@app.get("/preemption-log")
async def get_preemption_log(current_user: dict = Depends(get_current_user)):
    """Return recent preemption events for the staff dashboard banner."""
    if current_user["role"] not in ["admin", "staff"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    try:
        # Get preemption events from the last 24 hours
        cutoff = datetime.utcnow() - timedelta(hours=24)
        cursor = db.preemption_log.find(
            {"timestamp": {"$gte": cutoff}}
        ).sort("timestamp", -1).limit(20)
        events = await cursor.to_list(length=20)
        
        for event in events:
            event["_id"] = str(event["_id"])
        
        return {"events": events}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch preemption log: {str(e)}")

@app.get("/analytics")
async def get_analytics(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view analytics")
        
    try:
        pipeline = [{"$group": {"_id": "$ai_urgency_score", "count": {"$sum": 1}}}]
        cursor = db.appointments.aggregate(pipeline)
        results = await cursor.to_list(length=10)
        
        data = {"Emergency": 0, "Urgent": 0, "Routine": 0}
        for item in results:
            if item["_id"] in data:
                data[item["_id"]] = item["count"]
                
        pending_count = await db.appointments.count_documents({"final_status": "Pending"})
        resolved_count = await db.appointments.count_documents({"final_status": {"$ne": "Pending"}})
        
        return {
            "distribution": [
                {"name": "Emergency", "value": data["Emergency"]},
                {"name": "Urgent", "value": data["Urgent"]},
                {"name": "Routine", "value": data["Routine"]}
            ],
            "kpi": {
                "total_pending": pending_count,
                "total_resolved": resolved_count
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch analytics: {str(e)}")
