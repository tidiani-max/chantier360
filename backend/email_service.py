import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'noreply@chantier360.com')
SMTP_HOST = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.environ.get('SMTP_PORT', '587'))
SMTP_USER = os.environ.get('SMTP_USER', '')
SMTP_PASS = os.environ.get('SMTP_PASS', '')

def send_otp_email(to_email: str, code: str, otp_type: str, nom: str = '') -> bool:
    """Send OTP email. Returns True on success."""

    if otp_type == 'verification':
        subject = "🔐 Vérification de votre compte Chantier360"
        action = "activer votre compte"
    else:
        subject = "🔑 Réinitialisation de mot de passe - Chantier360"
        action = "réinitialiser votre mot de passe"

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }}
            .container {{ max-width: 500px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }}
            .header {{ background: linear-gradient(135deg, #1A1A2E 0%, #16213E 100%); padding: 32px; text-align: center; }}
            .logo {{ color: #F59E0B; font-size: 24px; font-weight: 900; letter-spacing: 2px; }}
            .logo span {{ color: #fff; }}
            .body {{ padding: 40px 32px; }}
            h2 {{ color: #1A1A2E; margin-top: 0; }}
            .code-box {{ background: #F59E0B; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0; }}
            .code {{ font-size: 40px; font-weight: 900; color: #1A1A2E; letter-spacing: 8px; }}
            .expiry {{ color: #6B7280; font-size: 14px; text-align: center; margin-top: 8px; }}
            .footer {{ background: #f9f9f9; padding: 20px 32px; text-align: center; color: #9CA3AF; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo">CHANTIER<span>360</span></div>
                <p style="color:#9CA3AF; margin:8px 0 0; font-size:13px;">Plateforme de gestion BTP</p>
            </div>
            <div class="body">
                <h2>Bonjour{' ' + nom if nom else ''} 👋</h2>
                <p style="color:#4B5563;">Utilisez ce code pour {action} sur Chantier360.</p>
                <div class="code-box">
                    <div class="code">{code}</div>
                </div>
                <p class="expiry">⏱️ Ce code expire dans <strong>10 minutes</strong></p>
                <p style="color:#9CA3AF; font-size:13px; margin-top:24px;">
                    Si vous n'avez pas demandé ce code, ignorez cet email.
                </p>
            </div>
            <div class="footer">
                © 2026 Chantier360 · Plateforme SaaS BTP Mali
            </div>
        </div>
    </body>
    </html>
    """

    text = f"Votre code Chantier360 : {code}\nCe code expire dans 10 minutes."

    # If no SMTP configured, print to console (development mode)
    if not SMTP_USER or not SMTP_PASS:
        print(f"\n{'='*50}")
        print(f"📧 EMAIL OTP [DEV MODE]")
        print(f"   To: {to_email}")
        print(f"   Code: {code}")
        print(f"   Type: {otp_type}")
        print(f"{'='*50}\n")
        return True

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"Chantier360 <{SENDER_EMAIL}>"
        msg['To'] = to_email
        msg.attach(MIMEText(text, 'plain'))
        msg.attach(MIMEText(html, 'html'))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"❌ Email error: {e}")
        # Still print to console as fallback in dev
        print(f"📧 DEV FALLBACK - Code OTP pour {to_email}: {code}")
        return False
