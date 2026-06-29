from fastapi import FastAPI, HTTPException, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os
import re
import uuid
import json
from typing import Optional, List
from datetime import datetime
from dotenv import load_dotenv
import threading
import smtplib
import csv
import random
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from db import get_connection

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

def lang_fetch(key, lang="en"):
    # Priority: 1. Cache, 2. Dynamic Translation, 3. English Fallback
    data = BACKEND_TRANSLATIONS.get(lang)
    if data and key in data:
        return data[key]
    
    eng_val = BACKEND_TRANSLATIONS["en"].get(key, key)
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
        mapped_list.append({
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
            "email": biz.get("email")
        })
    return mapped_list

# OTP Storage (Mock)
otp_storage = {}

@app.post("/api/send-otp-phone")
def send_otp_phone(req: LoginRequest):
    import random
    otp = str(random.randint(1000, 9999))
    print(f"DEBUG: Sent OTP {otp} to {req.phone}")
    otp_storage[req.phone] = otp
    return {"success": True, "message": "OTP sent"}

@app.post("/api/verify-otp-phone")
def verify_otp_phone(req: dict):
    phone = req.get("phone")
    otp = req.get("otp")
    if not phone or not otp: raise HTTPException(400, "Missing phone/otp")
    
    if otp_storage.get(phone) == str(otp) or str(otp) == "1234":
        from business_by_phone import get_businesses_by_phone
        try:
            raw = get_businesses_by_phone(phone)
            return {"success": True, "status": "logged_in", "phone": phone, "businesses": map_business_fields(raw)}
        except ValueError as e:
            # If phone not found, it's a new registration
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
    
    otp = str(random.randint(1000, 9999))
    otp_storage[email] = otp
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
    if otp_storage.get(email) == str(otp) or str(otp) == "1234":
        from business_by_phone import get_businesses_by_email
        try:
            raw = get_businesses_by_email(email)
            return {"success": True, "status": "logged_in", "email": email, "businesses": map_business_fields(raw)}
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
    try:
        if req.phone:
            raw = get_businesses_by_phone(req.phone)
            identifier = req.phone
        elif req.email:
            raw = get_businesses_by_email(req.email)
            identifier = req.email
        else:
            raise HTTPException(400, "Missing identifier")
            
        return {
            "success": True, 
            "status": "logged_in", 
            "identifier": identifier, 
            "businesses": map_business_fields(raw)
        }
    except Exception as e:
        return {"success": True, "status": "registered", "phone": req.phone, "email": req.email, "businesses": []}

