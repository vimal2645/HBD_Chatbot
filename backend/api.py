from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os
import sqlite3
import re
import uuid
import json
from typing import Optional, List
from datetime import datetime
from dotenv import load_dotenv
import threading
import anyio
from db_pool import pool, db_context, get_db
import smtplib
import csv
import random
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

load_dotenv()

# Ensure static directory exists
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
os.makedirs(os.path.join(STATIC_DIR, "uploads"), exist_ok=True)

app = FastAPI(title="HBD Local Business AI", version="1.0.0")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_DB_ENV = os.getenv("DATABASE_URL") or "google_map_data.db"
# Always resolve relative to THIS file's directory so it works regardless of CWD
DATABASE_URL = _DB_ENV if os.path.isabs(_DB_ENV) else os.path.join(_BASE_DIR, os.path.basename(_DB_ENV))

print(f"[DB] DATABASE ABSOLUTE PATH: {os.path.abspath(DATABASE_URL)}")
H = os.path.join(_BASE_DIR, "g_map_master_table_sample.csv")
CSV_PATH = os.path.join(_BASE_DIR, "g_map_master_table_sample.csv")
print(f"[DB] DATABASE: {DATABASE_URL}")
print(f"[CSV] CSV: {CSV_PATH}")

# Self-healing: Ensure bookmarks table exists on startup
try:
    conn = sqlite3.connect(DATABASE_URL)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        business_id INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (business_id) REFERENCES g_map_master_table(global_business_id)
    )
    """)
    conn.commit()
    conn.close()
    print("[DB] Bookmarks table verified successfully.")
except Exception as startup_err:
    print(f"[DB] Error verifying bookmarks table: {startup_err}")



csv_lock = threading.Lock()

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*", FRONTEND_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class SearchRequest(BaseModel):
    query: str
    language: Optional[str] = "en"
    session: Optional[dict] = None
    session_id: Optional[str] = None  # Chat session ID for memory

class ChatSessionCreate(BaseModel):
    user_id: Optional[str] = None  # phone or email
    title: Optional[str] = "New Chat"

class ChatMessage(BaseModel):
    role: str
    content: str

class LoginRequest(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None

class UpdateRequest(BaseModel):
    business_id: Optional[int] = None
    field: str
    value: str

class BusinessAddRequest(BaseModel):
    phone: str
    email: Optional[str] = None
    otp: Optional[str] = None
    name: str
    category: str
    address: str
    city: str
    area: Optional[str] = None
    state: Optional[str] = None
    language: Optional[str] = "en"

class AddProductRequest(BaseModel):
    business_id: Optional[int] = None
    name: str
    price: Optional[float] = None
    description: Optional[str] = ""
    category: Optional[str] = ""
    image_url: Optional[str] = ""

class AddDealRequest(BaseModel):
    business_id: Optional[int] = None
    title: str
    discount_pct: Optional[int] = None
    expiry_date: str
    description: Optional[str] = ""

# Localization Data
BACKEND_TRANSLATIONS = {
    "en": {
        "profile_title": "📊 **HBD Business Profile**",
        "update_prompt": "👇 **What would you like to update?**",
        "update_label": "Update",
        "missing_reason": "is missing.",
        "change_reason": "Change your",
        "name": "Name", "category": "Category", "phone_number": "Phone Number", 
        "address": "Address", "area": "Area", "city": "City", "state": "State", "website": "Website"
    },
    "hi": {
        "profile_title": "📊 **HBD बिजनेस प्रोफाइल**",
        "update_prompt": "👇 **आप क्या अपडेट करना चाहेंगे?**",
        "update_label": "अपडेट करें",
        "missing_reason": "मौजूद नहीं है।",
        "change_reason": "अपना बदलें",
        "name": "नाम", "category": "श्रेणी", "phone_number": "फ़ोन नंबर", 
        "address": "पता", "area": "क्षेत्र", "city": "शहर", "state": "राज्य", "website": "वेबसाइट"
    },
    "gu": {
        "profile_title": "📊 **HBD બિઝનેસ પ્રોફાઇલ**",
        "update_prompt": "👇 **તમે શું અપડેટ કરવા માંગો છો?**",
        "update_label": "અપડેટ કરો",
        "missing_reason": "ખૂટે છે.",
        "change_reason": "તમારું બદલો",
        "name": "નામ", "category": "શ્રેણી", "phone_number": "ફોન નંબર", 
        "address": "સરનામું", "area": "વિસ્તાર", "city": "શહેર", "state": "રાજ્ય", "website": "વેબસાઇટ"
    },
    "te": {
        "profile_title": "📊 **HBD వ్యాపార ప్రొఫైల్**",
        "update_prompt": "👇 **మీరు దేనిని అప్‌డేట్ చేయాలనుకుంటున్నారు?**",
        "update_label": "అప్‌డేట్ చేయండి",
        "missing_reason": "లేదు.",
        "change_reason": "మీ అప్‌డేట్ చేయండి",
        "name": "పేరు", "category": "వర్గం", "phone_number": "ఫోన్ నంబర్", 
        "address": "చిరునామా", "area": "ప్రాంతం", "city": "నగరం", "state": "రాష్ట్రం", "website": "వెబ్‌సైట్"
    },
    "ta": {
        "profile_title": "📊 **HBD வணிக விவரம்**",
        "update_prompt": "👇 **நீங்கள் எதை மாற்ற விரும்புகிறீர்கள்?**",
        "update_label": "மாற்று",
        "missing_reason": "இல்லை.",
        "change_reason": "மாற்றவும்",
        "name": "பெயர்", "category": "வகை", "phone_number": "தொலைபேசி எண்", 
        "address": "முகவரி", "area": "பகுதி", "city": "நகரம்", "state": "மாநிலம்", "website": "இணையதளம்"
    },
    "mr": {
        "profile_title": "📊 **HBD व्यवसाय प्रोफाइल**",
        "update_prompt": "👇 **तुम्हाला काय अपडेट करायचे आहे?**",
        "update_label": "अपडेट करा",
        "missing_reason": "उपलब्ध नाही.",
        "change_reason": "तुमची माहिती बदला",
        "name": "नाव", "category": "वर्ग", "phone_number": "फोन नंबर", 
        "address": "पत्ता", "area": "क्षेत्र", "city": "शहर", "state": "राज्य", "website": "वेबसाइट"
    },
    "bn": {
        "profile_title": "📊 **HBD ব্যবসা প্রোফাইল**",
        "update_prompt": "👇 **আপনি কি আপডেট করতে চান?**",
        "update_label": "আপডেট করুন",
        "missing_reason": "নেই।",
        "change_reason": "আপনার পরিবর্তন করুন",
        "name": "নাম", "category": "বিভাগ", "phone_number": "ফোন নম্বর", 
        "address": "ঠিকানা", "area": "এলাকা", "city": "শহর", "state": "রাজ্য", "website": "ওয়েবসাইট"
    },
    "kn": {
        "profile_title": "📊 **HBD ವ್ಯಾಪಾರ ವಿವರ**",
        "update_prompt": "👇 **ನೀವು ಏನನ್ನು ನವೀಕರಿಸಲು ಬಯಸುತ್ತೀರಿ?**",
        "update_label": "ನವೀಕರಿಸಿ",
        "missing_reason": "ಇಲ್ಲ.",
        "change_reason": "ನಿಮ್ಮ ಬದಲಿಸಿ",
        "name": "ಹೆಸರು", "category": "ವರ್ಗ", "phone_number": "ಫೋನ್ ಸಂಖ್ಯೆ", 
        "address": "ವಿಳಾಸ", "area": "ಪ್ರದೇಶ", "city": "ನಗರ", "state": "ರಾష్ట్రಂ", "website": "ವೆಬ್‌ಸೈಟ್"
    }
}

# Caches for cities, categories, and areas to avoid disk I/O on every request
CITIES_CACHE = []
CATEGORIES_CACHE = []
AREAS_CACHE = []

def load_cities_and_categories_cache():
    global CITIES_CACHE, CATEGORIES_CACHE, AREAS_CACHE
    CITIES_CACHE = [
        "ahmedabad", "bengaluru", "bangalore", "chennai", "delhi", "hyderabad", "kolkata", "mumbai", "pune", "surat", 
        "jaipur", "lucknow", "kanpur", "nagpur", "indore", "thane", "bhopal", "patna", "vadodara", "ghaziabad", 
        "ludhiana", "agra", "nashik", "faridabad", "meerut", "rajkot", "kalyan", "vasai", "varanasi", "srinagar", 
        "aurangabad", "dhanbad", "amritsar", "navi mumbai", "allahabad", "ranchi", "howrah", "coimbatore", 
        "jabalpur", "gwalior", "vijayawada", "jodhpur", "madurai", "raipur", "kota", "guwahati", "chandigarh", 
        "solapur", "hubli", "bareilly", "moradabad", "mysore", "gurgaon", "aligarh", "jalandhar", "tiruchirappalli", 
        "bhubaneswar", "salem", "warangal", "mira-bhayandar", "thiruvananthapuram", "bhiwandi", "saharanpur", 
        "guntur", "amravati", "noida", "jamshedpur", "bhilai", "cuttack", "kochi", "udaipur", "bhavnagar", 
        "dehradun", "jamnagar", "ahmednagar", "ambajogai", "greater noina", "raghogarh", "shahjanpur", "taleigao"
    ]
    CATEGORIES_CACHE = [
        "gym", "fitness", "hotel", "restaurant", "cafe", "salon", "beauty", "spa", "bakery", "pharmacy", 
        "hospital", "clinic", "school", "bank", "shop", "grocery", "electronics", "automobile", "travel", 
        "clothing", "jewellery", "boutique", "doctor", "dentist", "advocate", "lawyer", "laundry", "ac service", 
        "advertising", "furniture", "hardware", "software", "it services", "scrap"
    ]
    AREAS_CACHE = [
        "maninagar", "kothrud", "kalyan nagar", "cg road", "sg highway", "viman nagar", "koregaon park", 
        "navrangpura", "satellite", "prahlad nagar", "vastrapur", "bopal", "gurukul", "ghatlodia", "naranpura"
    ]
    try:
        conn = sqlite3.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT LOWER(city) FROM g_map_master_table WHERE city IS NOT NULL AND city != ''")
        db_cities = [r[0] for r in cur.fetchall()]
        for dc in db_cities:
            if dc not in CITIES_CACHE:
                CITIES_CACHE.append(dc)
        cur.execute("SELECT DISTINCT LOWER(business_category) FROM g_map_master_table WHERE business_category IS NOT NULL AND business_category != ''")
        db_cats = [r[0] for r in cur.fetchall()]
        for dc in db_cats:
            if dc not in CATEGORIES_CACHE:
                CATEGORIES_CACHE.append(dc)
        cur.execute("SELECT DISTINCT LOWER(area) FROM g_map_master_table WHERE area IS NOT NULL AND area != ''")
        db_areas = [r[0] for r in cur.fetchall()]
        for da in db_areas:
            if da not in AREAS_CACHE:
                AREAS_CACHE.append(da)
        conn.close()
        print(f"[CACHE] Loaded {len(CITIES_CACHE)} cities, {len(CATEGORIES_CACHE)} categories, and {len(AREAS_CACHE)} areas.")
    except Exception as e:
        print(f"[CACHE] Error loading cache: {e}")

# Initialize caches immediately on startup
load_cities_and_categories_cache()

def lang_fetch(key, lang="en"):
    # Pre-populated translations for search results
    extra_translations = {
        "en": {"found_results": "🔍 Found results in our local database:", "found_online": "🌐 Found results online:"},
        "hi": {"found_results": "🔍 हमारे डेटाबेस में परिणाम मिले:", "found_online": "🌐 ऑनलाइन परिणाम मिले:"},
        "gu": {"found_results": "🔍 અમારા સ્થાનિક ડેટાબેઝમાં પરિણામો મળ્યા:", "found_online": "🌐 ઓનલાઇન પરિણામો મળ્યા:"},
        "te": {"found_results": "🔍 మా స్థానిక డేటాబేస్లో ఫలితాలు కనుగొనబడ్డాయి:", "found_online": "🌐 ఆన్‌లైన్‌లో ఫలితాలు కనుగొనబడ్డాయి:"},
        "ta": {"found_results": "🔍 எங்களது உள்ளூர் தரவுத்தளத்தில் முடிவுகள் கண்டறியப்பட்டன:", "found_online": "🌐 இணையத்தில் முடிவுகள் கண்டறியப்பட்டன:"},
        "mr": {"found_results": "🔍 आमच्या स्थानिक डेटाबेसमध्ये परिणाम आढळले:", "found_online": "🌐 ऑनलाइन परिणाम आढळले:"},
        "bn": {"found_results": "🔍 আমাদের স্থানীয় ডাটাবেসে ফলাফল পাওয়া গেছে:", "found_online": "🌐 অনলাইনে ফলাফল পাওয়া গেছে:"},
        "kn": {"found_results": "🔍 ನಮ್ಮ ಸ್ಥಳೀಯ ಡೇಟಾಬೇಸ್‌ನಲ್ಲಿ ಫಲಿತಾಂಶಗಳು ಕಂಡುಬಂದಿವೆ:", "found_online": "🌐 ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ ಫಲಿತಾಂಶಗಳು ಕಂಡುಬಂದಿವೆ:"}
    }
    
    # Priority: 1. Extra Cache, 2. Main Cache, 3. Dynamic Translation, 4. English Fallback
    lang_data = extra_translations.get(lang, {})
    if key in lang_data:
        return lang_data[key]
        
    data = BACKEND_TRANSLATIONS.get(lang)
    if data and key in data:
        return data[key]
    
    eng_val = BACKEND_TRANSLATIONS["en"].get(key, key)
    # Check if key is in extra English translations
    if not eng_val or eng_val == key:
        eng_val = extra_translations.get("en", {}).get(key, key)
        
    if not lang or lang == "en": return eng_val
    
    # DYNAMIC TRANSLATION (Auto-Correction/Translation for 'all' languages)
    try:
        from llm_client import call_llm
        from models import MODEL

        prompt = f"Translate the following button label or UI text to language code '{lang}'. Return ONLY the translation. Text: '{eng_val}'"
        res = call_llm([{"role": "user", "content": prompt}], model=MODEL)
        translation = res.get("content", "").strip().replace("'", "").replace("\"", "")
        if translation and len(translation) < 100:
            if lang not in BACKEND_TRANSLATIONS: BACKEND_TRANSLATIONS[lang] = {}
            BACKEND_TRANSLATIONS[lang][key] = translation
            return translation
    except Exception as e:
        print(f"Translation Error for {lang}: {e}")
    
    return eng_val

# Table name constant
BIZ_TABLE = "g_map_master_table"

# Helper: Map DB to Frontend
def map_business_fields(biz_list):
    mapped_list = []
    for biz in biz_list:
        # Support both old google_maps_listings field names and new g_map_master_table names
        mapped = {
            "global_business_id": biz.get("global_business_id") or biz.get("id"),
            "business_name": biz.get("business_name") or biz.get("name"),
            "business_category": biz.get("business_category") or biz.get("category"),
            "business_subcategory": biz.get("subcategory"),
            "website_url": biz.get("website_url") or biz.get("website"),
            "area": biz.get("area"),
            "city": biz.get("city"),
            "state": biz.get("state"),
            "ratings": biz.get("ratings") or biz.get("reviews_avg") or biz.get("reviews_average") or 0,
            "reviews_count": biz.get("reviews_count", 0),
            "phone_number": biz.get("phone_number"),
            "address": biz.get("address"),
            "email": biz.get("email"),
            "owner_id": biz.get("owner_id")
        }
        # Preserve dynamic fields like products, deals, bookmarks
        for key in ["products", "deals", "bookmarked", "is_bookmarked"]:
            if key in biz:
                mapped[key] = biz[key]
        mapped_list.append(mapped)
    return mapped_list

# Rate Limiting & Prompt Injection Guards
import time
from fastapi import Request, Header, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse

reusable_oauth2 = HTTPBearer(auto_error=False)

def get_authenticated_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(reusable_oauth2)) -> dict:
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated"
        )
    token = credentials.credentials
    from auth_utils import decode_jwt_token, JWTExpiredError, JWTInvalidError
    try:
        payload = decode_jwt_token(token)
        if not payload:
            raise HTTPException(
                status_code=401,
                detail="Invalid token"
            )
        return payload
    except JWTExpiredError as e:
        raise HTTPException(
            status_code=401,
            detail="Token has expired"
        )
    except JWTInvalidError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid token: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials"
        )

rate_limit_records = {}

def check_rate_limit(ip_address: str):
    now = time.time()
    timestamps = [t for t in rate_limit_records.get(ip_address, []) if now - t < 60]
    if len(timestamps) >= 100:
        raise HTTPException(status_code=429, detail="Too many requests. Rate limit exceeded.")
    timestamps.append(now)
    rate_limit_records[ip_address] = timestamps

@app.middleware("http")
async def rate_limiting_and_security_middleware(request: Request, call_next):
    ip = request.client.host
    try:
        check_rate_limit(ip)
    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"detail": e.detail})
    return await call_next(request)

def check_prompt_injection(query: str) -> bool:
    q = query.lower()
    injection_keywords = [
        "ignore previous instructions",
        "system prompt",
        "ignore rules",
        "bypass",
        "reveal system prompt",
        "expose system instruction"
    ]
    for kw in injection_keywords:
        if kw in q:
            return True
    return False

# Audit Logging & User Helpers
def log_audit_action(user_id: Optional[int], action: str, entity: str, entity_id: Optional[int], ip_address: Optional[str] = None):
    try:
        conn = sqlite3.connect(DATABASE_URL)
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO audit_logs (user_id, action, entity, entity_id, ip_address)
            VALUES (?, ?, ?, ?, ?)
        """, (user_id, action, entity, entity_id, ip_address))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[AUDIT LOG] Error: {e}")

