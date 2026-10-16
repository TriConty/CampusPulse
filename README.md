# Campus Pulse

Event discovery for NIT Trichy. Students see upcoming events ranked by their interests and deadline, RSVP, and add to Google Calendar. Organizers post events and watch reach and sign-ups. Only `@nitt.edu` emails can register.

Stack: React (Create React App) + Tailwind, FastAPI, MongoDB.

## Run locally
```bash
# backend (needs a MongoDB running or an Atlas URL)
cd backend
cp .env.example .env
pip install -r requirements.txt
uvicorn server:app --reload --port 8000

# frontend
cd frontend
cp .env.example .env
npm install
npm start
```

## Demo accounts (seeded on first start)
| Role | Email | Password |
|---|---|---|
| Admin | admin@nitt.edu | Admin@12345 |
| Organizer | organizer@nitt.edu | Organizer@123 |
| Student | student@nitt.edu | Student@123 |

Anyone can also register with an `@nitt.edu` email as a student or organizer. Remove the seeded accounts in `seed()` before sharing the link widely.

## Free hosting
1. **Database:** create a free MongoDB Atlas cluster, add a database user, allow `0.0.0.0/0` under Network Access, and copy the connection string.
2. **Backend (Render, free web service):** root directory `backend`, build command `pip install -r requirements.txt`, start command `uvicorn server:app --host 0.0.0.0 --port $PORT`. Environment: `MONGO_URL`, `DB_NAME`, `JWT_SECRET` (long random string), `CORS_ORIGINS` (your frontend URL). Free instances sleep when idle, so the first request can take about a minute.
3. **Frontend (Vercel or Netlify):** root directory `frontend`, build command `npm run build`, output `build`. Environment: `REACT_APP_BACKEND_URL` set to your Render URL (no trailing slash). Redeploy the backend after you know the frontend URL so CORS matches.

## Not built yet
Editing interests after signup, show-up (attendance) tracking, notifications, and image uploads for posters.
