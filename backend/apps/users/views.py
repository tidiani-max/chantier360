from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.conf import settings
import requests as http_requests

from .models import User, Company, OTPCode
from .serializers import (
    RegisterSerializer, LoginSerializer, UserSerializer,
    VerifyOTPSerializer, SendOTPSerializer, ResetPasswordSerializer,
    GoogleAuthSerializer
)
from .otp_service import create_otp, send_otp_email, verify_otp


def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            # Create and send OTP
            otp = create_otp(user.email, OTPCode.OTP_TYPE_VERIFY)
            email_sent = send_otp_email(user.email, otp.code, OTPCode.OTP_TYPE_VERIFY)

            return Response({
                'message': f'Compte créé avec succès. Un code de vérification a été envoyé à {user.email}.',
                'email': user.email,
                'email_sent': email_sent,
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            code = serializer.validated_data['code']

            success, message = verify_otp(email, code, OTPCode.OTP_TYPE_VERIFY)
            if success:
                try:
                    user = User.objects.get(email=email)
                    user.is_verified = True
                    user.save()
                    tokens = get_tokens_for_user(user)
                    return Response({
                        'message': 'Email vérifié avec succès. Bienvenue sur Chantier360 !',
                        'user': UserSerializer(user).data,
                        'tokens': tokens,
                    })
                except User.DoesNotExist:
                    return Response({'error': 'Utilisateur introuvable.'}, status=404)
            return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ResendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SendOTPSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            try:
                user = User.objects.get(email=email)
                if user.is_verified:
                    return Response({'error': 'Cet email est déjà vérifié.'}, status=400)
                otp = create_otp(email, OTPCode.OTP_TYPE_VERIFY)
                send_otp_email(email, otp.code, OTPCode.OTP_TYPE_VERIFY)
                return Response({'message': f'Code renvoyé à {email}.'})
            except User.DoesNotExist:
                return Response({'error': 'Utilisateur introuvable.'}, status=404)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            password = serializer.validated_data['password']

            user = authenticate(request, email=email, password=password)
            if user is None:
                return Response(
                    {'error': 'Email ou mot de passe incorrect.'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            if not user.is_verified:
                # Resend OTP
                otp = create_otp(email, OTPCode.OTP_TYPE_VERIFY)
                send_otp_email(email, otp.code, OTPCode.OTP_TYPE_VERIFY)
                return Response({
                    'error': 'Compte non vérifié.',
                    'requires_verification': True,
                    'email': email,
                    'message': 'Un nouveau code de vérification a été envoyé à votre email.',
                }, status=status.HTTP_403_FORBIDDEN)

            tokens = get_tokens_for_user(user)
            return Response({
                'message': 'Connexion réussie.',
                'user': UserSerializer(user).data,
                'tokens': tokens,
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SendOTPSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            try:
                user = User.objects.get(email=email)
                if user.auth_provider != User.AUTH_PROVIDER_EMAIL:
                    return Response({
                        'error': 'Ce compte utilise Google. Réinitialisez votre mot de passe via Google.'
                    }, status=400)
                otp = create_otp(email, OTPCode.OTP_TYPE_RESET)
                send_otp_email(email, otp.code, OTPCode.OTP_TYPE_RESET)
                return Response({'message': f'Code de réinitialisation envoyé à {email}.'})
            except User.DoesNotExist:
                # Security: don't reveal if email exists
                return Response({'message': f'Si cet email existe, un code a été envoyé.'})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            code = serializer.validated_data['code']
            new_password = serializer.validated_data['new_password']

            success, message = verify_otp(email, code, OTPCode.OTP_TYPE_RESET)
            if success:
                try:
                    user = User.objects.get(email=email)
                    user.set_password(new_password)
                    user.save()
                    return Response({'message': 'Mot de passe réinitialisé avec succès.'})
                except User.DoesNotExist:
                    return Response({'error': 'Utilisateur introuvable.'}, status=404)
            return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class GoogleAuthView(APIView):
    """Handle Google OAuth token verification"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = GoogleAuthSerializer(data=request.data)
        if serializer.is_valid():
            token = serializer.validated_data['token']
            company_name = serializer.validated_data.get('company_name', '')

            # Verify token with Google
            try:
                google_response = http_requests.get(
                    f'https://oauth2.googleapis.com/tokeninfo?id_token={token}',
                    timeout=10
                )
                if google_response.status_code != 200:
                    return Response({'error': 'Token Google invalide.'}, status=400)

                google_data = google_response.json()
                email = google_data.get('email', '').lower()
                full_name = google_data.get('name', '')
                google_client_id = google_data.get('aud', '')

                if google_client_id != settings.GOOGLE_CLIENT_ID:
                    return Response({'error': 'Token Google invalide.'}, status=400)

                if not email:
                    return Response({'error': 'Email non trouvé dans le token Google.'}, status=400)

                # Get or create user
                user, created = User.objects.get_or_create(
                    email=email,
                    defaults={
                        'full_name': full_name,
                        'auth_provider': User.AUTH_PROVIDER_GOOGLE,
                        'is_verified': True,
                    }
                )

                if created:
                    # New user - need company name
                    if not company_name:
                        return Response({
                            'requires_company': True,
                            'email': email,
                            'full_name': full_name,
                            'message': 'Veuillez renseigner le nom de votre entreprise.'
                        }, status=200)
                    company = Company.objects.create(name=company_name)
                    user.company = company
                    user.save()

                tokens = get_tokens_for_user(user)
                return Response({
                    'message': 'Connexion Google réussie.',
                    'user': UserSerializer(user).data,
                    'tokens': tokens,
                    'is_new_user': created,
                })

            except Exception as e:
                return Response({'error': f'Erreur authentification Google: {str(e)}'}, status=400)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        user = request.user
        allowed_fields = ['full_name']
        for field in allowed_fields:
            if field in request.data:
                setattr(user, field, request.data[field])
        user.save()
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
        except Exception:
            pass
        return Response({'message': 'Déconnecté avec succès.'})