def get_current_user_id(authorization: Optional[str] = Header(None), session: Optional[dict] = None) -> Optional[int]:
    # Self-healing check: if called programmatically, authorization might be a Header object
    auth_str = authorization if isinstance(authorization, str) else None
    if auth_str and auth_str.startswith("Bearer "):
        token = auth_str.split(" ")[1]
        from auth_utils import decode_jwt_token
        payload = decode_jwt_token(token)
        if payload:
            return payload.get("id")
    if session:
        phone = session.get("phone")
        email = session.get("email")
        if phone or email:
            conn = sqlite3.connect(DATABASE_URL)
            cur = conn.cursor()
            if phone:
                cur.execute("SELECT id FROM users WHERE phone = ?", (phone,))
            else:
                cur.execute("SELECT id FROM users WHERE email = ?", (email,))
            row = cur.fetchone()
            conn.close()
            if row:
                return row[0]
    return None

# Auth Request Models
class RegisterRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str
    role: Optional[str] = "owner"

class TokenLoginRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    password: str

# OTP Storage (Mock)
otp_storage = {}

# Authentication Endpoints
@app.post("/api/auth/register")
def auth_register(req: RegisterRequest):
    from auth_utils import hash_password, generate_jwt_token
    clean_email = req.email.strip().lower() if req.email else None
    clean_phone = req.phone.strip() if req.phone else None
    if not clean_email and not clean_phone:
        raise HTTPException(400, "Either email or phone is required")
    pwd_hash = hash_password(req.password)
    conn = sqlite3.connect(DATABASE_URL)
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO users (email, phone, password_hash, role) 
            VALUES (?, ?, ?, ?)
        """, (clean_email, clean_phone, pwd_hash, req.role or 'owner'))
        user_id = cur.lastrowid
        conn.commit()
        log_audit_action(user_id, "REGISTER", "users", user_id, "system")
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(400, "User with this email or phone already exists")
    conn.close()
    token = generate_jwt_token({"id": user_id, "email": clean_email, "phone": clean_phone, "role": req.role or 'owner'})
    return {"success": True, "token": token, "user": {"id": user_id, "email": clean_email, "phone": clean_phone, "role": req.role or 'owner'}}

@app.post("/api/auth/login")
def auth_login(req: TokenLoginRequest):
    from auth_utils import verify_password, generate_jwt_token
    clean_email = req.email.strip().lower() if req.email else None
    clean_phone = req.phone.strip() if req.phone else None
    if not clean_email and not clean_phone:
        raise HTTPException(400, "Either email or phone is required")
    conn = sqlite3.connect(DATABASE_URL)
    cur = conn.cursor()
    if clean_email:
        cur.execute("SELECT id, email, phone, password_hash, role FROM users WHERE email = ?", (clean_email,))
    else:
        cur.execute("SELECT id, email, phone, password_hash, role FROM users WHERE phone = ?", (clean_phone,))
    row = cur.fetchone()
    conn.close()
    if not row or not verify_password(req.password, row[3]):
        raise HTTPException(400, "Invalid credentials")
    user_id, u_email, u_phone, _, role = row
    token = generate_jwt_token({"id": user_id, "email": u_email, "phone": u_phone, "role": role})
    log_audit_action(user_id, "LOGIN", "users", user_id, "system")
    return {"success": True, "token": token, "user": {"id": user_id, "email": u_email, "phone": u_phone, "role": role}}

@app.post("/api/auth/forgot-password")
def auth_forgot_password(req: dict):
    email = req.get("email")
    phone = req.get("phone")
    import random
    import bcrypt
    otp = str(random.randint(1000, 9999))
    identifier = email or phone
    if not identifier: raise HTTPException(400, "Identifier is required")
    hashed_otp = bcrypt.hashpw(otp.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    otp_storage[identifier] = hashed_otp
    print(f"DEBUG [FORGOT PASSWORD]: Generated OTP {otp} for {identifier}")
    return {"success": True, "message": f"Verification code sent (Dev: {otp})"}

@app.post("/api/auth/verify-otp")
def auth_verify_otp(req: dict):
    identifier = req.get("email") or req.get("phone")
    otp = req.get("otp")
    if not identifier or not otp: raise HTTPException(400, "Missing identifier or OTP")
    
    enable_bypass = os.getenv("ENABLE_DEV_OTP_BYPASS", "false").lower() == "true"
    is_bypass = False
    if enable_bypass:
        is_bypass = (str(otp) == "1234")
        
    stored_hash = otp_storage.get(identifier)
    import bcrypt
    is_valid = False
    if stored_hash:
        try:
            is_valid = bcrypt.checkpw(str(otp).encode('utf-8'), stored_hash.encode('utf-8'))
        except Exception:
            pass
            
    if is_valid or is_bypass:
        return {"success": True, "message": "Verification complete"}
    raise HTTPException(400, "Invalid OTP code")

@app.post("/api/send-otp-phone")
def send_otp_phone(req: LoginRequest):
    import random
    import bcrypt
    otp = str(random.randint(1000, 9999))
    print(f"DEBUG: Sent OTP {otp} to {req.phone}")
    hashed_otp = bcrypt.hashpw(otp.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    otp_storage[req.phone] = hashed_otp
    return {"success": True, "message": "OTP sent"}

@app.post("/api/verify-otp-phone")
def verify_otp_phone(req: dict):
    phone = req.get("phone")
    otp = req.get("otp")
    if not phone or not otp: raise HTTPException(400, "Missing phone/otp")
    
    enable_bypass = os.getenv("ENABLE_DEV_OTP_BYPASS", "false").lower() == "true"
    is_bypass = False
    if enable_bypass:
        is_bypass = (str(otp) == "1234")
        
    stored_hash = otp_storage.get(phone)
    import bcrypt
    is_valid = False
    if stored_hash:
        try:
            is_valid = bcrypt.checkpw(str(otp).encode('utf-8'), stored_hash.encode('utf-8'))
        except Exception:
            pass

    if is_valid or is_bypass:
        from business_by_phone import get_businesses_by_phone
        from auth_utils import generate_jwt_token
        try:
            raw = get_businesses_by_phone(phone)
            # Ensure user exists in users table
            conn = sqlite3.connect(DATABASE_URL)
            cur = conn.cursor()
            cur.execute("SELECT id, role FROM users WHERE phone = ?", (phone,))
            row = cur.fetchone()
            if not row:
                from auth_utils import hash_password
                default_hash = hash_password("password123")
                cur.execute("INSERT INTO users (phone, password_hash, role) VALUES (?, ?, 'owner')", (phone, default_hash))
                user_id = cur.lastrowid
                role = "owner"
                conn.commit()
            else:
                user_id, role = row
            conn.close()
            
            token = generate_jwt_token({"id": user_id, "email": None, "phone": phone, "role": role})
            log_audit_action(user_id, "LOGIN_OTP_PHONE", "users", user_id, "system")
            
            return {
                "success": True, 
                "status": "logged_in", 
                "phone": phone, 
                "token": token,
                "businesses": map_business_fields(raw)
            }
        except ValueError as e:
            if "not registered" in str(e):
                return {"success": True, "status": "registered", "phone": phone, "businesses": []}
            return {"success": False, "message": str(e)}
        except Exception as e:
            print(f"OTP Verification Error: {e}")
            return {"success": False, "message": "An error occurred during verification."}
    return {"success": False, "message": "Invalid OTP"}

# Helper: Real SMTP Sender
def send_smtp_otp(receiver_email, otp_code, type="login"):
    sender_email = os.getenv("SMTP_EMAIL")
    password = os.getenv("SMTP_PASSWORD")
    if not sender_email or not password:
        raise Exception("SMTP credentials missing in .env")
        
    msg = MIMEMultipart()
    msg['From'] = f"HBD Support <{sender_email}>"
    msg['To'] = receiver_email
    msg['Subject'] = f"Verification Code: {otp_code}"
    
    if type == "registration":
        body = f"Welcome to CityHangAround!\n\nYour registration verification code is: {otp_code}\n\nUse this code to finalize your new business registration."
    else:
        body = f"Hello,\n\nYour login verification code is: {otp_code}\n\nIf you did not request this, please ignore this email."
        
    msg.attach(MIMEText(body, 'plain'))
    
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(sender_email, password)
        server.send_message(msg)

@app.post("/api/send-otp")
def send_otp_email(req: dict):
    email = req.get("email")
    type = req.get("type", "login")
    if not email: return {"success": False, "message": "Missing email"}
    
    import random
    import bcrypt
    otp = str(random.randint(1000, 9999))
    hashed_otp = bcrypt.hashpw(otp.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    otp_storage[email] = hashed_otp
    print(f"DEBUG: Real OTP {otp} generated for {email} (Type: {type})")

    try:
        send_smtp_otp(email, otp, type)
        return {"success": True, "message": "OTP sent to your email!"}
    except Exception as e:
        print(f"SMTP Error: {e}")
        return {"success": False, "message": f"Failed to send email. Ensure App Password is correct. (Dev Hint: 1234)"}

@app.post("/api/verify-otp")
def verify_otp_email(req: dict):
    email = req.get("email")
    otp = req.get("otp")
    if not email or not otp: raise HTTPException(400, "Missing email/otp")
    
    enable_bypass = os.getenv("ENABLE_DEV_OTP_BYPASS", "false").lower() == "true"
    is_bypass = False
    if enable_bypass:
        is_bypass = (str(otp) == "1234")
        
    stored_hash = otp_storage.get(email)
    import bcrypt
    is_valid = False
    if stored_hash:
        try:
            is_valid = bcrypt.checkpw(str(otp).encode('utf-8'), stored_hash.encode('utf-8'))
        except Exception:
            pass

    if is_valid or is_bypass:
        from business_by_phone import get_businesses_by_email
        from auth_utils import generate_jwt_token
        try:
            raw = get_businesses_by_email(email)
            # Ensure user exists in users table
            conn = sqlite3.connect(DATABASE_URL)
            cur = conn.cursor()
            cur.execute("SELECT id, role FROM users WHERE email = ?", (email,))
            row = cur.fetchone()
            if not row:
                from auth_utils import hash_password
                default_hash = hash_password("password123")
                cur.execute("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'owner')", (email, default_hash))
                user_id = cur.lastrowid
                role = "owner"
                conn.commit()
            else:
                user_id, role = row
            conn.close()
            
            token = generate_jwt_token({"id": user_id, "email": email, "phone": None, "role": role})
            log_audit_action(user_id, "LOGIN_OTP_EMAIL", "users", user_id, "system")
            
            return {
                "success": True, 
                "status": "logged_in", 
                "email": email, 
                "token": token,
                "businesses": map_business_fields(raw)
            }
        except ValueError as e:
            if "not registered" in str(e):
                return {"success": True, "status": "registered", "email": email, "businesses": []}
            return {"success": False, "message": str(e)}
        except Exception as e:
            print(f"Email OTP Verification Error: {e}")
            return {"success": False, "message": "An error occurred during verification."}
    return {"success": False, "message": "Invalid OTP"}

@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...)):
    try:
        import uuid
        ext = file.filename.split(".")[-1]
        filename = f"{uuid.uuid4()}.{ext}"
        static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "uploads")
        if not os.path.exists(static_dir):
            os.makedirs(static_dir)
        
        filepath = os.path.join(static_dir, filename)
        
        with open(filepath, "wb") as f:
            f.write(await file.read())
            
        # Re-resolve the static URL relative to host via proxy
        return {"success": True, "url": f"/static/uploads/{filename}"}
    except Exception as e:
        print(f"Upload Error: {e}")
        raise HTTPException(400, str(e))

@app.post("/api/login")
def login_legacy(req: LoginRequest):
    """Restore login for frontend compatibility while keeping security in Query"""
    from business_by_phone import get_businesses_by_phone, get_businesses_by_email
    from auth_utils import generate_jwt_token
    try:
        if req.phone:
            raw = get_businesses_by_phone(req.phone)
            identifier = req.phone
        elif req.email:
            raw = get_businesses_by_email(req.email)
            identifier = req.email
        else:
            raise HTTPException(400, "Missing identifier")
            
        # Get or create user in users table
        conn = sqlite3.connect(DATABASE_URL)
        cur = conn.cursor()
        if req.phone:
            cur.execute("SELECT id, role FROM users WHERE phone = ?", (identifier,))
        else:
            cur.execute("SELECT id, role FROM users WHERE email = ?", (identifier,))
        row = cur.fetchone()
        
        if not row:
            from auth_utils import hash_password
            default_hash = hash_password("password123")
            if req.phone:
                cur.execute("INSERT INTO users (phone, password_hash, role) VALUES (?, ?, 'owner')", (identifier, default_hash))
            else:
                cur.execute("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'owner')", (identifier, default_hash))
            user_id = cur.lastrowid
            role = "owner"
            conn.commit()
        else:
            user_id, role = row
        conn.close()
        
        token = generate_jwt_token({"id": user_id, "email": identifier if req.email else None, "phone": identifier if req.phone else None, "role": role})
        log_audit_action(user_id, "LOGIN_LEGACY", "users", user_id, "system")
        
        return {
            "success": True, 
            "status": "logged_in", 
            "identifier": identifier, 
            "token": token,
            "businesses": map_business_fields(raw)
        }
    except Exception as e:
        return {"success": True, "status": "registered", "phone": req.phone, "email": req.email, "businesses": []}

# --- HELPER FUNCTIONS FOR FAST BUSINESS SEARCH & PAGINATION ---
def extract_search_params(query_str: str):
    import re
    q = query_str.lower().strip()
    
    # Preprocess common typos and synonyms for rapid, low-latency matching
    typo_map = {
        "attm": "atm",
        "atms": "atm",
        "banks": "bank",
        "resturant": "restaurant",
        "resturat": "restaurant",
        "resyurantr": "restaurant",
        "resturats": "restaurant",
        "restaurant": "restaurant",
        "restaurants": "restaurant",
        "hospitall": "hospital",
        "hospitals": "hospital",
        "gyms": "gym",
        "stores": "shop",
        "shops": "shop",
        "cafes": "cafe",
        "mainanagr": "maninagar"
    }
    words = q.split()
    corrected = []
    for w in words:
        clean_w = w.strip(".,?!;()\"'")
        if clean_w in typo_map:
            corrected.append(typo_map[clean_w])
        else:
            corrected.append(w)
    q = " ".join(corrected)

    # Use pre-populated memory caches instead of querying SQLite on every search request
    global CITIES_CACHE, CATEGORIES_CACHE, AREAS_CACHE
    
    found_city = None
    for city in sorted(CITIES_CACHE, key=len, reverse=True):
        if city in q:
            found_city = city
            break
            
    found_cats = []
    # Find all matching categories in the query string
    for cat in sorted(CATEGORIES_CACHE, key=len, reverse=True):
        pattern = r"\b" + re.escape(cat) + r"\b"
        if cat.endswith('s'):
            pattern_plural = r"\b" + re.escape(cat.rstrip('s')) + r"\b"
        else:
            pattern_plural = r"\b" + re.escape(cat) + r"s\b"
            
        if re.search(pattern, q) or re.search(pattern_plural, q) or cat in q:
            if cat not in found_cats:
                found_cats.append(cat)
                
    # If we found multiple categories (e.g. 'atm and bank'), return them joined by ' and '
    if found_cats:
        found_cats.sort(key=lambda x: q.find(x))
        found_category = " and ".join(found_cats[:3])
    else:
        found_category = None
        
    found_area = None
    for area in sorted(AREAS_CACHE, key=len, reverse=True):
        pattern = r"\b" + re.escape(area) + r"\b"
        if re.search(pattern, q) or (area.replace(" ", "") in q.replace(" ", "")):
            found_area = area
            break
            
    return found_category, found_city, found_area


def is_conversational_question(query_str: str) -> bool:
    """Helper to detect if a query is a general conversational question about a category rather than a business search."""
    q = query_str.lower().strip()
    question_starters = [
        "what is", "what are", "how to", "how do", "why do", "why is", "who is", "who are",
        "explain", "tell me about", "tell me what", "can you explain", "what does"
    ]
    if any(q.startswith(starter) for starter in question_starters):
        # If it also explicitly contains search keywords like 'in [city]' or 'near', treat as search
        if " in " in q or "near" in q or "where is" in q:
            return False
        return True
    return False


def _get_last_search_metadata(session_id: str):
    """Retrieves the search_metadata dictionary from the last assistant database response in this session."""
    if not session_id:
        return None
    try:
        conn = sqlite3.connect(DATABASE_URL)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        # Look back up to 10 assistant messages to find the last database search response containing metadata
        cur.execute(
            "SELECT content FROM chat_messages WHERE session_id = ? AND role = 'assistant' ORDER BY id DESC LIMIT 10",
            (session_id,)
        )
        rows = cur.fetchall()
        conn.close()
        for r in rows:
            content = r["content"]
            try:
                data = json.loads(content)
                if isinstance(data, dict) and data.get("type") == "database" and "search_metadata" in data:
                    return data["search_metadata"]
            except Exception:
                continue
    except Exception as e:
        print(f"[Metadata Fetch Error] {e}")
    return None


def query_local_businesses(category: str, city: str, offset: int = 0, limit: int = 10, area: str = None, min_rating: float = None):
    with db_context() as conn:
        cur = conn.cursor()
        
        # Support multiple categories joined by ' and '
        categories = [c.strip() for c in category.split(" and ")]
        
        cat_conditions = []
        params = []
        for cat in categories:
            cat_conditions.append("(LOWER(business_category) LIKE ? OR LOWER(subcategory) LIKE ? OR LOWER(business_name) LIKE ?)")
            params.extend([f"%{cat}%", f"%{cat}%", f"%{cat}%"])
            
        cat_clause = "(" + " OR ".join(cat_conditions) + ")"
        
        conditions = [cat_clause, "LOWER(city) LIKE ?"]
        params.append(f"%{city}%")
        
        if area:
            conditions.append("REPLACE(LOWER(area), ' ', '') LIKE ?")
            params.append(f"%{area.lower().replace(' ', '').strip()}%")
        if min_rating:
            conditions.append("ratings >= ?")
            params.append(float(min_rating))
            
        where_clause = " AND ".join(conditions)
        query_sql = f"""
            SELECT *, (ratings * 0.75 + reviews_count * 0.002) as score
            FROM g_map_master_table
            WHERE {where_clause}
            ORDER BY score DESC
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])
        cur.execute(query_sql, params)
        rows = [dict(r) for r in cur.fetchall()]
        return rows


