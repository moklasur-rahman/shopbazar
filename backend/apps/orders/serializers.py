from rest_framework import serializers

from apps.vendors.serializers import VendorSerializer
from common.serializers import absolute

from .models import Order, OrderItem, VendorOrder


class OrderItemSerializer(serializers.ModelSerializer):
    can_review = serializers.BooleanField(read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            "id", "product_title", "product_slug", "image", "options",
            "unit_price", "quantity", "can_review",
        ]

    def get_image(self, obj) -> str | None:
        return absolute(self.context.get("request"), obj.image)


class VendorOrderSerializer(serializers.ModelSerializer):
    """
    ক্রেতার অর্ডারের ভেতরের একটা পার্সেল, আবার ভেন্ডর প্যানেলে এটাই "অর্ডার"।

    order_number / shipping_address / created_at এখানে রাখা হয়েছে কারণ
    ভেন্ডর প্যানেল এগুলো দেখায় — সে মূল Order অবজেক্ট কখনো পায় না।
    """

    vendor = VendorSerializer(read_only=True)
    items = OrderItemSerializer(many=True, read_only=True)
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    shipping_address = serializers.JSONField(source="order.shipping_address", read_only=True)

    class Meta:
        model = VendorOrder
        fields = [
            "id", "sub_number", "order_number", "vendor", "status", "items",
            "subtotal", "discount", "shipping_fee", "commission_amount", "payable",
            "courier", "tracking_code", "shipping_address", "created_at", "updated_at",
        ]


class OrderSerializer(serializers.ModelSerializer):
    vendor_orders = VendorOrderSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            "order_number", "created_at", "payment_method", "payment_status",
            "shipping_address", "items_total", "shipping_total", "discount_total",
            "grand_total", "vendor_orders",
        ]


# ------------------------------------------------------ ইনপুট সিরিয়ালাইজার


class CartItemInputSerializer(serializers.Serializer):
    variant = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1)


class ShippingAddressSerializer(serializers.Serializer):
    """
    ফ্রন্টএন্ড ঠিক এই কী-গুলোই পাঠায় (src/api/services.js → ordersApi.create)।
    পুরো অবজেক্টটা Order.shipping_address-এ JSON হিসেবে জমা হয়।
    """

    receiver_name = serializers.CharField(max_length=120)
    phone = serializers.CharField(max_length=14)
    division = serializers.CharField(max_length=40)
    district = serializers.CharField(max_length=40)
    thana = serializers.CharField(max_length=60)
    address_line = serializers.CharField()
    note = serializers.CharField(required=False, allow_blank=True, default="")


class QuoteInputSerializer(serializers.Serializer):
    items = CartItemInputSerializer(many=True)
    district = serializers.CharField(required=False, allow_blank=True, default="")
    coupon_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class OrderCreateSerializer(serializers.Serializer):
    items = CartItemInputSerializer(many=True)
    shipping_address = ShippingAddressSerializer()
    payment_method = serializers.ChoiceField(
        choices=[m[0] for m in Order.PAYMENT_METHODS], default="cod"
    )
    coupon_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class StatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=VendorOrder.Status.choices)
