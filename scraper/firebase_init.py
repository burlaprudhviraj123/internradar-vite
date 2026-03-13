"""
Firebase Admin SDK initializer for the scraper service.
Uses a Service Account key (NOT the browser SDK) so it can write to Firestore securely.
"""

import os
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

load_dotenv()

_db = None

def get_db():
    global _db
    if _db is not None:
        return _db

    service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "./service-account.json")
    project_id = os.getenv("FIREBASE_PROJECT_ID")

    if not os.path.exists(service_account_path):
        raise FileNotFoundError(
            f"Firebase service account key not found at: {service_account_path}\n"
            "Download it from: Firebase Console → Project Settings → Service Accounts → Generate New Private Key\n"
            "Then save it as scraper/service-account.json"
        )

    cred = credentials.Certificate(service_account_path)
    
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred, {"projectId": project_id})

    _db = firestore.client()
    return _db
