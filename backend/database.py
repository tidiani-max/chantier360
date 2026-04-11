import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'chantier360.db')

def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()

    # Entreprises (tenants)
    c.execute('''CREATE TABLE IF NOT EXISTS entreprises (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nom TEXT NOT NULL,
        email_admin TEXT UNIQUE NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    # Utilisateurs
    c.execute('''CREATE TABLE IF NOT EXISTS utilisateurs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entreprise_id INTEGER NOT NULL,
        nom_complet TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        google_id TEXT,
        role TEXT DEFAULT 'admin',
        est_verifie INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entreprise_id) REFERENCES entreprises(id)
    )''')

    # OTP tokens
    c.execute('''CREATE TABLE IF NOT EXISTS otp_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        type TEXT NOT NULL,
        expire_at TEXT NOT NULL,
        utilise INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')

    # Projets / Chantiers
    c.execute('''CREATE TABLE IF NOT EXISTS projets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entreprise_id INTEGER NOT NULL,
        cree_par INTEGER NOT NULL,
        nom TEXT NOT NULL,
        description TEXT,
        localisation TEXT,
        type_travaux TEXT,
        statut TEXT DEFAULT 'en_cours',
        date_debut TEXT,
        date_fin_prevue TEXT,
        budget REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (entreprise_id) REFERENCES entreprises(id),
        FOREIGN KEY (cree_par) REFERENCES utilisateurs(id)
    )''')

    # Contrats uploadés
    c.execute('''CREATE TABLE IF NOT EXISTS contrats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        projet_id INTEGER,
        entreprise_id INTEGER NOT NULL,
        uploaded_par INTEGER NOT NULL,
        nom_fichier TEXT NOT NULL,
        chemin_fichier TEXT NOT NULL,
        type_fichier TEXT NOT NULL,
        resume_json TEXT,
        resume_genere INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (projet_id) REFERENCES projets(id),
        FOREIGN KEY (entreprise_id) REFERENCES entreprises(id),
        FOREIGN KEY (uploaded_par) REFERENCES utilisateurs(id)
    )''')

    conn.commit()
    conn.close()
    print("✅ Base de données initialisée")

if __name__ == '__main__':
    init_db()
