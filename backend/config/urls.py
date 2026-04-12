# backend/config/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.utils import timezone
from django.shortcuts import redirect  # Added for the root redirect

def health_check(request):
    """Railway health check endpoint."""
    return JsonResponse({
        'status': 'ok',
        'timestamp': timezone.now().isoformat(),
        'service': 'BTP Manager API',
        'version': '2.0',
    })

urlpatterns = [
    # Redirect empty root URL to /admin/
    path('', lambda request: redirect('admin/', permanent=False)),
    
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health-check'),
    
    # API Endpoints
    path('api/auth/',      include('users.urls')),
    path('api/projects/',  include('projects.urls')),
    path('api/contracts/', include('contracts.urls')),
    path('api/companies/', include('users.company_urls')),
] 

# Serve media files during development/production (with WhiteNoise/Cloud storage)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # On Railway, static/media is handled by WhiteNoise, but this ensures 
    # the patterns are recognized.
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)