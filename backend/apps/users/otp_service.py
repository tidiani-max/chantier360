import random
import string
from django.utils import timezone
from datetime import timedelta
from django.core.mail import send_mail
from django.conf import settings
from .models import OTPCode
import logging

logger = logging.getLogger(__name__)


def generate_otp_code():
    """Generate a 6-digit OTP code"""
    return ''.join(random.choices(string.digits, k=6))


def create_otp(email: str, otp_type: str) -> OTPCode:
    """Create a new OTP code, invalidating any previous ones"""
    # Invalidate previous OTPs of same type for this email
    OTPCode.objects.filter(
        email=email,
        otp_type=otp_type,
        is_used=False
    ).update(is_used=True)

    code = generate_otp_code()
    expires_at = timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

    otp = OTPCode.objects.create(
        email=email,
        code=code,
        otp_type=otp_type,
        expires_at=expires_at,
    )
    return otp


def send_otp_email(email: str, code: str, otp_type: str) -> bool:
    """Send OTP code via email"""
    if otp_type == OTPCode.OTP_TYPE_VERIFY:
        subject = "Chantier360 – Vérification de votre compte"
        message = f"""
Bonjour,

Votre code de vérification Chantier360 est :

    {code}

Ce code expire dans {settings.OTP_EXPIRY_MINUTES} minutes.

Si vous n'avez pas créé de compte sur Chantier360, ignorez cet email.

— L'équipe Chantier360
        """
    else:
        subject = "Chantier360 – Réinitialisation de mot de passe"
        message = f"""
Bonjour,

Vous avez demandé à réinitialiser votre mot de passe Chantier360.

Votre code de réinitialisation est :

    {code}

Ce code expire dans {settings.OTP_EXPIRY_MINUTES} minutes.

Si vous n'avez pas fait cette demande, ignorez cet email.

— L'équipe Chantier360
        """

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email to {email}: {e}")
        return False


def verify_otp(email: str, code: str, otp_type: str) -> tuple[bool, str]:
    """
    Verify an OTP code.
    Returns (success, message)
    """
    try:
        otp = OTPCode.objects.filter(
            email=email,
            code=code,
            otp_type=otp_type,
            is_used=False,
        ).latest('created_at')
    except OTPCode.DoesNotExist:
        return False, "Code invalide."

    if otp.is_expired:
        return False, "Code expiré. Veuillez en demander un nouveau."

    otp.is_used = True
    otp.save()
    return True, "Code vérifié avec succès."