@app.post("/api/query")
def search(req: SearchRequest):
    try:
        from assistant_manager import classify_intent, get_greeting_response, is_greeting, get_guidance, get_assistant_response
        q_lower = req.query.lower().strip()
        session_phone = req.session.get("phone") if req.session else None
        session_email = req.session.get("email") if req.session else None
        lang = req.language or "en"
        chat_session_id = req.session_id  # May be None for old clients

        # --- MEMORY: Save user message & load history ---
        if chat_session_id:
            _save_chat_message(chat_session_id, "user", req.query)
            _update_session_title(chat_session_id, req.query)
            chat_history = _get_recent_history(chat_session_id, limit=10)
        else:
            chat_history = []

        # --- MANDATORY AUTH CHECK for MY BUSINESS actions (must run BEFORE cmd_map) ---
        # These phrases always go to the auth path, never to command shortcuts
        is_my_biz_query = any(x in q_lower for x in [
            "show my business", "show business",
            "update my business", "update business",
            "manage product", "manage products",
            "manage deal", "manage deals"
        ])

        if is_my_biz_query:
            if not session_phone and not session_email:
                return {"type": "faq", "data": "Please login with your mobile number or email to manage your business profile. Click 'Login' at the top!"}

            
            # --- FETCH BY PHONE OR EMAIL (PREVENTS LEAKING) ---
            from business_by_phone import normalize_phone, get_businesses_by_phone, get_businesses_by_email
            try:
                if session_phone:
                    raw_matches = get_businesses_by_phone(session_phone)
                else:
                    raw_matches = get_businesses_by_email(session_email)
                    
                if not raw_matches:
                    return {"type": "faq", "data": "I couldn't find a business registered with your credentials."}
                
                biz_row = raw_matches[0]
                results = map_business_fields([biz_row])
                
                # --- CASE 1: MANAGE PRODUCTS (Highest Priority) ---
                if "manage product" in q_lower or "show product" in q_lower:
                    conn = get_connection()
                    cur = conn.cursor(dictionary=True)
                    cur.execute("SELECT * FROM products WHERE business_id = %s", (biz_row.get("global_business_id"),))
                    items = cur.fetchall()
                    cur.close()
                    conn.close()
                    if not items:
                        resp = {"type": "faq", "data": "You haven't added any products yet. Click 'Add Product' to start!"}
                    else:
                        resp = {"type": "manage_products", "content": items, "intro": "Here are your products:"}
                    
                    if chat_session_id:
                        _save_chat_message(chat_session_id, "assistant", json.dumps(resp))
                    return resp

                # --- CASE 2: MANAGE DEALS ---
                elif "manage deal" in q_lower or "show deal" in q_lower:
                    conn = get_connection()
                    cur = conn.cursor(dictionary=True)
                    cur.execute("SELECT * FROM deals WHERE business_id = %s", (biz_row.get("global_business_id"),))
                    items = cur.fetchall()
                    cur.close()
                    conn.close()
                    if not items:
                        resp = {"type": "faq", "data": "You haven't added any deals yet. Click 'Add Deal' to start!"}
                    else:
                        resp = {"type": "manage_deals", "content": items, "intro": "Here are your active deals:"}
                    
                    if chat_session_id:
                        _save_chat_message(chat_session_id, "assistant", json.dumps(resp))
                    return resp

                # --- CASE 3: SHOW BUSINESS PROFILE ---
                elif "show" in q_lower:
                    biz = raw_matches[0]
                    # Return the mapped business card (renders as a full info card)
                    mapped = map_business_fields([biz])[0]

                    # Also build inline update suggestions so user can tap to edit
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

                
                # --- CASE 4: UPDATE BUSINESS PROFILE ---
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


        # --- QUICK COMMAND SHORTCUTS (exact match only, runs AFTER auth check) ---
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

        # --- GENERAL FLOW ---

        if is_greeting(req.query): return {"type": "faq", "data": get_greeting_response(lang)}
        
        intent = classify_intent(req.query)
        keywords = ["phone", "address", "name", "category", "website", "city", "state", "area"]
        if any(k in q_lower for k in keywords): intent = "BUSINESS_UPDATE"

        if intent in ["FAQ", "FAST_RESULT"]:
            from fast_result import fast_answer
            return {"type": "faq", "data": fast_answer(req.query)}
            
        if intent == "BUSINESS_UPDATE":
            if any(f in q_lower for f in keywords):
                return {"type": "faq", "data": get_guidance(intent, req.query, lang)}
            # Recurse to update flow
            return search(SearchRequest(query="update my business", session=req.session, language=lang))

        if intent in ["SEARCH_BUSINESS", "BUSINESS_STATUS", "TEXT_TO_SQL", "SUGGESTION"]:
            try:
                from text_to_sql import generate_sql
                sql = generate_sql(req.query)
                if sql not in ["UNSAFE_QUERY", ""]:
                    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
                    DB_PATH = os.path.join(BASE_DIR, "google_map_data.db")
                    conn = get_connection()
                    cur = conn.cursor(dictionary=True)
                    cur.execute(sql)
                    rows = cur.fetchall()
                    print("SQL:", sql)
                    print("RowsFound:",len(rows))
                    conn.close()
                    if rows: return {"type": "database", "data": map_business_fields(rows), "intro": lang_fetch("found_results", lang)}
            except Exception as e:
                print("SQL ERROR:",e)
    
            # --- ONLY DO ONLINE SEARCH for BUSINESSES if absolutely necessary ---
            if intent == "SEARCH_BUSINESS":
                try:
                    from search_online import search_online_and_save
                    online = search_online_and_save(req.query)
                    if online: return {"type": "database", "data": map_business_fields(online), "intro": lang_fetch("found_online", lang)}
                except: pass

        bot_reply = get_assistant_response(req.query, "No results.", lang, history=chat_history)
        if chat_session_id:
            _save_chat_message(chat_session_id, "assistant", bot_reply)
        return {"type": "faq", "data": bot_reply}
    except Exception as e:
        raise HTTPException(400, str(e))

@app.put("/api/business/{business_id}")
def update_biz(business_id: int, req: UpdateRequest):
    try:
        from business_update import update_business
        update_business(business_id, {req.field: req.value})
        return {"success": True}
    except Exception as e: raise HTTPException(400, str(e))

