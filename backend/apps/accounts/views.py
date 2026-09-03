from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView

from .models import Address
from .serializers import (
    AddressSerializer, LoginSerializer, RegisterSerializer, UserSerializer, tokens_for,
)

#: লগইন ও রেজিস্ট্রেশন দুটোই একই আকারে উত্তর দেয়
AUTH_RESPONSE = inline_serializer(
    name="AuthResponse",
    fields={
        "access": serializers.CharField(),
        "refresh": serializers.CharField(),
        "user": UserSerializer(),
    },
)


@extend_schema(
    tags=["auth"],
    summary="লগইন",
    description="মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে JWT টোকেন নিন।",
    request=LoginSerializer,
    responses={
        200: AUTH_RESPONSE,
        400: OpenApiResponse(description="নম্বর বা পাসওয়ার্ড ভুল"),
    },
)
class LoginView(APIView):
    """POST /auth/token/  →  {access, refresh, user}"""

    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        return Response({**tokens_for(user), "user": UserSerializer(user).data})


@extend_schema(
    tags=["auth"],
    summary="রেজিস্ট্রেশন",
    description=(
        "ক্রেতা বা বিক্রেতা হিসেবে অ্যাকাউন্ট খুলুন।\n\n"
        "`role=\"vendor\"` দিলে `shop_name` বাধ্যতামূলক, আর দোকানটি "
        "`pending` অবস্থায় তৈরি হয় — অ্যাডমিন অনুমোদন না দেওয়া পর্যন্ত "
        "ভেন্ডর প্যানেলের এন্ডপয়েন্টগুলো ৪০৩ দেবে।"
    ),
    request=RegisterSerializer,
    responses={201: AUTH_RESPONSE, 400: OpenApiResponse(description="ইনপুট ভুল")},
)
class RegisterView(APIView):
    """POST /auth/register/  →  {access, refresh, user}"""

    permission_classes = [AllowAny]
    throttle_scope = "auth"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {**tokens_for(user), "user": UserSerializer(user).data},
            status=status.HTTP_201_CREATED,
        )


@extend_schema(
    tags=["auth"],
    summary="নিজের প্রোফাইল",
    responses={200: UserSerializer},
)
class MeView(APIView):
    """GET /auth/me/ — পেজ রিলোডের পর সেশন ফেরানোর জন্য।"""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


@extend_schema(
    tags=["auth"],
    summary="OTP যাচাই",
    request=None,
    responses={200: OpenApiResponse(description="নম্বরটি যাচাই করা হয়েছে")},
)
class VerifyOtpView(APIView):
    """
    POST /auth/otp/verify/

    এখনো আসল SMS গেটওয়ে যুক্ত করা হয়নি, তাই এটি নম্বরটিকে যাচাই-করা হিসেবে
    চিহ্নিত করে রাখে। Bulk SMS / SSLWireless যোগ করলে এখানে আসল কোড মেলানো হবে।
    """

    permission_classes = [IsAuthenticated]
    throttle_scope = "auth"

    def post(self, request):
        request.user.is_phone_verified = True
        request.user.save(update_fields=["is_phone_verified"])
        return Response({"verified": True, "detail": "নম্বরটি যাচাই করা হয়েছে।"})


class AddressViewSet(viewsets.ModelViewSet):
    serializer_class = AddressSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        # সবসময় নিজের ঠিকানা — URL থেকে আসা কোনো আইডি বিশ্বাস করা হয় না
        return Address.objects.filter(user=self.request.user)


class RefreshView(TokenRefreshView):
    throttle_scope = "auth"
