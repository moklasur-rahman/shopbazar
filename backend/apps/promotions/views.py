from drf_spectacular.utils import OpenApiResponse, extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Coupon
from .serializers import CouponSerializer


@extend_schema(
    tags=["checkout"],
    summary="কুপন যাচাই",
    description="কোডটি আছে কি না, মেয়াদ আছে কি না, সীমা শেষ হয়নি তো — দেখে নেয়।",
    request=inline_serializer(
        name="CouponValidateRequest", fields={"code": serializers.CharField()}
    ),
    responses={
        200: CouponSerializer,
        400: OpenApiResponse(description="মেয়াদ শেষ বা সীমা শেষ"),
        404: OpenApiResponse(description="এই কোডটি নেই"),
    },
)
class ValidateCouponView(APIView):
    """POST /promotions/coupons/validate/  {code}"""

    permission_classes = [AllowAny]

    def post(self, request):
        code = str(request.data.get("code", "")).strip()
        if not code:
            return Response(
                {"detail": "কুপন কোড লিখুন।"}, status=status.HTTP_400_BAD_REQUEST
            )

        coupon = Coupon.objects.filter(code__iexact=code).first()
        if coupon is None:
            return Response(
                {"detail": "এই কুপন কোডটি সঠিক নয়।"}, status=status.HTTP_404_NOT_FOUND
            )

        problem = coupon.check_usable()
        if problem:
            return Response({"detail": problem}, status=status.HTTP_400_BAD_REQUEST)

        return Response(CouponSerializer(coupon).data)
