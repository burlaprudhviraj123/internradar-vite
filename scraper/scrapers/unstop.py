"""
Scraper for Unstop (formerly Dare2Compete) — Internship listings
Unstop is highly crawlable and hosts thousands of Indian internship + hackathon listings.
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


def scrape_unstop_internships() -> list[dict]:
    """Scrapes the Unstop internship listing page and returns structured opportunity dicts."""
    opportunities = []
    url = "https://unstop.com/internships"

    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "lxml")

        # Unstop renders mostly server-side, so cards are accessible in raw HTML
        cards = soup.find_all("div", class_=lambda c: c and "opportunity-card" in c.lower())

        if not cards:
            # Try alternate class pattern
            cards = soup.find_all("li", attrs={"data-type": True})

        print(f"[Unstop] Found {len(cards)} raw opportunity cards.")

        for card in cards[:30]:  # Limit to 30 per run to avoid rate limiting
            try:
                title_el = card.find(["h2", "h3", "span"], class_=lambda c: c and "title" in str(c).lower())
                company_el = card.find(["span", "p"], class_=lambda c: c and ("org" in str(c).lower() or "company" in str(c).lower()))
                link_el = card.find("a", href=True)
                deadline_el = card.find(["span", "p"], class_=lambda c: c and "deadline" in str(c).lower())

                title = title_el.get_text(strip=True) if title_el else None
                company = company_el.get_text(strip=True) if company_el else None
                apply_link = "https://unstop.com" + link_el["href"] if link_el and link_el["href"].startswith("/") else (link_el["href"] if link_el else None)
                deadline_text = deadline_el.get_text(strip=True) if deadline_el else None

                if title and company:
                    opportunities.append({
                        "companyName": company,
                        "role": title,
                        "deadline": deadline_text,
                        "eligibility": [],
                        "applicationLink": apply_link or "",
                        "domainTags": ["cs", "tech", "engineering"],
                        "source": "unstop",
                        "scrapedAt": datetime.utcnow().isoformat()
                    })
            except Exception as e:
                print(f"[Unstop] Error parsing card: {e}")
                continue

    except requests.RequestException as e:
        print(f"[Unstop] Failed to fetch page: {e}")

    print(f"[Unstop] Parsed {len(opportunities)} valid opportunities.")
    return opportunities
