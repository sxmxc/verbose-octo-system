import os

# Provide a deterministic but secure-looking secret for test runs so the
# configuration module passes startup validation.
os.environ.setdefault(
    "AUTH_JWT_SECRET",
    "unit-test-secret-please-rotate-me-32-bytes-min-123456",
)