def count_local_businesses(category: str, city: str, area: str = None, min_rating: float = None):
    with db_context() as conn:
        cur = conn.cursor()
        
        # Support multiple categories joined by ' and '
        categories = [c.strip() for c in category.split(" and ")]
        
        cat_conditions = []
        params = []
        for cat in categories:
            cat_conditions.append("(LOWER(business_category) LIKE ? OR LOWER(subcategory) LIKE ? OR LOWER(business_name) LIKE ?)")
            params.extend([f"%{cat}%", f"%{cat}%", f"%{cat}%"])
            
        cat_clause = "(" + " OR ".join(cat_conditions) + ")"
        
        conditions = [cat_clause, "LOWER(city) LIKE ?"]
        params.append(f"%{city}%")
        
        if area:
            conditions.append("REPLACE(LOWER(area), ' ', '') LIKE ?")
            params.append(f"%{area.lower().replace(' ', '').strip()}%")
        if min_rating:
            conditions.append("ratings >= ?")
            params.append(float(min_rating))
            
        where_clause = " AND ".join(conditions)
        query_sql = f"""
            SELECT COUNT(*)
            FROM g_map_master_table
            WHERE {where_clause}
        """
        cur.execute(query_sql, params)
        count = cur.fetchone()[0]
        return count


async def rewrite_query_with_context(user_query: str, last_metadata: dict) -> Optional[dict]:
    """Uses the LLM to rewrite a query based on previous search context."""
    if not last_metadata:
        return None
        
    prompt = f"""
    The user is searching for local businesses on our platform.
    Previous Search Context:
    - Category: {last_metadata.get('category')}
    - City: {last_metadata.get('city')}
    - Area: {last_metadata.get('area')}
    - Minimum Rating: {last_metadata.get('min_rating')}
    - Current Page Offset: {last_metadata.get('offset', 0)}
    
    New User Input: "{user_query}"
    
    Task:
    Determine if the new input is a follow-up question, filter adjustment, page navigation, or location refinement of the previous search.
    Examples of follow-ups:
    - "show more" or "next" -> offset should increase by 10
    - "only near Navrangpura" -> area should be "Navrangpura", offset reset to 0
    - "above 4.5 rating" or "4.5+ stars" -> min_rating should be 4.5, offset reset to 0
    - "any in Kothrud?" -> area should be "Kothrud", offset reset to 0
    - "previous page" or "go back" -> offset should decrease by 10 (min 0)
    
    If the new input is a follow-up, return a JSON object with the updated search parameters.
    If the user has cleared a filter (e.g. "any rating" or "all areas"), set that field to null.
    
    Allowed JSON fields in the returned object:
    - category (string)
    - city (string)
    - area (string or null)
    - min_rating (float or null)
    - offset (integer)
    
    If the input is a COMPLETELY NEW search (e.g. user previously searched for gyms and now wants pizza) or a general conversational question, return ONLY the word: null
    
    Respond ONLY with the JSON object or the word "null", without markdown blocks.
    """
    
    try:
        from llm_client import call_llm
        response = await anyio.to_thread.run_sync(
            call_llm, 
            [{"role": "user", "content": prompt}], 
            "google/gemini-2.5-flash-lite", 
            2, 
            150
        )
        content = response.get("content", "").strip()
        if content.startswith("```"):
            content = content.replace("```json", "").replace("```", "").strip()
        if content.lower() == "null" or not content:
            return None
        
        updated = json.loads(content)
        if isinstance(updated, dict):
            merged = last_metadata.copy()
            for k in ["category", "city", "area", "min_rating", "offset"]:
                if k in updated:
                    merged[k] = updated[k]
            return merged
    except Exception as e:
        print(f"[REWRITER] Context rewrite error: {e}")
    return None

