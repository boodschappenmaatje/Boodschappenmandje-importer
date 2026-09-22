-- Water-only meals are valid only with explicit reviewed source evidence.
-- Keep the existing identity/servings checks; no product or price writes.
alter table public.meal_mix_profiles drop constraint meal_mix_profiles_check;
alter table public.meal_mix_profiles add constraint meal_mix_profiles_check check (
  status <> 'verified' or (
    recipe_id is not null and profile is not null and jsonb_typeof(profile) = 'object'
    and profile->>'verificationStatus' = 'verified'
    and profile->>'productId' = product_id::text
    and (profile->>'servingsPerPackage')::numeric between 1 and 12
    and jsonb_typeof(profile->'supplements') = 'array'
    and (jsonb_array_length(profile->'supplements') > 0 or (
      profile->'waterOnly' = 'true'::jsonb and source_evidence is not null and source_fingerprint is not null
    ))
  )
);
