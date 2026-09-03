from django.db import models


class TimeStamped(models.Model):
    """সব মডেলে তৈরি ও হালনাগাদের সময় থাকুক — ডিবাগে অসম্ভব কাজে লাগে।"""

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ImageOrUrlMixin(models.Model):
    """
    ছবি হয় আপলোড করা ফাইল, নয় বাইরের একটা URL।

    কেন দুটোই? সিড ডেটা বসানোর সময় হাজারটা ছবি ডাউনলোড করা অর্থহীন —
    তখন URL রাখলেই চলে। আসল ব্যবহারকারী আপলোড করলে ফাইলটাই অগ্রাধিকার পায়।
    """

    image = models.ImageField(upload_to="uploads/", blank=True, null=True)
    image_url = models.URLField(blank=True, max_length=500)

    class Meta:
        abstract = True

    @property
    def display_url(self):
        if self.image:
            return self.image.url
        return self.image_url or None