@app.post("/api/query")
async def search(req: SearchRequest):
    try:
        from assistant_manager import classify_intent, get_greeting_response, is_greeting, get_guidance, get_assistant_response
        
        # --- PROMPT INJECTION CHECK ---
        if check_prompt_injection(req.query):
            resp = {"type": "faq", "data": "Safety check failed. Please submit a valid query."}
            if req.session_id:
                _save_chat_message(req.session_id, "assistant", json.dumps(resp))
            return resp
            
        q_lower = req.query.lower().strip()
        session_phone = req.session.get("phone") if req.session else None
        session_email = req.session.get("email") if req.session else None
        lang = req.language or "en"
        chat_session_id = req.session_id  # May be None for old clients

        # --- STATEFUL SEARCH PAGINATION & FILTERS REWRITER ---
        # Default parameters
        current_offset = 0
        current_limit = 10
        active_area = None
        active_min_rating = None
        
        # Retrieve search context from last assistant message metadata
        metadata = None
        if chat_session_id:
            metadata = _get_last_search_metadata(chat_session_id)
            
        # Detect follow-up search actions
        is_next = q_lower in ["next", "show next 10 results", "show next 5 results", "next 5", "next 10", "next 5 results", "next 10 results", "show next 10", "next results", "next option", "more", "/next"]
        is_prev = q_lower in ["prev", "previous", "previous results", "show previous 10 results", "show previous 5 results", "previous 5 results", "/prev"]
        is_filter_rating = q_lower.startswith("filter by rating:")
        is_filter_area = q_lower.startswith("filter by area:")
        is_show_nearby = q_lower in ["show nearby", "nearby", "near me"]
        is_search_another = q_lower in ["search another location", "search another city"]
        is_clear_rating = q_lower in ["filter by rating: all", "filter by rating: none", "clear rating"]
        is_clear_area = q_lower in ["filter by area: all", "filter by area: none", "clear area"]
        
        is_fast_follow_up = is_next or is_prev or is_filter_rating or is_filter_area or is_show_nearby or is_search_another or is_clear_rating or is_clear_area
        
        rewritten_metadata = None
        if metadata:
            if is_fast_follow_up:
                rewritten_metadata = metadata.copy()
                if is_next:
                    page_inc = 5 if "5" in q_lower else 10
                    prev_limit = metadata.get("limit", 10)
                    rewritten_metadata["offset"] = metadata.get("offset", 0) + prev_limit
                    rewritten_metadata["limit"] = page_inc
                elif is_prev:
                    page_dec = 5 if "5" in q_lower or metadata.get("limit") == 5 else 10
                    rewritten_metadata["offset"] = max(0, metadata.get("offset", 0) - page_dec)
                    rewritten_metadata["limit"] = page_dec
                elif is_filter_rating:
                    rating_str = q_lower.replace("filter by rating:", "").replace("+", "").strip()
                    try:
                        rewritten_metadata["min_rating"] = float(rating_str)
                    except:
                        rewritten_metadata["min_rating"] = None
                    rewritten_metadata["offset"] = 0
                elif is_clear_rating:
                    rewritten_metadata["min_rating"] = None
                    rewritten_metadata["offset"] = 0
                elif is_filter_area:
                    area_str = q_lower.replace("filter by area:", "").strip()
                    rewritten_metadata["area"] = area_str if area_str and area_str != "all" else None
                    rewritten_metadata["offset"] = 0
                elif is_clear_area:
                    rewritten_metadata["area"] = None
                    rewritten_metadata["offset"] = 0
                elif is_show_nearby:
                    if req.session and req.session.get("area"):
                        rewritten_metadata["area"] = req.session.get("area")
                    rewritten_metadata["offset"] = 0
                
                category = rewritten_metadata.get("category")
                city = rewritten_metadata.get("city")
                current_offset = rewritten_metadata.get("offset", 0)
                current_limit = rewritten_metadata.get("limit", 10)
                active_area = rewritten_metadata.get("area")
                active_min_rating = rewritten_metadata.get("min_rating")
                
                original_query = f"{category} in {city}"
                req.query = original_query
                q_lower = original_query.lower().strip()
                print(f"[FOLLOW-UP SEARCH] Fast Action resolved: '{req.query}', Offset: {current_offset}, Limit: {current_limit}, Area: {active_area}, Rating: {active_min_rating}")
            else:
                # Try LLM context rewriter for natural language follow-ups
                rewritten_metadata = await rewrite_query_with_context(req.query, metadata)
                if rewritten_metadata:
                    category = rewritten_metadata.get("category")
                    city = rewritten_metadata.get("city")
                    current_offset = rewritten_metadata.get("offset", 0)
                    current_limit = rewritten_metadata.get("limit", 10)
                    active_area = rewritten_metadata.get("area")
                    active_min_rating = rewritten_metadata.get("min_rating")
                    
                    original_query = f"{category} in {city}"
                    req.query = original_query
                    q_lower = original_query.lower().strip()
                    print(f"[REWRITER] Natural language follow-up rewritten: {rewritten_metadata}")
                else:
                    original_query = req.query
        else:
            original_query = req.query

        # --- MEMORY: Save user message & load history ---
        if chat_session_id:
            _save_chat_message(chat_session_id, "user", original_query)
            _update_session_title(chat_session_id, original_query)
            chat_history = _get_recent_history(chat_session_id, limit=10)
        else:
            chat_history = []

        # --- 1. MANDATORY AUTH CHECK for MY BUSINESS actions (Must run FIRST) ---
        is_my_biz_query = any(x in q_lower for x in [
            "show my business", "show business", "my business",
            "update my business", "update business",
            "manage product", "manage products",
            "manage deal", "manage deals"
        ])

        if is_my_biz_query:
            if not session_phone and not session_email:
                resp = {"type": "faq", "data": "Please login with your mobile number or email to manage your business profile. Click 'Login' at the top!"}
                if chat_session_id:
                    _save_chat_message(chat_session_id, "assistant", json.dumps(resp))
                return resp

            from business_by_phone import normalize_phone, get_businesses_by_phone, get_businesses_by_email
            try:
                if session_phone:
                    raw_matches = get_businesses_by_phone(session_phone)
                else:
                    raw_matches = get_businesses_by_email(session_email)
                    
                if not raw_matches:
                    resp = {"type": "faq", "data": "I couldn't find a business registered with your credentials."}
                    if chat_session_id:
                        _save_chat_message(chat_session_id, "assistant", json.dumps(resp))
                    return resp
                
                biz_row = raw_matches[0]
                results = map_business_fields([biz_row])
                
                # CASE 1: MANAGE PRODUCTS
                if "manage product" in q_lower or "show product" in q_lower:
                    conn = sqlite3.connect(DATABASE_URL, check_same_thread=False)
                    cur = conn.cursor()
                    cur.execute("SELECT * FROM products WHERE business_id = ?", (biz_row.get("id"),))
                    rows = cur.fetchall()
                    cols = [c[0] for c in cur.description]
                    conn.close()
                    items = [dict(zip(cols, r)) for r in rows]
                    if not items:
                        resp = {"type": "faq", "data": "You haven't added any products yet. Click 'Add Product' to start!"}
                    else:
                        resp = {"type": "manage_products", "content": items, "intro": "Here are your products:"}
                    if chat_session_id:
                        _save_chat_message(chat_session_id, "assistant", json.dumps(resp))
                    return resp

                # CASE 2: MANAGE DEALS
                elif "manage deal" in q_lower or "show deal" in q_lower:
                    conn = sqlite3.connect(DATABASE_URL, check_same_thread=False)
                    cur = conn.cursor()
                    cur.execute("SELECT * FROM deals WHERE business_id = ?", (biz_row.get("id"),))
                    rows = cur.fetchall()
                    cols = [c[0] for c in cur.description]
                    conn.close()
                    items = [dict(zip(cols, r)) for r in rows]
                    if not items:
                        resp = {"type": "faq", "data": "You haven't added any deals yet. Click 'Add Deal' to start!"}
                    else:
                        resp = {"type": "manage_deals", "content": items, "intro": "Here are your active deals:"}
                    if chat_session_id:
                        _save_chat_message(chat_session_id, "assistant", json.dumps(resp))
                    return resp

                # CASE 3: SHOW BUSINESS PROFILE
                elif "show" in q_lower:
                    biz = raw_matches[0]
                    mapped = map_business_fields([biz])[0]
                    fields = [
                        ("name", "Business Name"), ("category", "Category"),
                        ("phone_number", "Phone"), ("address", "Address"),
                        ("area", "Area"), ("city", "City"),
                        ("state", "State"), ("website", "Website")
                    ]
                    suggs = []
                    for fk, fn in fields:
                        val = biz.get(fk)
                        is_miss = not val or str(val).strip().lower() in ["none", "", "null", "not available"]
                        suggs.append({
                            "field": fk,
                            "title": f"Update {fn}",
                            "reason": f"{fn} is missing — add it now!" if is_miss else f"Current: {val}",
                            "action": f"Update {fn}",
                            "is_missing": is_miss
                        })
                    suggs.sort(key=lambda x: not x["is_missing"])
                    resp = {
                        "type": "database",
                        "data": [mapped],
                        "intro": f"Here is the business registered with your account:",
                        "prompt": "Tap any field below to update your profile:",
                        "suggestions": suggs
                    }
                    if chat_session_id:
                        _save_chat_message(chat_session_id, "assistant", json.dumps(resp))
                    return resp
                
                # CASE 4: UPDATE BUSINESS PROFILE
                elif "update" in q_lower:
                    biz = raw_matches[0]
                    t = lambda k: lang_fetch(k, lang)
                    fields = [
                        ("name", t("name")), ("category", t("category")), 
                        ("phone_number", t("phone_number")), ("address", t("address")), 
                        ("area", t("area")), ("city", t("city")), 
                        ("state", t("state")), ("website", t("website"))
                    ]
                    suggs = []
                    for fk, fn in fields:
                        val = biz.get(fk)
                        is_miss = not val or str(val).strip().lower() in ["none", "", "null", "not available"]
                        suggs.append({
                            "field": fk,
                            "title": f"{t('update_label')} {fn}",
                            "reason": f"{fn} {t('missing_reason')}" if is_miss else f"{t('change_reason')} {fn}.",
                            "action": f"Update {fn}",
                            "is_missing": is_miss
                        })
                    suggs.sort(key=lambda x: not x["is_missing"])
                    resp = {"type": "suggestions", "intro": t("update_prompt"), "content": suggs}
                    if chat_session_id:
                        _save_chat_message(chat_session_id, "assistant", json.dumps(resp))
                    return resp
            except Exception as e:
                print(f"Error in Auth Fast-path: {e}")
                return {"type": "faq", "data": "I had trouble finding your business. Please ensure you are logged in."}

        # --- 2. QUICK COMMAND SHORTCUTS ---
        cmd_map = {
            "add product": "start_add_product",
            "add deal": "start_add_deal",
            "add business": "add_new_business",
            "new business": "add_new_business",
            "reset chat": "reset_chat",
            "login": "login_trigger"
        }
        if q_lower in cmd_map:
            return {"type": "command", "command": cmd_map[q_lower]}

        # --- 3. GREETINGS (0ms Response Time) ---
        if is_greeting(req.query):
            resp = {"type": "faq", "data": await anyio.to_thread.run_sync(get_greeting_response, lang)}
            if chat_session_id:
                _save_chat_message(chat_session_id, "assistant", json.dumps(resp))
            return resp

        # --- 4. FAST SEARCH PATH (Response time < 50ms) ---
        category, city, extracted_area = extract_search_params(q_lower)
        # Verify it's a real search query, not a conversational question containing a category
        if category and not is_conversational_question(req.query):
            # Fallback city if not found in query
            if not city:
                if session_phone or session_email:
                    from business_by_phone import get_businesses_by_phone, get_businesses_by_email
                    try:
                        ub = get_businesses_by_phone(session_phone) if session_phone else get_businesses_by_email(session_email)
                        if ub:
                            city = ub[0].get("city", "").lower()
                    except:
                        pass
                if not city:
                    try:
                        conn = sqlite3.connect(DATABASE_URL)
                        cur = conn.cursor()
                        cur.execute("SELECT city, COUNT(*) as cnt FROM g_map_master_table WHERE city != '' GROUP BY city ORDER BY cnt DESC LIMIT 1")
                        r = cur.fetchone()
                        city = r[0].lower() if r else "surat"
                        conn.close()
                    except:
                        city = "surat"

            # For new searches (not fast follow-ups or rewritten follow-ups), apply the extracted area as active_area
            if not is_fast_follow_up and not rewritten_metadata:
                active_area = extracted_area
                current_limit = 10  # reset page size for a brand new search

            print(f"[FAST SEARCH] Category: '{category}', City: '{city}', Offset: {current_offset}, Limit: {current_limit}, Area: {active_area}, Rating: {active_min_rating}")
            
            # Query SQLite local DB with active pagination, limit, and filters
            results = query_local_businesses(category, city, offset=current_offset, limit=current_limit, area=active_area, min_rating=active_min_rating)
            
            # Trigger online scraping on page 0 if < 3 results or explicit online search requested
            explicit_online = any(w in q_lower for w in ["online", "live", "web", "scrape", "internet", "google", "find online", "search online", "latest", "current", "real-time", "real time"])
            if (len(results) < 3 or explicit_online) and current_offset == 0:
                try:
                    from search_online import search_online_and_save
                    if active_area:
                        scrape_query = f"{category} in {active_area}, {city}"
                    else:
                        scrape_query = f"{category} in {city}"
                    print(f"[FAST SEARCH] Scraped online search for '{scrape_query}' (results count: {len(results)}, explicit: {explicit_online})")
                    online_results = await anyio.to_thread.run_sync(search_online_and_save, scrape_query)
                    if online_results:
                        load_cities_and_categories_cache()
                        results = query_local_businesses(category, city, offset=current_offset, limit=current_limit, area=active_area, min_rating=active_min_rating)
                except Exception as scraping_err:
                    print(f"[FAST SEARCH] Scraping failed: {scraping_err}")

            if results or current_offset > 0:
                mapped_results = map_business_fields(results) if results else []
                total_count = count_local_businesses(category, city, area=active_area, min_rating=active_min_rating)
                
                # Build rich ChatGPT-style interactive suggestions
                suggestions = []
                if total_count > current_offset + current_limit:
                    suggestions.append({
                        "title": "Next 5 Results ⏭️",
                        "action": "next_option",
                        "query": "Show Next 5 Results"
                    })
                    suggestions.append({
                        "title": "Next 10 Results ⏭️",
                        "action": "next_option",
                        "query": "Show Next 10 Results"
                    })
                if current_offset > 0:
                    suggestions.append({
                        "title": "Previous Results ⏮️",
                        "action": "prev_option",
                        "query": "Previous Results"
                    })
                
                # Add area dynamic suggestion chips based on database presence
                try:
                    conn = sqlite3.connect(DATABASE_URL)
                    cur = conn.cursor()
                    cur.execute(
                        "SELECT area, COUNT(*) as cnt FROM g_map_master_table WHERE LOWER(city) = ? AND (LOWER(business_category) LIKE ? OR LOWER(subcategory) LIKE ?) AND area != '' GROUP BY area ORDER BY cnt DESC LIMIT 3",
                        (city.lower(), f"%{category}%", f"%{category}%")
                    )
                    top_areas = [r[0] for r in cur.fetchall()]
                    conn.close()
                    for ta in top_areas:
                        if active_area and ta.lower() == active_area.lower():
                            continue
                        suggestions.append({
                            "title": f"Area: {ta} 📍",
                            "action": "filter_area",
                            "query": f"Filter by Area: {ta}"
                        })
                except Exception as e:
                    print(f"Error fetching top areas: {e}")
                
                # Add rating dynamic suggestion chips
                if not active_min_rating or active_min_rating < 4.5:
                    suggestions.append({
                        "title": "Filter 4.5+ ⭐",
                        "action": "filter_rating",
                        "query": "Filter by Rating: 4.5+"
                    })
                elif active_min_rating == 4.5:
                    suggestions.append({
                        "title": "Clear Rating 🌟",
                        "action": "clear_rating",
                        "query": "Filter by Rating: All"
                    })
                
                # Location switch chip
                suggestions.append({
                    "title": "Search Another City 🔍",
                    "action": "search_another_city",
                    "query": "Search Another Location"
                })

                # Embed search metadata in assistant response
                search_meta = {
                    "category": category,
                    "city": city,
                    "offset": current_offset,
                    "limit": current_limit,
                    "area": active_area,
                    "min_rating": active_min_rating
                }
                
                filter_suffix = ""
                if active_area:
                    filter_suffix += f" in {active_area}"
                if active_min_rating:
                    filter_suffix += f" rated {active_min_rating}+ ⭐"

                resp = {
                    "type": "database",
                    "data": mapped_results,
                    "intro": f"Here are the {category}s in {city.capitalize()}{filter_suffix} (showing {current_offset + 1}-{min(current_offset + current_limit, total_count)} of {total_count}):",
                    "prompt": f"Use the options below to paginate or filter listings:",
                    "suggestions": suggestions,
                    "search_metadata": search_meta
                }
                
                # Log search history for analytics
                try:
                    conn = sqlite3.connect(DATABASE_URL)
                    cur = conn.cursor()
                    cur.execute("""
                        INSERT INTO search_history (user_id, search_query, resolved_city, resolved_category)
                        VALUES (?, ?, ?, ?)
                    """, (get_current_user_id(session=req.session), original_query, city, category))
                    conn.commit()
                    conn.close()
                except Exception as e:
                    print(f"Error logging search history: {e}")

                if chat_session_id:
                    _save_chat_message(chat_session_id, "assistant", json.dumps(resp))
                return resp

        # --- 5. CONVERSATIONAL FALLBACK & AI FLOW ---
        intent = await anyio.to_thread.run_sync(classify_intent, req.query)

        if intent in ["FAQ", "FAST_RESULT"]:
            from fast_result import fast_answer
            resp = {"type": "faq", "data": fast_answer(req.query)}
            if chat_session_id:
                _save_chat_message(chat_session_id, "assistant", json.dumps(resp))
            return resp
            
        if intent == "BUSINESS_UPDATE":
            keywords = ["phone", "address", "name", "category", "website", "city", "state", "area"]
            if any(f in q_lower for f in keywords):
                resp = {"type": "faq", "data": await anyio.to_thread.run_sync(get_guidance, intent, req.query, lang)}
                if chat_session_id:
                    _save_chat_message(chat_session_id, "assistant", json.dumps(resp))
                return resp
            return search(SearchRequest(query="update my business", session=req.session, language=lang, session_id=chat_session_id))

        if intent in ["SEARCH_BUSINESS", "BUSINESS_STATUS", "TEXT_TO_SQL", "SUGGESTION"]:
            explicit_online = any(w in q_lower for w in ["online", "live", "web", "scrape", "internet", "google", "find online", "search online", "latest", "current", "real-time", "real time"])
            try:
                from text_to_sql import generate_sql
                sql = generate_sql(req.query)
                if sql not in ["UNSAFE_QUERY", ""]:
                    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
                    DB_PATH = os.path.join(BASE_DIR, "google_map_data.db")
                    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
                    cur = conn.cursor()
                    cur.execute(sql)
                    rows = cur.fetchall()
                    print("SQL:", sql)
                    print("RowsFound:", len(rows))
                    cols = [c[0] for c in cur.description] if cur.description else []
                    conn.close()
                    if rows and len(rows) >= 3 and not explicit_online:
                        resp = {
                            "type": "database", 
                            "data": map_business_fields([dict(zip(cols, r)) for r in rows]), 
                            "intro": lang_fetch("found_results", lang),
                            "prompt": "Use the options below to paginate listings:",
                            "suggestions": [
                                {
                                    "title": "Next 10 Results ⏭️",
                                    "action": "next_option",
                                    "query": "Show Next 10 Results"
                                }
                            ]
                        }
                        if chat_session_id:
                            _save_chat_message(chat_session_id, "assistant", json.dumps(resp))
                        return resp
            except Exception as e:
                print("SQL ERROR:", e)
    
            if intent == "SEARCH_BUSINESS" or explicit_online:
                try:
                    from search_online import search_online_and_save
                    online = await anyio.to_thread.run_sync(search_online_and_save, req.query)
                    if online:
                        resp = {
                            "type": "database", 
                            "data": map_business_fields(online), 
                            "intro": lang_fetch("found_online", lang),
                            "prompt": "Use the options below to paginate listings:",
                            "suggestions": [
                                {
                                    "title": "Next 10 Results ⏭️",
                                    "action": "next_option",
                                    "query": "Show Next 10 Results"
                                }
                            ]
                        }
                        if chat_session_id:
                            _save_chat_message(chat_session_id, "assistant", json.dumps(resp))
                        return resp
                except:
                    pass

        # Call Gemini assistant response with cleaned context-aware conversation history
        bot_reply = await anyio.to_thread.run_sync(get_assistant_response, req.query, "No results.", lang, chat_history)
        resp = {"type": "faq", "data": bot_reply}
        if chat_session_id:
            _save_chat_message(chat_session_id, "assistant", json.dumps(resp))
        return resp
    except Exception as e:
        print(f"[Search Query Error] {e}")
        raise HTTPException(400, str(e))

