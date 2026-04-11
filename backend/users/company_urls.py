# backend/users/company_urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('',          views.companies,      name='companies-list'),
    path('<uuid:company_id>/', views.company_detail, name='company-detail'),
]