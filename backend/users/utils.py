import random
import string
from django.utils import timezone
from datetime import timedelta
from django.conf import settings
from django.core.mail import send_mail
from .models import OTP


def generate_otp_code():
    return ''.join(random.choices(string.digits, k=6))


def create_otp(user, otp_type):
    # Invalider les anciens OTP du même type
    OTP.objects.filter(user=user, otp_type=otp_type, is_used=False).update(is_used=True)
    
    code = generate_otp_code()
    expires_at = timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)
    
    otp = OTP.objects.create(
        user=user,
        code=code,
        otp_type=otp_type,
        expires_at=expires_at
    )
    return otp


def verify_otp(user, code, otp_type):
    try:
        otp = OTP.objects.get(
            user=user,
            code=code,
            otp_type=otp_type,
            is_used=False
        )
        if timezone.now() > otp.expires_at:
            return False, "Code OTP expiré. Veuillez en demander un nouveau."
        
        otp.is_used = True
        otp.save()
        return True, "OTP valide"
    except OTP.DoesNotExist:
        return False, "Code OTP invalide."


def send_otp_email(user, otp_code, otp_type):
    if otp_type == 'verify_email':
        subject = 'Chantier360 - Vérification de votre email'
        message = f"""
Bonjour {user.full_name},

Bienvenue sur Chantier360 !

Votre code de vérification est : {otp_code}

Ce code expire dans {settings.OTP_EXPIRY_MINUTES} minutes.

Si vous n'avez pas créé de compte, ignorez cet email.

L'équipe Chantier360
        """
    else:
        subject = 'Chantier360 - Réinitialisation de mot de passe'
        message = f"""
Bonjour {user.full_name},

Vous avez demandé à réinitialiser votre mot de passe.

Votre code de réinitialisation est : {otp_code}

Ce code expire dans {settings.OTP_EXPIRY_MINUTES} minutes.

Si vous n'avez pas fait cette demande, ignorez cet email.

L'équipe Chantier360
        """
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        return True
    except Exception as e:
        print(f"Erreur envoi email: {e}")
        return False