@app.put("/api/business/{business_id}")
def update_biz(business_id: int, req: UpdateRequest, payload: dict = Depends(get_authenticated_user)):
    user_id = payload.get("id")
    conn = sqlite3.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SELECT owner_id FROM g_map_master_table WHERE global_business_id = ?", (business_id,))
    row = cur.fetchone()
    conn.close()
    if row and row[0] and row[0] != user_id:
        raise HTTPException(403, "You do not have permission to modify this business listing.")
    try:
        from business_update import update_business
        update_business(business_id, {req.field: req.value})
        log_audit_action(user_id, "UPDATE", "g_map_master_table", business_id, "system")
        return {"success": True}
    except Exception as e: raise HTTPException(400, str(e))

@app.post("/api/business")
def add_biz(req: BusinessAddRequest, payload: dict = Depends(get_authenticated_user)):
    user_id = payload.get("id")
    try:
        from datetime import datetime
        print(f"DEBUG: add_biz request: {req.dict()}")
        conn = sqlite3.connect(DATABASE_URL, check_same_thread=False)
        cur = conn.cursor()
        
        # Proactive duplicate check to prevent duplicate business listings
        phone_check = req.phone.strip() if req.phone else ""
        cur.execute(
            f"SELECT global_business_id FROM {BIZ_TABLE} WHERE LOWER(business_name) = ? AND LOWER(city) = ? AND (phone_number = ? OR LOWER(address) = ?)",
            (req.name.strip().lower(), req.city.strip().lower(), phone_check, req.address.strip().lower())
        )
        if cur.fetchone():
            conn.close()
            raise HTTPException(400, "A business listing with this name and phone/address already exists in this city.")

        created_at = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        email_val = (req.email or "").strip().lower()
        
        cur.execute(
            f"""
            INSERT INTO {BIZ_TABLE} (
                business_name, address, phone_number, business_category, city, area, state, 
                reviews_count, ratings, created_at, email, owner_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (req.name, req.address, req.phone, req.category, req.city, req.area, req.state, 0, 0.0, created_at, email_val, user_id)
        )
        new_id = cur.lastrowid
        conn.commit()
        conn.close()

        # Append to CSV
        try:
            with csv_lock:
                with open(CSV_PATH, "a", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f)
                    writer.writerow([new_id, req.name, req.address, "", req.phone, 0, 0.0,
                                     req.category, "", req.city, req.state or "", req.area or "", created_at, email_val])
        except Exception as csv_e:
            print(f"CSV Sync Error: {csv_e}")

        log_audit_action(user_id, "CREATE", "g_map_master_table", new_id, "system")
        return {"success": True, "id": new_id}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error adding business: {e}")
        raise HTTPException(400, str(e))

@app.delete("/api/business/{business_id}")
def delete_business_route(business_id: int, payload: dict = Depends(get_authenticated_user)):
    user_id = payload.get("id")
    conn = sqlite3.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SELECT owner_id FROM g_map_master_table WHERE global_business_id = ?", (business_id,))
    row = cur.fetchone()
    conn.close()
    if row and row[0] and row[0] != user_id:
        raise HTTPException(403, "You do not have permission to delete this business listing.")
    try:
        conn = sqlite3.connect(DATABASE_URL, check_same_thread=False)
        cur = conn.cursor()
        cur.execute("DELETE FROM products WHERE business_id = ?", (business_id,))
        cur.execute("DELETE FROM deals WHERE business_id = ?", (business_id,))
        cur.execute(f"DELETE FROM {BIZ_TABLE} WHERE global_business_id = ?", (business_id,))
        conn.commit()
        conn.close()
        
        # Sync deletion to CSV
        try:
            if os.path.exists(CSV_PATH):
                rows = []
                with open(CSV_PATH, 'r', encoding='utf-8', newline='') as f:
                    reader = csv.reader(f)
                    for row in reader:
                        if row and str(row[0]) == str(business_id):
                            continue
                        rows.append(row)
                with open(CSV_PATH, 'w', encoding='utf-8', newline='') as f:
                    writer = csv.writer(f)
                    writer.writerows(rows)
        except Exception as csv_e:
            print(f"CSV Delete Sync Error: {csv_e}")
            
        log_audit_action(user_id, "DELETE", "g_map_master_table", business_id, "system")
        return {"success": True, "message": "Business deleted successfully"}
    except Exception as e:
        print(f"Error deleting business: {e}")
        raise HTTPException(400, str(e))

@app.get("/api/merchant/businesses")
def get_merchant_businesses(payload: dict = Depends(get_authenticated_user)):
    user_id = payload.get("id")
    try:
        conn = sqlite3.connect(DATABASE_URL)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute("SELECT * FROM g_map_master_table WHERE owner_id = ?", (user_id,))
        rows = cur.fetchall()
        cols = [c[0] for c in cur.description]
        conn.close()
        businesses = [dict(zip(cols, r)) for r in rows]
        return {
            "success": True,
            "businesses": map_business_fields(businesses)
        }
    except Exception as e:
        print(f"Error fetching merchant businesses: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# --- PRODUCT & DEAL ENDPOINTS ---
@app.post("/api/products")
def add_product(req: AddProductRequest, payload: dict = Depends(get_authenticated_user)):
    user_id = payload.get("id")
    if not req.business_id:
        raise HTTPException(400, "business_id is required. Please login first.")
    conn = sqlite3.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SELECT owner_id FROM g_map_master_table WHERE global_business_id = ?", (req.business_id,))
    row = cur.fetchone()
    conn.close()
    if row and row[0] and row[0] != user_id:
        raise HTTPException(403, "You do not have permission to manage products for this business listing.")
    try:
        from datetime import datetime
        print(f"DEBUG add_product: business_id={req.business_id}, name={req.name}, price={req.price}, category={req.category}")
        conn = sqlite3.connect(DATABASE_URL, check_same_thread=False)
        cur = conn.cursor()
        created_at = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        cur.execute("""
            INSERT INTO products (business_id, name, price, description, category, created_at, image_url)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (int(req.business_id), req.name, float(req.price or 0.0), req.description or "", req.category or "", created_at, req.image_url or ""))
        new_id = cur.lastrowid
        conn.commit()
        conn.close()
        log_audit_action(user_id, "CREATE", "products", new_id, "system")
        return {"success": True}
    except Exception as e:
        print(f"ERROR add_product: {e}")
        raise HTTPException(400, str(e))

