import os
from google.cloud import firestore
from dotenv import load_dotenv

load_dotenv()

# Define a credencial para o ambiente (local ou cloud)
if os.path.exists("atividades-intel-9cdabf39cef6.json"):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "atividades-intel-9cdabf39cef6.json"

def get_db():
    """Retorna uma instância do cliente Firestore"""
    return firestore.Client()