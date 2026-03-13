"""
Scraper for Internshala — India's most popular internship platform.
Uses HTML scraping (no official API available).
Note: Internshala may occasionally block scrapers. If blocked, run with a VPN or use dummy headers.
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime
import time

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
}

PAGES = [
    ("https://internshala.com/internships/computer-science-internship", ["cs", "tech"]),
    ("https://internshala.com/internships/mechanical-engineering-internship", ["mechanical", "engineering"]),
    ("https://internshala.com/internships/civil-engineering-internship", ["civil", "engineering"]),
    ("https://internshala.com/internships/data-science-internship", ["cs", "tech", "data"]),
]


def scrape_internshala_internships() -> list[dict]:
    """Scrapes Internshala listing pages by domain."""
    opportunities = []

    for url, domain_tags in PAGES:
        try:
            print(f"[Internshala] Fetching: {url}")
            response = requests.get(url, headers=HEADERS, timeout=15)
            response.raise_for_status()

            soup = BeautifulSoup(response.text, "lxml")
            cards = soup.select(".internship_meta") or soup.select(".individual_internship")

            print(f"[Internshala] Found {len(cards)} cards on page.")

            for card in cards[:10]:  # Up to 10 per page
                try:
                    title_el = card.select_one(".profile") or card.select_one("h3")
                    company_el = card.select_one(".company_name") or card.select_one(".company")
                    link_el = card.select_one("a[href]")
                    deadline_el = card.select_one(".apply_by") or card.select_one(".deadline")
                    stipend_el = card.select_one(".stipend")

                    title = title_el.get_text(strip=True) if title_el else None
                    company = company_el.get_text(strip=True) if company_el else None
                    deadline_text = deadline_el.get_text(strip=True) if deadline_el else None
                    apply_link = "https://internshala.com" + link_el["href"] if link_el and link_el.get("href", "").startswith("/") else None

                    if title and company:
                        opp = {
                            "companyName": company,
                            "role": title,
                            "deadline": deadline_text,
                            "eligibility": [],
                            "applicationLink": apply_link or "",
                            "domainTags": domain_tags,
                            "source": "internshala",
                            "scrapedAt": datetime.utcnow().isoformat()
                        }
                        if stipend_el:
                            opp["stipend"] = stipend_el.get_text(strip=True)
                        opportunities.append(opp)

                except Exception as e:
                    print(f"[Internshala] Card parse error: {e}")
                    continue

            # Polite delay between pages to avoid rate limiting
            time.sleep(2)

        except requests.RequestException as e:
            print(f"[Internshala] Failed to fetch {url}: {e}")
            continue

    print(f"[Internshala] Total: {len(opportunities)} opportunities collected.")
    return opportunities