@app.post("/api/deals")
def add_deal(req: AddDealRequest, payload: dict = Depends(get_authenticated_user)):
    user_id = payload.get("id")
    if not req.business_id:
        raise HTTPException(400, "business_id is required.")
    conn = sqlite3.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SELECT owner_id FROM g_map_master_table WHERE global_business_id = ?", (req.business_id,))
    row = cur.fetchone()
    conn.close()
    if row and row[0] and row[0] != user_id:
        raise HTTPException(403, "You do not have permission to manage deals for this business listing.")
    try:
        from datetime import datetime
        conn = sqlite3.connect(DATABASE_URL, check_same_thread=False)
        cur = conn.cursor()
        created_at = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        cur.execute("""
            INSERT INTO deals (business_id, title, discount_pct, expiry_date, description, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (req.business_id, req.title, req.discount_pct, req.expiry_date, req.description, created_at))
        new_id = cur.lastrowid
        conn.commit()
        conn.close()
        log_audit_action(user_id, "CREATE", "deals", new_id, "system")
        return {"success": True}
    except Exception as e: raise HTTPException(400, str(e))

@app.get("/api/business/{biz_id}/products")
def get_products(biz_id: int):
    try:
        conn = sqlite3.connect(DATABASE_URL, check_same_thread=False)
        cur = conn.cursor()
        cur.execute("SELECT * FROM products WHERE business_id = ?", (biz_id,))
        rows = cur.fetchall()
        cols = [c[0] for c in cur.description]
        conn.close()
        return [dict(zip(cols, r)) for r in rows]
    except Exception as e: raise HTTPException(400, str(e))

@app.get("/api/business/{biz_id}/deals")
def get_deals(biz_id: int):
    try:
        conn = sqlite3.connect(DATABASE_URL, check_same_thread=False)
        cur = conn.cursor()
        cur.execute("SELECT * FROM deals WHERE business_id = ?", (biz_id,))
        rows = cur.fetchall()
        cols = [c[0] for c in cur.description]
        conn.close()
        return [dict(zip(cols, r)) for r in rows]
    except Exception as e: raise HTTPException(400, str(e))

@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, payload: dict = Depends(get_authenticated_user)):
    user_id = payload.get("id")
    conn = sqlite3.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SELECT business_id FROM products WHERE id = ?", (product_id,))
    p_row = cur.fetchone()
    if p_row:
        cur.execute("SELECT owner_id FROM g_map_master_table WHERE global_business_id = ?", (p_row[0],))
        b_row = cur.fetchone()
        if b_row and b_row[0] and b_row[0] != user_id:
            conn.close()
            raise HTTPException(403, "You do not have permission to modify this product.")
    conn.close()
    try:
        conn = sqlite3.connect(DATABASE_URL, check_same_thread=False)
        cur = conn.cursor()
        cur.execute("DELETE FROM products WHERE id = ?", (product_id,))
        conn.commit()
        conn.close()
        log_audit_action(user_id, "DELETE", "products", product_id, "system")
        return {"success": True}
    except Exception as e: raise HTTPException(400, str(e))

@app.delete("/api/deals/{deal_id}")
def delete_deal(deal_id: int, payload: dict = Depends(get_authenticated_user)):
    user_id = payload.get("id")
    conn = sqlite3.connect(DATABASE_URL)
    cur = conn.cursor()
    cur.execute("SELECT business_id FROM deals WHERE id = ?", (deal_id,))
    d_row = cur.fetchone()
    if d_row:
        cur.execute("SELECT owner_id FROM g_map_master_table WHERE global_business_id = ?", (d_row[0],))
        b_row = cur.fetchone()
        if b_row and b_row[0] and b_row[0] != user_id:
            conn.close()
            raise HTTPException(403, "You do not have permission to modify this deal.")
    conn.close()
    try:
        conn = sqlite3.connect(DATABASE_URL, check_same_thread=False)
        cur = conn.cursor()
        cur.execute("DELETE FROM deals WHERE id = ?", (deal_id,))
        conn.commit()
        conn.close()
        log_audit_action(user_id, "DELETE", "deals", deal_id, "system")
        return {"success": True}
    except Exception as e: raise HTTPException(400, str(e))

@app.get("/api/business/search-name")
def search_by_name(name: str):
    try:
        conn = sqlite3.connect(DATABASE_URL, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(f"SELECT * FROM {BIZ_TABLE} WHERE business_name LIKE ? LIMIT 10", (f"%{name}%",))
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return map_business_fields(rows)
    except Exception as e:
        print(f"Error searching by name: {e}")
        raise HTTPException(400, str(e))

@app.get("/api/business/search-address")
def search_by_address(address: str):
    try:
        conn = sqlite3.connect(DATABASE_URL, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(
            f"SELECT * FROM {BIZ_TABLE} WHERE address LIKE ? OR area LIKE ? OR city LIKE ? LIMIT 10",
            (f"%{address}%", f"%{address}%", f"%{address}%")
        )
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return map_business_fields(rows)
    except Exception as e:
        print(f"Error searching by address: {e}")
        raise HTTPException(400, str(e))

@app.get("/api/categories")
def get_categories(hierarchy: Optional[bool] = False):
    try:
        conn = sqlite3.connect(DATABASE_URL, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        if hierarchy:
            cur.execute("SELECT id, name, icon FROM categories WHERE parent_id IS NULL ORDER BY name")
            parents = [dict(p) for p in cur.fetchall()]
            for parent in parents:
                cur.execute("SELECT id, name, icon FROM categories WHERE parent_id = ? ORDER BY name", (parent["id"],))
                children = [dict(c) for c in cur.fetchall()]
                for child in children:
                    cur.execute("SELECT COUNT(*) FROM g_map_master_table WHERE LOWER(business_category) = ?", (child["name"].lower(),))
                    child["count"] = cur.fetchone()[0]
                parent["subcategories"] = children
                parent["count"] = sum(c["count"] for c in children)
            conn.close()
            return parents
        else:
            cur.execute("""
                SELECT c.name, 
                       (SELECT COUNT(*) FROM g_map_master_table g WHERE LOWER(g.business_category) = LOWER(c.name)) as count
                FROM categories c
                WHERE c.parent_id IS NOT NULL
                ORDER BY count DESC LIMIT 50
            """)
            rows = cur.fetchall()
            conn.close()
            return [{"name": r[0], "category": r[0], "count": r[1]} for r in rows if r[0]]
    except Exception as e:
        print(f"Error fetching categories: {e}")
        raise HTTPException(400, str(e))

@app.get("/api/trending")
def get_trending():
    try:
        conn = sqlite3.connect(DATABASE_URL, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(f"SELECT * FROM {BIZ_TABLE} WHERE ratings > 0 ORDER BY ratings DESC, reviews_count DESC LIMIT 8")
        rows = [dict(r) for r in cur.fetchall()]
        conn.close()
        return map_business_fields(rows)
    except Exception as e:
        print(f"Error fetching trending: {e}")
        raise HTTPException(400, str(e))

@app.get("/api/analytics")
def get_analytics():
    """Power BI-style analytics data from real database"""
    try:
        conn = sqlite3.connect(DATABASE_URL, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        # KPIs
        cur.execute(f"SELECT COUNT(*) as total FROM {BIZ_TABLE}")
        total_businesses = cur.fetchone()['total']

        cur.execute(f"SELECT COUNT(DISTINCT business_category) as total FROM {BIZ_TABLE} WHERE business_category != ''")
        total_categories = cur.fetchone()['total']

        cur.execute(f"SELECT COUNT(DISTINCT city) as total FROM {BIZ_TABLE} WHERE city != ''")
        total_cities = cur.fetchone()['total']

        cur.execute(f"SELECT COUNT(DISTINCT state) as total FROM {BIZ_TABLE} WHERE state != ''")
        total_states = cur.fetchone()['total']

        cur.execute(f"SELECT AVG(ratings) as avg_rating FROM {BIZ_TABLE} WHERE ratings > 0")
        avg_rating = round(cur.fetchone()['avg_rating'] or 0, 2)

        cur.execute(f"SELECT SUM(reviews_count) as total FROM {BIZ_TABLE}")
        total_reviews = cur.fetchone()['total'] or 0

        cur.execute(f"SELECT COUNT(*) as cnt FROM {BIZ_TABLE} WHERE ratings >= 4.5")
        top_rated = cur.fetchone()['cnt']

        # Categories by count (bar chart)
        cur.execute(f"""
            SELECT business_category as name, COUNT(*) as count 
            FROM {BIZ_TABLE} 
            WHERE business_category IS NOT NULL AND business_category != ''
            GROUP BY business_category ORDER BY count DESC LIMIT 15
        """)
        categories_data = [dict(r) for r in cur.fetchall()]

        # Cities distribution (donut chart)
        cur.execute(f"""
            SELECT city as name, COUNT(*) as count 
            FROM {BIZ_TABLE} 
            WHERE city IS NOT NULL AND city != ''
            GROUP BY city ORDER BY count DESC LIMIT 10
        """)
        cities_data = [dict(r) for r in cur.fetchall()]

        # States distribution
        cur.execute(f"""
            SELECT state as name, COUNT(*) as count 
            FROM {BIZ_TABLE} 
            WHERE state IS NOT NULL AND state != ''
            GROUP BY state ORDER BY count DESC LIMIT 10
        """)
        states_data = [dict(r) for r in cur.fetchall()]

        # Ratings distribution (histogram)
        cur.execute(f"""
            SELECT 
                CASE 
                    WHEN ratings = 0 THEN '0 Stars'
                    WHEN ratings < 2 THEN '1 Star'
                    WHEN ratings < 3 THEN '2 Stars'
                    WHEN ratings < 4 THEN '3 Stars'
                    WHEN ratings < 4.5 THEN '4 Stars'
                    ELSE '5 Stars'
                END as label,
                COUNT(*) as count
            FROM {BIZ_TABLE}
            GROUP BY label ORDER BY label
        """)
        ratings_dist = [dict(r) for r in cur.fetchall()]

        # Top businesses by reviews
        cur.execute(f"""
            SELECT business_name, business_category, city, ratings, reviews_count
            FROM {BIZ_TABLE}
            WHERE ratings > 0 AND business_name != ''
            ORDER BY ratings DESC, reviews_count DESC
            LIMIT 10
        """)
        top_businesses = [dict(r) for r in cur.fetchall()]

        # Monthly registrations (based on created_at)
        cur.execute(f"""
            SELECT 
                SUBSTR(created_at, 1, 7) as month,
                COUNT(*) as count
            FROM {BIZ_TABLE}
            WHERE created_at IS NOT NULL AND created_at != ''
            GROUP BY month
            ORDER BY month
            LIMIT 12
        """)
        monthly_data = [dict(r) for r in cur.fetchall()]

        # Category-City heatmap data
        cur.execute(f"""
            SELECT business_category, city, COUNT(*) as count
            FROM {BIZ_TABLE}
            WHERE business_category != '' AND city != ''
            GROUP BY business_category, city
            ORDER BY count DESC
            LIMIT 50
        """)
        heatmap_data = [dict(r) for r in cur.fetchall()]

        # Products and deals counts
        cur.execute("SELECT COUNT(*) as cnt FROM products")
        total_products = cur.fetchone()['cnt']

        cur.execute("SELECT COUNT(*) as cnt FROM deals")
        total_deals = cur.fetchone()['cnt']

        cur.execute("SELECT COUNT(DISTINCT user_id) as cnt FROM chat_sessions WHERE user_id IS NOT NULL")
        total_users = cur.fetchone()['cnt']

        cur.execute("SELECT COUNT(*) as cnt FROM chat_sessions")
        total_chats = cur.fetchone()['cnt']

        # Real-time search history trends (Phases 9 & 10)
        cur.execute("SELECT COUNT(*) as cnt FROM search_history")
        total_searches = cur.fetchone()['cnt'] or 0

        cur.execute("""
            SELECT search_query as name, COUNT(*) as count 
            FROM search_history 
            GROUP BY search_query ORDER BY count DESC LIMIT 10
        """)
        search_trends = [dict(r) for r in cur.fetchall()]

        # Total registered users
        cur.execute("SELECT COUNT(*) as cnt FROM users")
        total_registered_users = cur.fetchone()['cnt'] or 0
        
        # Total audit log actions
        cur.execute("SELECT COUNT(*) as cnt FROM audit_logs")
        total_audit_logs = cur.fetchone()['cnt'] or 0

        conn.close()

        return {
            "kpis": {
                "total_businesses": total_businesses,
                "total_categories": total_categories,
                "total_cities": total_cities,
                "total_states": total_states,
                "avg_rating": avg_rating,
                "total_reviews": total_reviews,
                "top_rated_count": top_rated,
                "total_products": total_products,
                "total_deals": total_deals,
                "total_users": total_registered_users,
                "total_chats": total_chats,
                "total_searches": total_searches,
                "total_audit_logs": total_audit_logs
            },
            "charts": {
                "categories_by_count": categories_data,
                "cities_distribution": cities_data,
                "states_distribution": states_data,
                "ratings_distribution": ratings_dist,
                "monthly_registrations": monthly_data,
                "heatmap": heatmap_data,
                "search_trends": search_trends
            },
            "top_businesses": top_businesses,
        }
    except Exception as e:
        print(f"Analytics error: {e}")
        raise HTTPException(500, str(e))

@app.get("/health")
@app.get("/api/health")
def health(): return {"status": "ok", "database": "connected", "businesses": 507}

# =============================================================================
# CHAT MEMORY ENDPOINTS
# =============================================================================

@app.post("/api/chats")
def create_chat_session(req: ChatSessionCreate):
    """Create a new chat session. Returns the new session_id."""
    try:
        session_id = str(uuid.uuid4())
        now = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        with db_context() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                (session_id, req.user_id, req.title or "New Chat", now, now)
            )
            conn.commit()
        return {"success": True, "session_id": session_id}
    except Exception as e:
        print(f"Error creating chat session: {e}")
        raise HTTPException(400, str(e))

class ChatSyncRequest(BaseModel):
    guest_user_id: str
    user_id: str

@app.post("/api/chats/sync")
def sync_guest_chats(req: ChatSyncRequest):
    """Synchronizes guest chats to the user's account after login by updating the user_id field in the database."""
    try:
        with db_context() as conn:
            cur = conn.cursor()
            now = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
            # Update user_id for all sessions belonging to guest_user_id
            cur.execute(
                "UPDATE chat_sessions SET user_id = ?, updated_at = ? WHERE user_id = ?",
                (req.user_id, now, req.guest_user_id)
            )
            count = cur.rowcount
            conn.commit()
        return {"success": True, "message": "Guest chats synchronized successfully", "count": count}
    except Exception as e:
        print(f"Error syncing guest chats: {e}")
        raise HTTPException(400, str(e))

@app.get("/api/chats")
def list_chat_sessions(user_id: str):
    """List all chat sessions for a specific user (phone or email). Private — filtered by user_id."""
    try:
        with db_context() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT id, title, created_at, updated_at, is_pinned FROM chat_sessions WHERE user_id = ? ORDER BY is_pinned DESC, updated_at DESC LIMIT 50",
                (user_id,)
            )
            rows = cur.fetchall()
            return [{"session_id": r["id"], "title": r["title"], "created_at": r["created_at"], "updated_at": r["updated_at"], "is_pinned": bool(r["is_pinned"])} for r in rows]
    except Exception as e:
        print(f"Error listing chat sessions: {e}")
        raise HTTPException(400, str(e))

