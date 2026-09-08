from rest_framework import serializers

from .models import PaymentTransaction


class PaymentTransactionSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = PaymentTransaction
        fields = [
            "id", "tran_id", "order_number", "gateway", "status", "status_label",
            "amount", "currency", "card_type", "bank_tran_id",
            "error_reason", "paid_at", "created_at",
        ]
        read_only_fields = fields


class StartPaymentSerializer(serializers.Serializer):
    order_number = serializers.CharField(max_length=20)
