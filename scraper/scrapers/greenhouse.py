"""
Scraper for companies using Greenhouse public job boards.
These are completely open APIs — no authentication required.
Many top companies (Figma, Notion, Stripe, etc.) expose their jobs through Greenhouse.
"""

import requests
from datetime import datetime

GREENHOUSE_COMPANIES = [
    {"slug": "figma", "domain_tags": ["cs", "tech", "design"]},
    {"slug": "notion", "domain_tags": ["cs", "tech"]},
    {"slug": "stripe", "domain_tags": ["cs", "tech"]},
    {"slug": "airbnb", "domain_tags": ["cs", "tech"]},
    {"slug": "dropbox", "domain_tags": ["cs", "tech"]},
    {"slug": "pinterest", "domain_tags": ["cs", "tech", "design"]},
    {"slug": "hubspot", "domain_tags": ["cs", "tech", "business"]},
    {"slug": "squarespace", "domain_tags": ["cs", "tech", "design"]},
]

HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
}


def scrape_greenhouse_internships() -> list[dict]:
    """
    Fetches internship listings from public Greenhouse API endpoints.
    The Greenhouse board API is completely public and doesn't require auth.
    """
    opportunities = []

    for company in GREENHOUSE_COMPANIES:
        slug = company["slug"]
        domain_tags = company["domain_tags"]
        api_url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"

        try:
            response = requests.get(api_url, headers=HEADERS, timeout=10)
            if response.status_code == 404:
                print(f"[Greenhouse] No board found for: {slug}")
                continue
            response.raise_for_status()

            data = response.json()
            jobs = data.get("jobs", [])

            internship_jobs = [j for j in jobs if "intern" in j.get("title", "").lower()]
            print(f"[Greenhouse:{slug}] Found {len(internship_jobs)} internship roles.")

            for job in internship_jobs[:5]:  # Max 5 per company
                title = job.get("title", "Unknown Role")
                company_name = slug.capitalize()
                apply_link = job.get("absolute_url", "")
                
                # Greenhouse provides metadata but not standardized deadlines
                # We extract location if available
                location = ""
                if job.get("location"):
                    location = job["location"].get("name", "")

                opportunities.append({
                    "companyName": company_name,
                    "role": title,
                    "deadline": None,
                    "eligibility": [location] if location else [],
                    "applicationLink": apply_link,
                    "domainTags": domain_tags,
                    "source": f"greenhouse:{slug}",
                    "scrapedAt": datetime.utcnow().isoformat()
                })

        except requests.RequestException as e:
            print(f"[Greenhouse:{slug}] Error: {e}")
            continue

    print(f"[Greenhouse] Total: {len(opportunities)} internship roles collected.")
    return opportunities