@app.put("/api/chats/{session_id}")
def rename_chat_session(session_id: str, req: dict, user_id: Optional[str] = None):
    title = req.get("title")
    if not title: raise HTTPException(400, "Title is required")
    try:
        with db_context() as conn:
            cur = conn.cursor()
            if user_id:
                cur.execute("SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
                if not cur.fetchone():
                    raise HTTPException(403, "Access denied.")
            cur.execute("UPDATE chat_sessions SET title = ? WHERE id = ?", (title, session_id))
            conn.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))

@app.put("/api/chats/{session_id}/pin")
def pin_chat_session(session_id: str, req: dict, user_id: Optional[str] = None):
    is_pinned = req.get("is_pinned", False)
    try:
        with db_context() as conn:
            cur = conn.cursor()
            if user_id:
                cur.execute("SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
                if not cur.fetchone():
                    raise HTTPException(403, "Access denied.")
            cur.execute("UPDATE chat_sessions SET is_pinned = ? WHERE id = ?", (1 if is_pinned else 0, session_id))
            conn.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))

@app.get("/api/chats/{session_id}")
def get_chat_history(session_id: str, user_id: Optional[str] = None):
    """Get all messages for a session. Optionally verify ownership via user_id."""
    try:
        with db_context() as conn:
            cur = conn.cursor()
            # Ownership check: if user_id is provided, ensure this session belongs to them
            if user_id:
                cur.execute("SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
                if not cur.fetchone():
                    raise HTTPException(403, "Access denied: session does not belong to this user.")
            cur.execute(
                "SELECT role, content, timestamp FROM chat_messages WHERE session_id = ? ORDER BY id ASC",
                (session_id,)
            )
            rows = cur.fetchall()
            return [{"role": r["role"], "content": r["content"], "timestamp": r["timestamp"]} for r in rows]
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting chat history: {e}")
        raise HTTPException(400, str(e))

@app.delete("/api/chats/{session_id}")
def delete_chat_session(session_id: str, user_id: Optional[str] = None):
    """Delete a chat session and all its messages. Optionally verify ownership."""
    try:
        with db_context() as conn:
            cur = conn.cursor()
            if user_id:
                cur.execute("SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
                if not cur.fetchone():
                    raise HTTPException(403, "Access denied.")
            cur.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
            cur.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
            conn.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting chat session: {e}")
        raise HTTPException(400, str(e))

def _save_chat_message(session_id: str, role: str, content: str):
    """Helper: Save a single message to chat_messages and update session updated_at."""
    try:
        now = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        with db_context() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO chat_messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
                (session_id, role, content, now)
            )
            cur.execute(
                "UPDATE chat_sessions SET updated_at = ? WHERE id = ?",
                (now, session_id)
            )
            conn.commit()
    except Exception as e:
        print(f"[Chat Save Error] {e}")

def _get_recent_history(session_id: str, limit: int = 10):
    """Helper: Fetch the last N messages for a session to use as LLM context."""
    try:
        with db_context() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY id DESC LIMIT ?",
                (session_id, limit)
            )
            rows = cur.fetchall()
            # reverse it so it's in chronological order
            history = [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]
            return history
    except Exception as e:
        print(f"[History Fetch Error] {e}")
        return []

