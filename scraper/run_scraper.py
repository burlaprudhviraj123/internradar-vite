"""
Main scraper runner — fetches from all sources and pushes to Firestore.

Usage:
    cd scraper
    python run_scraper.py

Schedule (macOS cron job - every 30 minutes):
    */30 * * * * cd /path/to/internradar-vite/scraper && python run_scraper.py >> scraper.log 2>&1
"""

import hashlib
from firebase_init import get_db
from scrapers.greenhouse import scrape_greenhouse_internships
from scrapers.internshala import scrape_internshala_internships
from scrapers.unstop import scrape_unstop_internships


def make_doc_id(company: str, role: str) -> str:
    """Generate a consistent, deduplicating document ID from company + role."""
    key = f"{company.lower().strip()}:{role.lower().strip()}"
    return hashlib.md5(key.encode()).hexdigest()


def push_to_firestore(opportunities: list[dict]) -> None:
    """
    Upserts each opportunity into the global_opportunities Firestore collection.
    Uses a deterministic document ID to prevent duplicates across runs.
    """
    db = get_db()
    collection_ref = db.collection("global_opportunities")
    
    added = 0
    skipped = 0

    for opp in opportunities:
        company = opp.get("companyName", "")
        role = opp.get("role", "")

        if not company or not role:
            skipped += 1
            continue

        doc_id = make_doc_id(company, role)
        doc_ref = collection_ref.document(doc_id)
        
        # Use set() with merge=True to update only changed fields
        doc_ref.set(opp, merge=True)
        added += 1

    print(f"\n✅ Pushed {added} opportunities to Firestore (skipped {skipped} incomplete).")


def run_all_scrapers():
    print("=" * 50)
    print("🚀 InternRadar Scraper Starting...")
    print("=" * 50)

    all_opportunities = []

    print("\n📦 Scraping Greenhouse boards...")
    try:
        greenhouse_results = scrape_greenhouse_internships()
        all_opportunities.extend(greenhouse_results)
    except Exception as e:
        print(f"[ERROR] Greenhouse scraper failed: {e}")

    print("\n📦 Scraping Internshala...")
    try:
        internshala_results = scrape_internshala_internships()
        all_opportunities.extend(internshala_results)
    except Exception as e:
        print(f"[ERROR] Internshala scraper failed: {e}")

    print("\n📦 Scraping Unstop...")
    try:
        unstop_results = scrape_unstop_internships()
        all_opportunities.extend(unstop_results)
    except Exception as e:
        print(f"[ERROR] Unstop scraper failed: {e}")

    print(f"\n📊 Total collected: {len(all_opportunities)} opportunities.")

    if all_opportunities:
        print("\n🔥 Pushing to Firestore (global_opportunities)...")
        push_to_firestore(all_opportunities)
    else:
        print("\n⚠️  No opportunities collected. Check scraper logs above.")

    print("\n✔️  Scraper run complete.")


if __name__ == "__main__":
    run_all_scrapers()
