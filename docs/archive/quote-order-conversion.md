# Quote to order conversion workflow

Quotes can now be promoted into production orders once purchasing approval or a customer PO has been recorded. The admin quote detail page includes a **PO / Approval received** toggle that prompts for an approval upload. The same control appears on the quote list so coordinators can flag approvals without leaving the table.

When the approval is marked as received we persist a dedicated quote attachment and store the association in quote metadata. The **Convert to order** action becomes available once approval is on file and the quote is linked to a customer. Converting will:

- Generate the next order number for the originating business code.
- Copy quote parts, add-on selections, and attachments into the new order.
- Duplicate every uploaded attachment into the order's storage directory so the original quote retains its files. Remote attachments are copied as links.
- Stamp the quote metadata with the order id/number to prevent duplicate conversions.

### Attachment storage policy

Quote attachments are **copied** when an order is created. The original quote attachment remains in place to preserve the quoting record; no automated cleanup currently runs on legacy quote files. Operations can safely remove stale quote files manually if storage pressure becomes a concern, but only after confirming the corresponding order has its own copy. Future cleanup tooling should look for quotes with `metadata.conversion.orderId` set and a matching order attachment before deleting quote artifacts.
