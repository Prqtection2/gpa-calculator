# --- STAGE 1: Build the React Frontend ---
FROM node:18 as build-step
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- STAGE 2: Set up the Python Backend ---
FROM python:3.9-slim

# 1. Install system tools needed for Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Copy Python requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3. Install Playwright Browsers (The heavy lifting)
RUN playwright install chromium
RUN playwright install-deps

# 4. Copy the Backend Code
COPY api.py .
COPY main.py . 
# (Add any other python files you have here, like scraper.py if it's separate)

# 5. Copy the Built Frontend from Stage 1
COPY --from=build-step /app/dist ./dist

# 6. Start the Server
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8080"]