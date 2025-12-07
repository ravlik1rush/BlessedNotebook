# Avatar Setup Instructions

To enable avatar uploads, you need to set up a Supabase Storage bucket.

## Steps:

1. **Go to your Supabase Dashboard**
   - Navigate to Storage section
   - Click "New bucket"

2. **Create the bucket:**
   - Name: `avatars`
   - Public bucket: **Yes** (check this box)
   - File size limit: 5MB (or your preference)
   - Allowed MIME types: `image/*`

3. **Set Storage Policies:**

   Go to Storage > Policies > avatars and create these policies:

   **Policy 1: Allow authenticated users to upload**
   - Policy name: "Users can upload their own avatars"
   - Allowed operation: INSERT
   - Policy definition:
   ```sql
   (bucket_id = 'avatars'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])
   ```
   
   Or use this simpler policy for authenticated users:
   ```sql
   auth.role() = 'authenticated'
   ```

   **Policy 2: Allow public read access**
   - Policy name: "Public can view avatars"
   - Allowed operation: SELECT
   - Policy definition:
   ```sql
   bucket_id = 'avatars'::text
   ```

   **Policy 3: Allow users to delete their own avatars**
   - Policy name: "Users can delete their own avatars"
   - Allowed operation: DELETE
   - Policy definition:
   ```sql
   auth.role() = 'authenticated'
   ```

## Alternative: Use RLS Policies via SQL

Run this SQL in your Supabase SQL Editor:

```sql
-- Create the bucket (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload
CREATE POLICY "Users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Allow public read access
CREATE POLICY "Public can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');
```

After setting up the bucket, try uploading an avatar again!


