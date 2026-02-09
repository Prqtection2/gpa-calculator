from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from main import scrape_skyward_final
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI()

# --- CORS SETTINGS ---
# This allows your React app (port 5173) to talk to this Python app (port 8000)
# In api.py

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Allows all connections (Good for testing)
    allow_credentials=False, # <--- CHANGE THIS TO FALSE
    allow_methods=["*"],
    allow_headers=["*"],
)
# Define the data we expect from the frontend
class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/get-grades")
def get_grades(login_data: LoginRequest):
    print(f"📩 Received login request for user: {login_data.username}")
    
    try:
        # Run the scraper with the credentials sent from React
        data = scrape_skyward_final(login_data.username, login_data.password)
        
        if not data:
            raise HTTPException(status_code=400, detail="Login failed or no data found")
            
        return data
    except Exception as e:
        print(f"❌ Server Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

#@app.get("/")
#def home():
#    return {"message": "Skyward API is running!"}

# ... inside api.py ...

# GET THE ABSOLUTE PATH OF WHERE THIS SCRIPT IS
# This ensures we find 'dist' even if the server starts from a different folder
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(BASE_DIR, "gpa-dashboard", "dist")

if os.path.exists(DIST_DIR):
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="static")
    print(f"✅ Frontend mounted successfully from: {DIST_DIR}")
else:
    print(f"⚠️ Warning: 'dist' folder not found at: {DIST_DIR}")
    # OPTIONAL: List what IS in the directory to help debug if it fails again
    print(f"📂 Current Directory Contents: {os.listdir(BASE_DIR)}")