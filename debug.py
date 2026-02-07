from playwright.sync_api import sync_playwright
import json
import time
import os

def load_secrets():
    """Loads username and password from secrets.json"""
    try:
        with open("secrets.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        print("❌ Error: 'secrets.json' file not found!")
        print("Please create it with {'skyward_user': '...', 'skyward_pass': '...'}")
        exit()

def inspect_split_tables():
    # Load credentials automatically
    creds = load_secrets()
    username = creds["skyward_user"]
    password = creds["skyward_pass"]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False) 
        page = browser.new_page()

        print("🚀 Logging in using secrets.json...")
        page.goto("https://skyward-alvinprod.iscorp.com/scripts/wsisa.dll/WService=wsedualvinisdtx/fwemnu01.w")
        page.fill('input[name="login"]', username)
        page.fill('input[name="password"]', password)
        page.click('a#bLogin')

        try:
            print("⏳ Waiting for dashboard...")
            page.wait_for_selector('a[data-nav="sfgradebook001.w"]', timeout=15000)
            page.click('a[data-nav="sfgradebook001.w"]')
            
            print("⏳ Waiting for grades to load...")
            # We wait for the class descriptions to load
            page.wait_for_selector('.classDesc', timeout=15000)
            time.sleep(3) 
        except:
            print("❌ Timeout / Login Failed")
            browser.close()
            return

        print("\n🕵️ STARTING SPLIT TABLE INVESTIGATION")
        
        # TEST 1: Find the Class Name Container
        print("\n--- TEST 1: LOCATING CLASS NAMES ---")
        class_elements = page.query_selector_all(".classDesc")
        print(f"Found {len(class_elements)} class name elements.")
        
        if len(class_elements) > 0:
            first_class = class_elements[0]
            print(f"First Class: '{first_class.inner_text()}'")
            
            # Check the parent of the class name
            parent = first_class.query_selector("xpath=../../..") # Go up to the TR or Table
            print(f"Class Container HTML (First 100 chars): {parent.inner_html()[:100]}")

        # TEST 2: Find the Grade Container
        print("\n--- TEST 2: LOCATING GRADE VALUES ---")
        # We look for the specific 'NW2' links we saw earlier
        grade_elements = page.query_selector_all('a[data-lit="NW2"]')
        print(f"Found {len(grade_elements)} 'NW2' grade cells.")

        if len(grade_elements) > 0:
            first_grade = grade_elements[0]
            print(f"First Grade Value: '{first_grade.inner_text()}'")
            
            # Check if the Class Name is inside the Grade's row?
            # We go up 4 levels from the grade to see if we find the class name text
            grade_ancestor = first_grade.query_selector("xpath=../../../..")
            ancestor_html = grade_ancestor.inner_html()
            
            if "AP European History" in ancestor_html or "Precalculus" in ancestor_html:
                print("✅ CONNECTION FOUND: Class Name and Grade ARE in the same row.")
            else:
                print("🚫 DISCONNECTED: Class Name is NOT in the grade's row.")
                print("   -> This confirms the 'Split Table' theory.")
                print("   -> We must scrape two separate lists and zip them together.")

        browser.close()

if __name__ == "__main__":
    inspect_split_tables()