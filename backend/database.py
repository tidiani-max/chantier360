import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

# Load environment variables if running locally
load_dotenv()

def get_db():
    """
    Connects to the PostgreSQL database using the DATABASE_URL 
    provided by Railway or your local .env file.
    """
    db_url = os.getenv("DATABASE_URL")
    
    if not db_url:
        raise ValueError("❌ DATABASE_URL is not set. Check your Railway variables or .env file.")

    # Connect to Postgres
    conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
    return conn

def init_db():
    """
    Initializes the PostgreSQL database schema.
    Uses 'SERIAL' for auto-incrementing IDs and 'TIMESTAMP' for dates.
    """
    conn = get_db()
    c = conn.cursor()

    try:
        # 1. Entreprises (tenants)
        c.execute('''CREATE TABLE IF NOT EXISTS entreprises (
            id SERIAL PRIMARY KEY,
            nom TEXT NOT NULL,
            email_admin TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''')

        # 2. Utilisateurs
        c.execute('''CREATE TABLE IF NOT EXISTS utilisateurs (
            id SERIAL PRIMARY KEY,
            entreprise_id INTEGER NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
            nom_complet TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT,
            google_id TEXT,
            role TEXT DEFAULT 'admin',
            est_verifie INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''')

        # 3. OTP tokens
        c.execute('''CREATE TABLE IF NOT EXISTS otp_tokens (
            id SERIAL PRIMARY KEY,
            email TEXT NOT NULL,
            code TEXT NOT NULL,
            type TEXT NOT NULL,
            expire_at TIMESTAMP NOT NULL,
            utilise INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''')

        # 4. Projets / Chantiers
        c.execute('''CREATE TABLE IF NOT EXISTS projets (
            id SERIAL PRIMARY KEY,
            entreprise_id INTEGER NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
            cree_par INTEGER NOT NULL REFERENCES utilisateurs(id),
            nom TEXT NOT NULL,
            description TEXT,
            localisation TEXT,
            type_travaux TEXT,
            statut TEXT DEFAULT 'en_cours',
            date_debut DATE,
            date_fin_prevue DATE,
            budget DOUBLE PRECISION,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''')

        # 5. Contrats uploadés
        c.execute('''CREATE TABLE IF NOT EXISTS contrats (
            id SERIAL PRIMARY KEY,
            projet_id INTEGER REFERENCES projets(id) ON DELETE SET NULL,
            entreprise_id INTEGER NOT NULL REFERENCES entreprises(id) ON DELETE CASCADE,
            uploaded_par INTEGER NOT NULL REFERENCES utilisateurs(id),
            nom_fichier TEXT NOT NULL,
            chemin_fichier TEXT NOT NULL,
            type_fichier TEXT NOT NULL,
            resume_json TEXT,
            resume_genere INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )''')

        conn.commit()
        print("✅ Base de données PostgreSQL initialisée avec succès")

    except Exception as e:
        print(f"❌ Erreur lors de l'initialisation : {e}")
        conn.rollback()
    finally:
        c.close()
        conn.close()

if __name__ == '__main__':
    init_db()