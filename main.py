from playwright.sync_api import sync_playwright
import json
import time

def load_secrets():
    """Loads username and password from secrets.json"""
    try:
        with open("secrets.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        print("❌ Error: 'secrets.json' file not found!")
        exit()

def get_weighted_gpa(class_name, grade):
    """
    Calculates the GPA points based on Alvin ISD logic.
    """
    # --- WEIGHTING LOGIC ---
    # 1. Check for the specific exception first
    if "Ind Study Tech App" in class_name:
        weight = 8.0
        level = "Advanced (Exception)"
    # 2. Check for Standard AP
    elif "AP " in class_name:
        weight = 8.0
        level = "Advanced"
    # 3. Check for APA / Pre-AP
    elif "APA" in class_name:
        weight = 7.0
        level = "Accelerated"
    # 4. Default to Academic
    else:
        weight = 6.0
        level = "Academic"

    try:
        # Clean the grade (handle "97 " or "100")
        clean_grade = grade.strip()
        if not clean_grade or not clean_grade.replace('.', '', 1).isdigit():
            return None
        numeric_grade = float(clean_grade)
    except ValueError:
        return None 

    gpa_points = weight - ((100 - numeric_grade) * 0.1)
    
    return {
        "grade": numeric_grade,
        "weight_class": level,
        "gpa_points": round(gpa_points, 2)
    }

def scrape_skyward_final(username=None, password=None):
    # If no arguments provided, try to load from secrets (for testing)
    if not username or not password:
        creds = load_secrets()
        username = creds["skyward_user"]
        password = creds["skyward_pass"]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True) 
        page = browser.new_page()

        print("🚀 [1/5] Logging in...")
        page.goto("https://skyward-alvinprod.iscorp.com/scripts/wsisa.dll/WService=wsedualvinisdtx/fwemnu01.w")
        page.fill('input[name="login"]', username)
        page.fill('input[name="password"]', password)
        page.click('a#bLogin')

        try:
            print("⏳ [2/5] Opening Dashboard...")
            page.wait_for_selector('a[data-nav="sfgradebook001.w"]', timeout=15000)
            page.click('a[data-nav="sfgradebook001.w"]')
            
            print("⏳ [3/5] Loading Gradebook...")
            # Wait for classes AND grades to populate
            page.wait_for_selector('.classDesc', timeout=15000)
            page.wait_for_selector('a[data-lit="NW2"]', timeout=15000)
            time.sleep(3) # Essential for allowing the two tables to align
        except Exception as e:
            print(f"❌ Error during navigation: {e}")
            browser.close()
            return []

        print("\n🕵️ [4/5] SCRAPING SPLIT TABLES...")
        
        # --- LIST A: Get all Class Names ---
        class_elements = page.query_selector_all(".classDesc")
        class_names = [el.inner_text().strip() for el in class_elements]
        
        # --- LIST B: Get all Grade Rows ---
        # We find the 'NW2' cell for each row, then walk up to its Parent Row (TR)
        nw2_cells = page.query_selector_all('a[data-lit="NW2"]')
        
        print(f"   → Found {len(class_names)} Class Names")
        print(f"   → Found {len(nw2_cells)} Grade Rows")

        if len(class_names) != len(nw2_cells):
            print("⚠️ WARNING: Mismatch between classes and grade rows. Data might be misaligned.")

        report_card = []

        # --- ZIP THEM TOGETHER ---
        for i in range(len(class_names)):
            current_class = class_names[i]
            
            # Identify the row by using the NW2 cell as an anchor
            anchor_cell = nw2_cells[i]
            grade_row = anchor_cell.query_selector("xpath=../../..") # Walk up to the TR tag
            
            # Find ALL grades in this specific row (NW2, SM1, NW3, etc.)
            all_grade_links = grade_row.query_selector_all('a[data-lit]')
            
            print(f"\n   📝 Processing: {current_class}")
            
            class_data = {
                "class_name": current_class,
                "grades": {}
            }

            for link in all_grade_links:
                term = link.get_attribute("data-lit")
                raw_grade = link.inner_text().strip()
                
                stats = get_weighted_gpa(current_class, raw_grade)
                
                if stats:
                    print(f"      - {term}: {stats['grade']} ({stats['gpa_points']} GPA)")
                    class_data["grades"][term] = {
                        "score": stats['grade'],
                        "gpa_points": stats['gpa_points'],
                        "level": stats['weight_class']
                    }

            report_card.append(class_data)

        print(f"\n✅ [5/5] Success! Generated report for {len(report_card)} classes.")
        browser.close()
        return report_card

if __name__ == "__main__":
    data = scrape_skyward_final()
    
    # Save to a file so we can inspect it easily
    with open("my_grades.json", "w") as f:
        json.dump(data, f, indent=2)
        
    print("\n--- JSON SAVED TO my_grades.json ---")