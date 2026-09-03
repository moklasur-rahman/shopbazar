#!/usr/bin/env python
"""Django-র কমান্ড চালানোর এন্ট্রি পয়েন্ট।"""
import os
import sys


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Django পাওয়া যায়নি। ভার্চুয়াল এনভায়রনমেন্ট চালু আছে তো? "
            "requirements.txt ইনস্টল করেছেন?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
