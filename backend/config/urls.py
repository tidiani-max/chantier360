# backend/config/urls.py
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.utils import timezone


def health_check(request):
    """Railway health check endpoint."""
    return JsonResponse({
        'status': 'ok',
        'timestamp': timezone.now().isoformat(),
        'service': 'BTP Manager API',
        'version': '2.0',
    })


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health-check'),
    path('api/auth/',      include('users.urls')),
    path('api/projects/',  include('projects.urls')),
    path('api/contracts/', include('contracts.urls')),
    path('api/companies/', include('users.company_urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)