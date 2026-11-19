# Draft plan: owner/admin-only property photo access (review only)

Scope: separate draft on top of commit d37c0be. Nothing in this plan has been applied. No production data, Storage objects, policies or published app are touched by this plan.

## 1. Verified current state (read-only)

Evidence: live catalog query (pg_policies, proacl) + source reads this turn.

Storage `storage.objects`, bucket `property-photos` (SELECT policies are OR-ed):
- "Admins can view all property photos" — admin sees all. OK.
- "Users can view own property photos" — folder[1] = auth.uid(). OK.
- **"Collaborators can view displayable property photos"** — `can_view_shared(auth.uid()) AND photo_is_public_listing(name)`. Any active user can read ANY `public_listing` photo of any owner. **This is the confirmed gap.**
- INSERT/UPDATE/DELETE limited to own folder + active user. OK.

Public schema:
- `properties` SELECT/UPDATE/DELETE: owner or admin; INSERT admin-only.
- `photo_visibility`: owner or admin on all commands.
- `shared_properties()` (SECURITY DEFINER, executable by authenticated) returns **every** property's shared fields plus public_listing photo paths to any active user.

Source call sites:
- Upload: `uploadPhotos` (src/lib/properties.ts:585) from PropertyForm (public_listing / private_ocr), batch-import.ts:260/290, bulk-queue.ts:72 (private_ocr). Path = `<uploaderId>/...`.
- Signing: `signedPhotoUrls` (properties.ts:605, user client → RLS applies); shares.functions.ts:147 and bulk-worker.server.ts:103 (server/admin client — bypass RLS).
- Attach: bulk-execute.functions.ts:98–164 adds source path to `private_photos` and sets `photo_visibility.property_id`.
- Delete: properties.ts:578–582. Cover: properties.ts:181–189, CoverSelector.tsx.
- Category default covers: bundled assets (src/assets/property-type-defaults, `default-covers.ts`), not in the bucket.
- No Edge Functions.

## 2. Conflicts to decide before implementing

1. `shared_properties()` and the collaborator listing screens intentionally show all listings (without private fields) to every collaborator. The new photo rule makes those listings appear photo-less (default cover). Is that intended, or should collaborators also stop seeing other owners' listings entirely?
2. Property ownership vs. uploader folder: properties can only be inserted by admin, so `properties.user_id` = admin. A collaborator therefore "owns" a property only if ownership is later reassigned. Define "owner" = `properties.user_id` (recommended) — confirm.
3. Public share links (`/share/$token`) sign public_listing photos with the server client for outside customers. Keep as-is (token-gated, admin/owner-created)? Recommended: keep.
4. Admin uploads land in the admin folder; after attaching to a collaborator-owned property the collaborator cannot read them under folder rules — the new policy must grant by property link, not folder.

## 3. Proposed design

Single rule for SELECT on `property-photos`:
```text
admin                                  -> allow
path linked to property P (photos, private_photos, or photo_visibility.property_id)
   and P.user_id = auth.uid()          -> allow
path unlinked AND folder = auth.uid()  -> allow (uploader's own in-progress upload)
otherwise                              -> deny (unlinked OCR/Bulk objects => admin only)
```
- `private_ocr` objects stay admin + property owner only once linked (per owner policy). Confirm whether owners should see OCR source images, or admin only even after linking.
- Default covers stay bundled assets (outside bucket) — unchanged.

## 4. Future implementation (not done now)

Migration (new drizzle migration, additive):
- New `public.can_view_property_photo(_path text) returns boolean`, SECURITY DEFINER, `search_path=public`, STABLE; checks is_admin, property link + owner, or unlinked own-folder. REVOKE from PUBLIC/anon, GRANT EXECUTE to authenticated.
- DROP POLICY "Collaborators can view displayable property photos" and "Users can view own property photos"; CREATE one SELECT policy using the new function.
- Tighten UPDATE/DELETE on objects to `can_view_property_photo` AND (admin OR owner) so a collaborator cannot overwrite admin-attached files.
- Change `shared_properties()` photos column to return photos only when `p.user_id = auth.uid() OR is_admin` (depends on question 1).
- Leave `photo_is_public_listing` in place, marked DEPRECATED (share links still use visibility classes server-side).

Code:
- src/lib/properties.ts: `signedPhotoUrls` tolerate per-path denials (filter nulls) so cards fall back to default cover.
- src/components/PropertyCard / CoverSelector: no logic change beyond fallback.
- No change to bulk-execute/batch-import beyond confirming `photo_visibility.property_id` is always set on attach.

Tests (new, SQL-level via test users, run only in the draft's isolated backend):
- Admin: reads A's photo, B's photo, unlinked OCR object → allowed.
- Collaborator A: reads own property photo → allowed; B's public_listing photo → denied; unlinked admin OCR object → denied; OCR photo after attach to A's property → allowed.
- Collaborator B: mirror of A.
- Anon: everything denied.
- Unit test for `signedPhotoUrls` fallback.

## 5. Safety confirmation
- Plan only; no SQL writes, no migrations, no Storage/Auth/secret/cron changes, no publish.
- Implementation would run in a separate draft with its own isolated database; old property/OCR photos are excluded from the independent deployment, so no data backfill is needed.

## Unresolved questions
1. Should collaborators still see other owners' listings (without photos), or not at all?
2. Owner = `properties.user_id` — confirm, and how collaborators become owners given admin-only insert.
3. After linking, may the property owner see `private_ocr` source images, or admin only?
4. Keep public share-link photos behaviour unchanged?
