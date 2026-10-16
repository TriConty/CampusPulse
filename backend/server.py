import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

load_dotenv(Path(__file__).parent / ".env")

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ.get("DB_NAME", "campus_pulse")]
SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
bearer = HTTPBearer(auto_error=False)


def hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def check_pw(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode(), h.encode())


def make_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=7)
    return jwt.encode({"sub": user_id, "exp": exp}, SECRET, algorithm="HS256")


async def current_user(cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer)):
    if not cred:
        raise HTTPException(401, "Please sign in")
    try:
        uid = jwt.decode(cred.credentials, SECRET, algorithms=["HS256"])["sub"]
    except jwt.PyJWTError:
        raise HTTPException(401, "Session expired, sign in again")
    user = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "Account not found")
    return user


class RegisterIn(BaseModel):
    name: str
    email: str
    password: str
    role: str = "student"
    club: Optional[str] = None
    interests: List[str] = []


class LoginIn(BaseModel):
    email: str
    password: str


class EventIn(BaseModel):
    title: str
    description: str
    venue: str
    deadline: datetime
    tags: List[str] = []


def public_event(e: dict, uid: str) -> dict:
    rsvps = e.get("rsvps", [])
    out = {k: v for k, v in e.items() if k != "rsvps"}
    return {**out, "rsvp_count": len(rsvps), "going": uid in rsvps}


async def seed():
    demo = [
        ("Campus Admin", "admin@nitt.edu", "Admin@12345", "admin", None, ["Coding"]),
        ("TPF Software Cell", "organizer@nitt.edu", "Organizer@123", "organizer",
         "The Programmers' Foundation", ["Coding", "Hackathons"]),
        ("Demo Student", "student@nitt.edu", "Student@123", "student", None,
         ["Coding", "Hackathons", "Design", "Robotics"]),
    ]
    for name, email, pw, role, club, interests in demo:
        if not await db.users.find_one({"email": email}):
            await db.users.insert_one({
                "id": str(uuid.uuid4()), "name": name, "email": email, "role": role,
                "club": club, "interests": interests, "password_hash": hash_pw(pw),
            })
    if await db.events.count_documents({}) == 0:
        org = await db.users.find_one({"email": "organizer@nitt.edu"})
        now = datetime.now(timezone.utc)
        samples = [
            ("Pragyan Hackathon 24h", "Build something useful in 24 hours. Teams of 2 to 4, mentors on site.",
             "Main Auditorium", ["Hackathons", "Coding"], 2),
            ("Line Follower Bot Workshop", "Hands-on session on sensors and PID tuning. Kits provided.",
             "Robotics Lab, ECE Block", ["Robotics"], 4),
            ("UI Teardown Night", "Pick apart real apps and redesign one screen with the design club.",
             "Lecture Hall Complex 3", ["Design"], 6),
            ("Open Mic Evening", "Music, poetry and stand-up. Sign up for a five minute slot.",
             "Open Air Theatre", ["Cultural", "Music"], 9),
        ]
        for title, desc, venue, tags, days in samples:
            await db.events.insert_one({
                "id": str(uuid.uuid4()), "title": title, "description": desc, "venue": venue,
                "tags": tags, "club": org["club"], "organizer_id": org["id"], "rsvps": [],
                "deadline": (now + timedelta(days=days)).isoformat(),
            })


@asynccontextmanager
async def lifespan(app: FastAPI):
    await seed()
    yield
    client.close()


app = FastAPI(title="Campus Pulse API", lifespan=lifespan)
api = APIRouter(prefix="/api")


@api.get("/")
async def health():
    return {"status": "ok"}


@api.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.strip().lower()
    if not email.endswith("@nitt.edu"):
        raise HTTPException(400, "Use your @nitt.edu email")
    if len(body.password) < 6:
        raise HTTPException(400, "Password needs at least 6 characters")
    if body.role not in ("student", "organizer"):
        raise HTTPException(400, "Pick student or organizer")
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "That email is already registered")
    user = {
        "id": str(uuid.uuid4()), "name": body.name.strip(), "email": email, "role": body.role,
        "club": body.club if body.role == "organizer" else None, "interests": body.interests,
    }
    await db.users.insert_one({**user, "password_hash": hash_pw(body.password)})
    return {"token": make_token(user["id"]), "user": user}


@api.post("/auth/login")
async def login(body: LoginIn):
    u = await db.users.find_one({"email": body.email.strip().lower()})
    if not u or not check_pw(body.password, u["password_hash"]):
        raise HTTPException(401, "Wrong email or password")
    u.pop("_id"), u.pop("password_hash")
    return {"token": make_token(u["id"]), "user": u}


@api.get("/auth/me")
async def me(user=Depends(current_user)):
    return user


@api.get("/events")
async def list_events(user=Depends(current_user)):
    events = await db.events.find({}, {"_id": 0}).sort("deadline", 1).to_list(500)
    return [public_event(e, user["id"]) for e in events]


@api.post("/events")
async def create_event(body: EventIn, user=Depends(current_user)):
    if user["role"] not in ("organizer", "admin"):
        raise HTTPException(403, "Only organizers can post events")
    event = {
        "id": str(uuid.uuid4()), **body.model_dump(exclude={"deadline"}),
        "deadline": body.deadline.astimezone(timezone.utc).isoformat(),
        "club": user.get("club") or "Campus Admin", "organizer_id": user["id"], "rsvps": [],
    }
    await db.events.insert_one(event)
    return public_event(event, user["id"])


@api.post("/events/{event_id}/rsvp")
async def toggle_rsvp(event_id: str, user=Depends(current_user)):
    e = await db.events.find_one({"id": event_id}, {"_id": 0})
    if not e:
        raise HTTPException(404, "Event not found")
    if datetime.fromisoformat(e["deadline"]) < datetime.now(timezone.utc):
        raise HTTPException(400, "Registration has closed")
    op = "$pull" if user["id"] in e["rsvps"] else "$addToSet"
    await db.events.update_one({"id": event_id}, {op: {"rsvps": user["id"]}})
    e = await db.events.find_one({"id": event_id}, {"_id": 0})
    return public_event(e, user["id"])


@api.get("/dashboard")
async def dashboard(user=Depends(current_user)):
    if user["role"] not in ("organizer", "admin"):
        raise HTTPException(403, "Organizers only")
    query = {} if user["role"] == "admin" else {"organizer_id": user["id"]}
    out = []
    for e in await db.events.find(query, {"_id": 0}).sort("deadline", 1).to_list(500):
        reach = await db.users.count_documents({"role": "student", "interests": {"$in": e["tags"]}})
        out.append({"id": e["id"], "title": e["title"], "club": e["club"], "deadline": e["deadline"],
                    "reach": reach, "signups": len(e["rsvps"])})
    return out


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