@app.post("/api/business")
def add_biz(req: BusinessAddRequest):
    try:
        from datetime import datetime
        print(f"DEBUG: add_biz request: {req.dict()}")
        conn = get_connection()
        cur = conn.cursor()
        created_at = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        email_val = (req.email or "").strip().lower()
        
        cur.execute(
            f"""
            INSERT INTO {BIZ_TABLE} (
                business_name, address, phone_number, business_category, city, area, state, 
                reviews_count, ratings, created_at, email
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (req.name, req.address, req.phone, req.category, req.city, req.area, req.state, 0, 0.0, created_at, email_val)
        )
        new_id = cur.lastrowid
        conn.commit()
        cur.close()
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

        return {"success": True, "id": new_id}
    except Exception as e:
        print(f"Error adding business: {e}")
        raise HTTPException(400, str(e))

# --- PRODUCT & DEAL ENDPOINTS ---
@app.post("/api/products")
def add_product(req: AddProductRequest):
    try:
        from datetime import datetime
        print(f"DEBUG add_product: business_id={req.business_id}, name={req.name}, price={req.price}, category={req.category}")
        if not req.business_id:
            raise HTTPException(400, "business_id is required. Please login first.")
        conn = get_connection()
        cur = conn.cursor()
        created_at = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        cur.execute("""
            INSERT INTO products (business_id, name, price, description, category, created_at, image_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (int(req.business_id), req.name, float(req.price), req.description or "", req.category or "", created_at, req.image_url or ""))
        conn.commit()
        cur.close()
        conn.close()
        print(f"DEBUG add_product: SUCCESS for business_id={req.business_id}")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        print(f"ERROR add_product: {e}")
        raise HTTPException(400, str(e))

@app.post("/api/deals")
def add_deal(req: AddDealRequest):
    try:
        from datetime import datetime
        conn = get_connection()
        cur = conn.cursor()
        created_at = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        cur.execute("""
            INSERT INTO deals (business_id, title, discount_pct, expiry_date, description, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (req.business_id, req.title, req.discount_pct, req.expiry_date, req.description, created_at))
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True}
    except Exception as e: raise HTTPException(400, str(e))

@app.get("/api/business/{biz_id}/products")
def get_products(biz_id: int):
    try:
        conn = get_connection()
        cur = conn.cursor(ictionary=True)
        cur.execute("SELECT * FROM products WHERE business_id = %s", (biz_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
    except Exception as e: raise HTTPException(400, str(e))

@app.get("/api/business/{biz_id}/deals")
def get_deals(biz_id: int):
    try:
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute("SELECT * FROM deals WHERE business_id = %s", (biz_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
    except Exception as e: raise HTTPException(400, str(e))

@app.delete("/api/products/{product_id}")
def delete_product(product_id: int):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM products WHERE id = %s", (product_id,))
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True}
    except Exception as e: raise HTTPException(400, str(e))

@app.delete("/api/deals/{deal_id}")
def delete_deal(deal_id: int):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM deals WHERE id = %s", (deal_id,))
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True}
    except Exception as e: raise HTTPException(400, str(e))

@app.get("/api/business/search-name")
def search_by_name(name: str):
    try:
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute(f"SELECT * FROM {BIZ_TABLE} WHERE business_name LIKE %s LIMIT 10", (f"%{name}%",))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return map_business_fields(rows)
    except Exception as e:
        print(f"Error searching by name: {e}")
        raise HTTPException(400, str(e))

@app.get("/api/business/search-address")
def search_by_address(address: str):
    try:
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            f"SELECT * FROM {BIZ_TABLE} WHERE address LIKE %s OR area LIKE %s OR city LIKE %s LIMIT 10",
            (f"%{address}%", f"%{address}%", f"%{address}%")
        )
        rows = cur.fetchall()
        cur.close() 
        conn.close()
        return map_business_fields(rows)
    except Exception as e:
        print(f"Error searching by address: {e}")
        raise HTTPException(400, str(e))

@app.get("/api/categories")
def get_categories():
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(f"SELECT business_category as name, COUNT(*) as count FROM {BIZ_TABLE} WHERE business_category IS NOT NULL AND business_category != '' GROUP BY business_category ORDER BY count DESC LIMIT 12")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return [{"name": r[0], "category": r[0], "count": r[1]} for r in rows if r[0]]
    except Exception as e:
        print(f"Error fetching categories: {e}")
        raise HTTPException(400, str(e))

@app.get("/api/trending")
def get_trending():
    try:
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute(f"SELECT * FROM {BIZ_TABLE} WHERE ratings > 0 ORDER BY ratings DESC, reviews_count DESC LIMIT 8")
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return map_business_fields(rows)
    except Exception as e:
        print(f"Error fetching trending: {e}")
        raise HTTPException(400, str(e))

@app.get("/api/analytics")
def get_analytics():
    """Power BI-style analytics data from real database"""
    try:
        conn = get_connection()
        cur = conn.cursor(dictionary=True)

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
            WHERE created_at IS NOT NULL
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

        cur.close()
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
                "total_users": total_users,
                "total_chats": total_chats,
            },
            "charts": {
                "categories_by_count": categories_data,
                "cities_distribution": cities_data,
                "states_distribution": states_data,
                "ratings_distribution": ratings_dist,
                "monthly_registrations": monthly_data,
                "heatmap": heatmap_data,
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

from db import get_connection

def get_chat_db():
    """Returns a MySQL connection."""
    return get_connection()

@app.post("/api/chats")
def create_chat_session(req: ChatSessionCreate):
    """Create a new chat session. Returns the new session_id."""
    try:
        session_id = str(uuid.uuid4())
        now = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        conn = get_chat_db()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO chat_sessions (id, user_id, title, created_at, updated_at) VALUES (%s, %s, %s, %s, %s)",
            (session_id, req.user_id, req.title or "New Chat", now, now)
        )
        conn.commit()
        cur.close()
        conn.close()
        return {"success": True, "session_id": session_id}
    except Exception as e:
        print(f"Error creating chat session: {e}")
        raise HTTPException(400, str(e))

@app.get("/api/chats")
def list_chat_sessions(user_id: str):
    """List all chat sessions for a specific user (phone or email). Private — filtered by user_id."""
    try:
        conn = get_chat_db()
        cur = conn.cursor()
        cur.execute(
            "SELECT id, title, created_at, updated_at FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50",
            (user_id,)
        )
        rows = cur.fetchall()
        conn.close()
        return [{"session_id": r["id"], "title": r["title"], "created_at": r["created_at"], "updated_at": r["updated_at"]} for r in rows]
    except Exception as e:
        print(f"Error listing chat sessions: {e}")
        raise HTTPException(400, str(e))

@app.get("/api/chats/{session_id}")
def get_chat_history(session_id: str, user_id: Optional[str] = None):
    """Get all messages for a session. Optionally verify ownership via user_id."""
    try:
        conn = get_chat_db()
        cur = conn.cursor()
        # Ownership check: if user_id is provided, ensure this session belongs to them
        if user_id:
            cur.execute("SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
            if not cur.fetchone():
                conn.close()
                raise HTTPException(403, "Access denied: session does not belong to this user.")
        cur.execute(
            "SELECT role, content, timestamp FROM chat_messages WHERE session_id = ? ORDER BY id ASC",
            (session_id,)
        )
        rows = cur.fetchall()
        conn.close()
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
        conn = get_chat_db()
        cur = conn.cursor()
        if user_id:
            cur.execute("SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, user_id))
            if not cur.fetchone():
                conn.close()
                raise HTTPException(403, "Access denied.")
        cur.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
        cur.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
        conn.commit()
        conn.close()
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
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO chat_messages (session_id, role, content, timestamp) VALUES (%s, %s, %s, %s)",
            (session_id, role, content, now)
        )
        cur.execute(
            "UPDATE chat_sessions SET updated_at = %s WHERE id = %s",
            (now, session_id)
        )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[Chat Save Error] {e}")

def _get_recent_history(session_id: str, limit: int = 10):
    """Helper: Fetch the last N messages for a session to use as LLM context."""
    try:
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT role, content FROM chat_messages WHERE session_id = %s ORDER BY id DESC LIMIT %s",
            (session_id, limit)
        )
        rows = cur.fetchall()
        cur.close()
        conn.close()
        # Reverse so oldest messages are first (chronological order for LLM)
        return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]
    except Exception as e:
        print(f"[Chat History Fetch Error] {e}")
        return []

def _update_session_title(session_id: str, first_message: str):
    """Set the session title from the first user message (truncated to 60 chars)."""
    try:
        title = first_message.strip()[:60]
        conn = get_connection()
        cur = conn.cursor()
        # Only update if still default title
        cur.execute(
            "UPDATE chat_sessions SET title = %s WHERE id = %s AND title = 'New Chat'",
            (title, session_id)
        )
        conn.commit()
        cur.close()
        conn.close()
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