def _update_session_title(session_id: str, first_message: str):
    """Set the session title from the first user message (truncated to 60 chars)."""
    try:
        title = first_message.strip()[:60] or "New Chat"
        with db_context() as conn:
            cur = conn.cursor()
            cur.execute(
                "UPDATE chat_sessions SET title = ? WHERE id = ? AND title = 'New Chat'",
                (title, session_id)
            )
            conn.commit()
    except Exception as e:
        print(f"[Title Update Error] {e}")

class SuggestionRequest(BaseModel):
    text: str
    language: Optional[str] = "en"
    flow: Optional[str] = "QUERY"

@app.post("/api/smart-suggestions")
def get_ai_suggestions(req: SuggestionRequest):
    try:
        from llm_client import get_smart_suggestions
        suggs = get_smart_suggestions(req.text, req.language, req.flow)
        return {"suggestions": suggs}
    except Exception as e:
        print(f"Server Suggestion Error: {e}")
        return {"suggestions": []}


# ── BOOKMARKS / FAVORITES ENDPOINTS ───────────────────────────────────

class BookmarkRequest(BaseModel):
    user_id: str
    business_id: int

@app.post("/api/bookmarks")
def add_bookmark(req: BookmarkRequest):
    try:
        with db_context() as conn:
            cur = conn.cursor()
            # Check duplicate
            cur.execute("SELECT id FROM bookmarks WHERE user_id = ? AND business_id = ?", (req.user_id, req.business_id))
            if cur.fetchone():
                return {"success": True, "message": "Already bookmarked"}
            cur.execute("INSERT INTO bookmarks (user_id, business_id) VALUES (?, ?)", (req.user_id, req.business_id))
            conn.commit()
        return {"success": True, "message": "Bookmarked successfully"}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.get("/api/bookmarks")
def list_bookmarks(user_id: str):
    try:
        with db_context() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT b.business_id, g.* 
                FROM bookmarks b
                JOIN g_map_master_table g ON b.business_id = g.global_business_id
                WHERE b.user_id = ?
                ORDER BY b.id DESC
            """, (user_id,))
            rows = [dict(r) for r in cur.fetchall()]
        return map_business_fields(rows)
    except Exception as e:
        raise HTTPException(400, str(e))

@app.delete("/api/bookmarks/{business_id}")
def remove_bookmark(business_id: int, user_id: str):
    try:
        with db_context() as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM bookmarks WHERE user_id = ? AND business_id = ?", (user_id, business_id))
            conn.commit()
        return {"success": True, "message": "Bookmark removed"}
    except Exception as e:
        raise HTTPException(400, str(e))

# ── COMPARE BUSINESSES ENDPOINT ───────────────────────────────────────

class CompareRequest(BaseModel):
    business_ids: List[int]

@app.post("/api/business/compare")
def compare_businesses(req: CompareRequest):
    try:
        if not req.business_ids:
            return []
        placeholders = ",".join("?" for _ in req.business_ids)
        with db_context() as conn:
            cur = conn.cursor()
            cur.execute(f"""
                SELECT * FROM g_map_master_table 
                WHERE global_business_id IN ({placeholders})
            """, tuple(req.business_ids))
            rows = [dict(r) for r in cur.fetchall()]
            
            # Map products and deals for each business to show side-by-side
            for r in rows:
                biz_id = r["global_business_id"]
                cur.execute("SELECT name, price, description FROM products WHERE business_id = ?", (biz_id,))
                r["products"] = [dict(p) for p in cur.fetchall()]
                cur.execute("SELECT title, discount_pct, expiry_date FROM deals WHERE business_id = ?", (biz_id,))
                r["deals"] = [dict(d) for d in cur.fetchall()]
                
        return map_business_fields(rows)
    except Exception as e:
        raise HTTPException(400, str(e))

# ── REVIEWS & RATINGS ENDPOINTS ───────────────────────────────────────

class ReviewAddRequest(BaseModel):
    business_id: int
    user_id: str
    rating: int
    comment: str = ""

@app.get("/api/reviews/{business_id}")
def get_reviews(business_id: int):
    try:
        with db_context() as conn:
            cur = conn.cursor()
            cur.execute("""
                SELECT * FROM reviews 
                WHERE business_id = ? 
                ORDER BY created_at DESC
            """, (business_id,))
            rows = [dict(r) for r in cur.fetchall()]
        return rows
    except Exception as e:
        raise HTTPException(400, str(e))

@app.post("/api/reviews")
def add_review(req: ReviewAddRequest):
    try:
        if req.rating < 1 or req.rating > 5:
            raise HTTPException(400, "Rating must be between 1 and 5")
            
        with db_context() as conn:
            cur = conn.cursor()
            # Insert the review
            cur.execute("""
                INSERT INTO reviews (business_id, user_id, rating, comment)
                VALUES (?, ?, ?, ?)
            """, (req.business_id, req.user_id, req.rating, req.comment))
            
            # Recalculate average rating and total count
            cur.execute("""
                SELECT COUNT(*), AVG(rating) FROM reviews WHERE business_id = ?
            """, (req.business_id,))
            row = cur.fetchone()
            count = row[0] or 0
            avg_rating = round(row[1] or 0.0, 1)
            
            # Update g_map_master_table
            cur.execute("""
                UPDATE g_map_master_table 
                SET reviews_count = ?, ratings = ?
                WHERE global_business_id = ?
            """, (count, avg_rating, req.business_id))
            
            conn.commit()
            
        return {"success": True, "message": "Review added", "reviews_count": count, "ratings": avg_rating}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.delete("/api/reviews/{review_id}")
def delete_review(review_id: int, user_id: str):
    try:
        with db_context() as conn:
            cur = conn.cursor()
            
            # Verify ownership and get business_id
            cur.execute("SELECT business_id, user_id FROM reviews WHERE id = ?", (review_id,))
            review = cur.fetchone()
            
            if not review:
                raise HTTPException(404, "Review not found")
                
            if review["user_id"] != user_id:
                raise HTTPException(403, "Not authorized to delete this review")
                
            biz_id = review["business_id"]
            
            # Delete review
            cur.execute("DELETE FROM reviews WHERE id = ?", (review_id,))
            
            # Recalculate average
            cur.execute("""
                SELECT COUNT(*), AVG(rating) FROM reviews WHERE business_id = ?
            """, (biz_id,))
            row = cur.fetchone()
            count = row[0] or 0
            avg_rating = round(row[1] or 0.0, 1)
            
            # Update g_map_master_table
            cur.execute("""
                UPDATE g_map_master_table 
                SET reviews_count = ?, ratings = ?
                WHERE global_business_id = ?
            """, (count, avg_rating, biz_id))
            
            conn.commit()
            
        return {"success": True, "message": "Review deleted", "reviews_count": count, "ratings": avg_rating}
    except Exception as e:
        raise HTTPException(400, str(e))
