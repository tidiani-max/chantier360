from django.urls import path
from . import views

urlpatterns = [
    path('', views.contract_list, name='contract-list'),
    path('upload-stream/', views.contract_upload_stream, name='contract-upload-stream'),
    path('<uuid:pk>/', views.contract_detail, name='contract-detail'),
    path('<uuid:pk>/export-pdf/', views.contract_export_pdf, name='contract-export-pdf'),
]
