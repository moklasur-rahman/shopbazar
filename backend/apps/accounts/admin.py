from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Address, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ["-date_joined"]
    list_display = ["phone", "full_name", "role", "is_phone_verified", "is_active", "date_joined"]
    list_filter = ["role", "is_active", "is_phone_verified", "is_staff"]
    search_fields = ["phone", "full_name", "email"]

    fieldsets = (
        (None, {"fields": ("phone", "password")}),
        ("পরিচয়", {"fields": ("full_name", "email", "avatar", "role")}),
        ("অনুমতি", {"fields": ("is_active", "is_phone_verified", "is_staff",
                                "is_superuser", "groups", "user_permissions")}),
        ("সময়", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("phone", "full_name", "role", "password1", "password2"),
        }),
    )


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ["receiver_name", "phone", "district", "user", "is_default"]
    list_filter = ["division", "district", "is_default"]
    search_fields = ["receiver_name", "phone", "address_line"]
