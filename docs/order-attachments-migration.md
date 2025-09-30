# Order Attachment Migration Guide

The orders API previously stored uploaded files as large base64 data URLs inside the `Attachment.url` column.
The new shared-storage integration expects uploaded files to live on disk with their `storagePath` recorded
in the database. Existing data URL records will continue to render, but the inlined payloads are inefficient
and cannot take advantage of the new download endpoint. Use the following steps to migrate legacy records:

1. **Identify embedded files.** Run a query such as `SELECT id, order_id, label FROM "Attachment" WHERE url LIKE 'data:%';`
   to list attachments that still contain base64 content.
2. **Export the binary data.** For each result, parse the `url` to strip the `data:mimetype;base64,` prefix and
   decode the remainder into a `Buffer`. Persist the decoded file to disk using the helper in `src/lib/storage.ts`
   (`storeAttachmentFile`) with the appropriate business, customer name, and order number.
3. **Update the database.** After writing the file, update the row by setting `storagePath` to the returned path and
   clearing `url` (or replacing it with an external link if you prefer to keep a hosted copy).
4. **Verify access.** Confirm that `/attachments/<storagePath>` responds with the expected file via the new download
   route, and that the order detail page shows the attachment as “Stored”.

Because the migration requires business, customer, and order context, perform the export with a script that joins
on `Order` and `Customer` to gather names before calling `storeAttachmentFile`. Once every record has a
`storagePath`, you may optionally trim the oversized base64 data and reclaim storage space.
