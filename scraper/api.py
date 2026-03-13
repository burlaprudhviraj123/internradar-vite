"""
InternRadar Local Scraper API
A lightweight Flask server that fetches and strips any public job posting URL.
The React frontend calls this instead of trying to scrape from the browser (which is blocked by CORS/bots).

Usage:
    cd scraper
    python3 api.py

The API runs on http://localhost:5001
Endpoint: GET /scrape?url=https://...
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse

app = Flask(__name__)
# Open to all origins — required for Render deployment + Android HTTP calls
CORS(app)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
}

# Known legitimate internship/job platforms
TRUSTED_DOMAINS = {
    "boards.greenhouse.io", "greenhouse.io",
    "jobs.lever.co", "lever.co",
    "internshala.com",
    "unstop.com", "dare2compete.com",
    "linkedin.com", "www.linkedin.com",
    "careers.google.com",
    "amazon.jobs",
    "microsoft.com",
    "wellfound.com", "angel.co",
    "naukri.com", "campus.naukri.com",
    "workatastartup.com",
    "indeed.com",
    "glassdoor.com",
    "instahyre.com",
    "iimjobs.com",
    "drdo.gov.in",
    "isro.gov.in",
    "letsintern.com",
    "hackerearth.com",
    "devfolio.co",
    "fellowshipmlh.io", "fellowship.mlh.io",
    "workatastartup.com",
    "myworkdayjobs.com",
    "jobs.ashbyhq.com",
    "apply.workable.com",
}

# Known URL shorteners — usually suspicious in job postings
SHORTENER_DOMAINS = {
    "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly",
    "rb.gy", "buff.ly", "short.ly", "lnkd.in", "is.gd",
    "cutt.ly", "shorturl.at", "tiny.cc", "dl.dropbox.com",
    "forms.gle", "docs.google.com/forms"
}

@app.route("/validate")
def validate():
    url = request.args.get("url")
    if not url:
        return jsonify({"error": "Missing 'url' param"}), 400

    try:
        parsed = urlparse(url)
        original_domain = parsed.netloc.lower().lstrip("www.")
    except Exception:
        return jsonify({"trust": "suspicious", "reason": "Could not parse URL", "finalUrl": url})

    # Flag known URL shorteners immediately
    if any(original_domain == s or original_domain.endswith("." + s) for s in SHORTENER_DOMAINS):
        return jsonify({
            "trust": "suspicious",
            "reason": f"This looks like a URL shortener ({original_domain}). Shortened links in job postings are a common scam tactic.",
            "finalUrl": url
        })

    # Follow redirects to detect redirect-based scams
    try:
        resp = requests.head(url, headers=HEADERS, timeout=10, allow_redirects=True)
        final_url = resp.url
        final_domain = urlparse(final_url).netloc.lower().lstrip("www.")
        status_code = resp.status_code
    except requests.RequestException as e:
        return jsonify({
            "trust": "suspicious",
            "reason": f"Could not reach this URL ({str(e)}). It may be dead or a fake link.",
            "finalUrl": url
        })

    # Check if it redirected to a completely different domain (redirect scam)
    if original_domain and final_domain and original_domain != final_domain:
        if not any(final_domain == t or final_domain.endswith("." + t) for t in TRUSTED_DOMAINS):
            return jsonify({
                "trust": "suspicious",
                "reason": f"This URL redirects to '{final_domain}' which is not a recognized job platform. Could be a phishing link.",
                "finalUrl": final_url
            })

    # Check if final URL is a trusted domain
    is_trusted = any(final_domain == t or final_domain.endswith("." + t) for t in TRUSTED_DOMAINS)

    if is_trusted:
        return jsonify({"trust": "trusted", "reason": f"Verified platform: {final_domain}", "finalUrl": final_url})
    elif status_code == 200:
        return jsonify({"trust": "unknown", "reason": f"The link is accessible but '{final_domain}' is not in our verified platforms list. Proceed with care.", "finalUrl": final_url})
    else:
        return jsonify({"trust": "suspicious", "reason": f"Page returned HTTP {status_code}. The link may be broken or fake.", "finalUrl": final_url})


@app.route("/scrape")
def scrape():
    url = request.args.get("url")
    if not url:
        return jsonify({"error": "Missing 'url' query parameter"}), 400

    if not url.startswith("http"):
        return jsonify({"error": "URL must start with http:// or https://"}), 400

    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        response.raise_for_status()
    except requests.RequestException as e:
        return jsonify({"error": f"Failed to fetch URL: {str(e)}"}), 500

    soup = BeautifulSoup(response.text, "lxml")

    # Remove all non-content elements
    for tag in ["script", "style", "noscript", "nav", "footer", "header", "svg", "img", "iframe"]:
        for el in soup.find_all(tag):
            el.decompose()

    # Extract and compress clean text
    raw_text = soup.get_text(separator=" ")
    clean_text = " ".join(raw_text.split())  # collapse all whitespace

    # Limit to 6000 characters to stay within Groq context limits
    truncated = clean_text[:6000]

    return jsonify({
        "url": url,
        "text": truncated,
        "length": len(truncated),
    })


@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "InternRadar Scraper API"})



@app.route("/extract", methods=["POST"])
def extract():
    """Called by the Android app. Receives raw notification text and returns
    structured internship data by calling Groq AI."""
    data = request.get_json(force=True, silent=True) or {}
    message = data.get("message", "")
    link = data.get("link", "")
    source_app = data.get("sourceApp", "Unknown")

    if not message and not link:
        return jsonify({"error": "Provide 'message' or 'link'"}), 400

    # If a link is given, scrape it for content
    scraped_text = ""
    if link and link.startswith("http"):
        try:
            r = requests.get(link, headers=HEADERS, timeout=10)
            soup = BeautifulSoup(r.text, "lxml")
            for tag in ["script", "style", "nav", "footer"]:
                for el in soup.find_all(tag): el.decompose()
            scraped_text = " ".join(soup.get_text(separator=" ").split())[:4000]
        except Exception:
            pass

    combined = f"{message}\n\n{scraped_text}".strip()[:5000]

    # Call Groq AI
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key:
        return jsonify({"error": "GROQ_API_KEY not set on server"}), 500

    try:
        from groq import Groq
        import json
        import re
        
        client = Groq(api_key=groq_key)
        prompt = f"""Extract internship details from the text below. Return ONLY valid JSON:
{{
  "companyName": "string or null",
  "role": "string or null",
  "deadline": "YYYY-MM-DD or null",
  "eligibility": ["list of criteria"],
  "applicationLink": "URL or null",
  "stipend": "string or null",
  "isInternship": true/false
}}

Text:\n{combined}"""
        chat = client.chat.completions.create(
            model="llama3-70b-8192",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        raw = chat.choices[0].message.content.strip()
        print(f"RAW GROQ OUTPUT: {raw}", flush=True) # Send to Render logs
        
        # Robust JSON extraction using regex to find the first '{' and last '}'
        json_match = re.search(r'\{.*\}', raw, re.DOTALL)
        if json_match:
            raw_json = json_match.group(0)
        else:
            raw_json = raw
            
        parsed = json.loads(raw_json)
        parsed["sourceApp"] = source_app
        return jsonify(parsed)
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"EXTRACTION ERROR: {error_trace}", flush=True)
        return jsonify({"error": f"AI extraction failed: {str(e)}", "trace": error_trace}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    print("=" * 50)
    print("🕷️  InternRadar Scraper API")
    print(f"   Running on port: {port}")
    print("=" * 50)
    app.run(host="0.0.0.0", port=port, debug=False)
