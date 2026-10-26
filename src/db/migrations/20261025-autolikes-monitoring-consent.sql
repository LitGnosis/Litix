-- AutoLikes-only additive consent evidence. No existing consent is inferred.
ALTER TABLE litix_autolikes_enrollment_attempts
  ADD COLUMN IF NOT EXISTS monitoring_consent_at timestamptz;
