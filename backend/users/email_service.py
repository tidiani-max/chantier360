from django.core.mail import send_mail
from django.conf import settings


def send_otp_email(user_email, user_name, otp_code, purpose):
    if purpose == 'verify':
        subject = "Chantier360 — Vérification de votre compte"
        message = f"""
Bonjour {user_name},

Bienvenue sur Chantier360 !

Votre code de vérification est : {otp_code}

Ce code expire dans 10 minutes.

Si vous n'avez pas créé de compte, ignorez cet email.

L'équipe Chantier360
        """
        html_message = f"""
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1A1A2E; color: #fff; padding: 40px; border-radius: 12px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #F59E0B; font-size: 28px; margin: 0;">Chantier360</h1>
        <p style="color: #9CA3AF; margin: 5px 0;">Plateforme de gestion BTP</p>
    </div>
    <h2 style="color: #fff; font-size: 20px;">Vérification de votre compte</h2>
    <p style="color: #D1D5DB;">Bonjour <strong>{user_name}</strong>,</p>
    <p style="color: #D1D5DB;">Votre code de vérification est :</p>
    <div style="background: #F59E0B; color: #1A1A2E; font-size: 36px; font-weight: bold; text-align: center; padding: 20px; border-radius: 8px; letter-spacing: 8px; margin: 20px 0;">
        {otp_code}
    </div>
    <p style="color: #9CA3AF; font-size: 14px;">Ce code expire dans <strong style="color: #F59E0B;">10 minutes</strong>.</p>
    <p style="color: #6B7280; font-size: 12px;">Si vous n'avez pas créé de compte sur Chantier360, ignorez cet email.</p>
</div>
        """
    else:
        subject = "Chantier360 — Réinitialisation de mot de passe"
        message = f"""
Bonjour {user_name},

Votre code de réinitialisation de mot de passe est : {otp_code}

Ce code expire dans 10 minutes.

Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.

L'équipe Chantier360
        """
        html_message = f"""
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #1A1A2E; color: #fff; padding: 40px; border-radius: 12px;">
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #F59E0B; font-size: 28px; margin: 0;">Chantier360</h1>
        <p style="color: #9CA3AF; margin: 5px 0;">Plateforme de gestion BTP</p>
    </div>
    <h2 style="color: #fff; font-size: 20px;">Réinitialisation de mot de passe</h2>
    <p style="color: #D1D5DB;">Bonjour <strong>{user_name}</strong>,</p>
    <p style="color: #D1D5DB;">Votre code de réinitialisation est :</p>
    <div style="background: #F59E0B; color: #1A1A2E; font-size: 36px; font-weight: bold; text-align: center; padding: 20px; border-radius: 8px; letter-spacing: 8px; margin: 20px 0;">
        {otp_code}
    </div>
    <p style="color: #9CA3AF; font-size: 14px;">Ce code expire dans <strong style="color: #F59E0B;">10 minutes</strong>.</p>
    <p style="color: #6B7280; font-size: 12px;">Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
</div>
        """

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user_email],
            html_message=html_message,
            fail_silently=False,
        )
        return True
    except Exception as e:
        print(f"Erreur envoi email: {e}")
        return False
