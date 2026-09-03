from rest_framework import serializers

from .models import LedgerEntry, Payout


class LedgerEntrySerializer(serializers.ModelSerializer):
    """ফ্রন্টএন্ডের vendorPanelApi.ledger() ঠিক এই ফিল্ডগুলো পড়ে।"""

    order_number = serializers.CharField(read_only=True)
    released = serializers.BooleanField(source="is_released", read_only=True)

    class Meta:
        model = LedgerEntry
        fields = ["id", "kind", "amount", "order_number", "created_at", "released"]


class PayoutSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payout
        fields = ["id", "amount", "status", "method", "created_at", "paid_at"]
        read_only_fields = ["status", "method", "paid_at"]
