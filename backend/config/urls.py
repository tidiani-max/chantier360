# backend/config/urls.py
import os
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.utils import timezone
from django.shortcuts import redirect

def health_check(request):
    """Railway health check endpoint."""
    return JsonResponse({
        'status': 'ok',
        'timestamp': timezone.now().isoformat(),
        'service': 'BTP Manager API',
        'version': '2.0',
    })

def redirect_to_frontend(request):
    """Redirects the root URL to the actual Frontend application."""
    # This looks for FRONTEND_URL in Railway variables. 
    # If not found, it defaults to your localhost:3000
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
    return redirect(frontend_url)

urlpatterns = [
    # Now the root URL goes to your Frontend!
    path('', redirect_to_frontend),
    
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health-check'),
    
    # API Endpoints
    path('api/auth/',      include('users.urls')),
    path('api/projects/',  include('projects.urls')),
    path('api/contracts/', include('contracts.urls')),
    path('api/companies/', include('users.company_urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)