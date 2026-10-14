# Nifty tasks — Bharat Connect part 2 (Contacts, Invoices, Bills)

Reference for all three: `docs/BharatConnect_Contacts_Invoices_Bills_Screens_v1.1.docx` (section number in each task).
Prototype: github.com/akhilledgers/bharatconnectflow, branch `bills-item-review-bc-view`.

---

## Task 1 — Bharat Connect: Contacts and Catalog matching rules

**Assignee:** Karthik
**Doc:** Section 1 (Contacts), 1.4 (Catalog and Match catalog and create)

**Goal:** Every contact shows whether it is on Bharat Connect, and the catalog is ready for bills to be matched against it.

**Subtasks**
- [ ] Create Contact: on a 15-character GSTIN, also search Bharat Connect (only when the business is connected). Show "On Bharat Connect" + B2B ID, or "Not on Bharat Connect yet".
- [ ] Not found: "Invite them to Bharat Connect once saved" ticked by default; send the invite on save.
- [ ] Found: "Request contact details" sends a consent request. Never fill email or mobile from search.
- [ ] Contacts list: B mark before each name (on Bharat Connect / not on it / never checked).
- [ ] Contact page: show the B2B ID; match invoices and bills by B2B ID.
- [ ] Catalog: items created from a bill show the B mark, "Added From" the bill and "Created By Bharat Connect".
- [ ] Write down the Match catalog and create rules for Ranjith: matching order, new-item fields, account type preselection, remembered links (doc 1.4).
- [ ] Add the table changes in doc 1.6: `contacts` columns, `bc_contact_detail_requests`, `catalog_items` columns, `catalog_item_links`.

**Done when**
- A contact with a B2B ID is found once and never searched again on each invoice.
- Email and mobile are never auto-filled from Bharat Connect.
- Ranjith has signed off the matching rules.

---

## Task 2 — Bharat Connect: Send sales invoices

**Assignee:** Vairavan
**Doc:** Section 2 (Invoices)

**Goal:** A user can send a LEDGERS sales invoice over Bharat Connect, see the buyer's answer, and cancel it when allowed.

**Subtasks**
- [ ] Create Invoice: no send checkbox. If the customer is on Bharat Connect, show their B2B ID and "Once created, review and send via Bharat Connect."
- [ ] After Create: callout "Invoice {no} created. Send via Bharat Connect?" with Send Now. Customer not on Bharat Connect → Invite instead.
- [ ] Invoices list: Bharat Connect column (Send via / Sending / Sent To Buyer / Accepted / Rejected / Failed + Retry / Cancelled), status filter, "N invoices pending to send" banner (3-day dismiss).
- [ ] Invoice page: strip with status, buyer comment and history; Resend on Failed.
- [ ] Cancel & Delete: only from Sent To Buyer, Returned or Rejected; reason required (1–100 characters, no `"`); soft delete in LEDGERS.
- [ ] Edit and delete rules from doc 2.7 (accepted → credit note; e-invoice never edited; GSTR-1 filed or receipts → no delete).
- [ ] Show "in progress" until Bharat Connect returns the result (up to 180 seconds).
- [ ] Add the table changes in doc 2.9: `sales_invoices` columns and the shared `bc_events` table.

**Done when**
- Nothing reaches a buyer without the user clicking Send.
- Every status in doc 2.5 shows the right strip text and action.
- Every call and status change is logged in `bc_events`.

---

## Task 3 — Bharat Connect: Receive bills and create purchase invoices

**Assignee:** Ranjith
**Doc:** Section 3 (Bills); matching rules from Karthik (1.4)

**Goal:** A supplier's invoice received over Bharat Connect can be created as a LEDGERS purchase invoice (which accepts it) or rejected, with every line booked to a catalog item and account.

**Subtasks**
- [ ] Store each incoming invoice in `bc_incoming_invoices` as "Not created" (not in totals, no bill number).
- [ ] Purchase Invoices list: LEDGERS layout; Bharat Connect button with a red count of invoices waiting; "N bills pending to accept" banner.
- [ ] Bharat Connect view: all received invoices, waiting first, with Create.
- [ ] Create Purchase Invoice page: prefilled and locked; Bill No = LEDGERS' next number; Invoice No = supplier's; Vendor / Billing / Shipping as on LEDGERS with GSTIN and B2B ID.
- [ ] Match catalog and create: status under each item; Review popup (match → search → Add new item with Account Type); "Remember for future bills".
- [ ] Remarks required (1–100 characters, no `"`); Create disabled until every item is resolved.
- [ ] Create: show "Accepting…", and create the bill only when Bharat Connect confirms the Accept. Then return to the list with the new bill on top and the Bharat Connect mark.
- [ ] Reject: comment required; the invoice never becomes a bill.
- [ ] Supplier edits → replace and stay waiting; supplier cancels → Cancelled. Handle Close and Abandon too.
- [ ] After Accept: no edit or cancel; delete blocked with "Raise a debit note instead."
- [ ] Add the table changes in doc 3.11: `bc_incoming_invoices`, `purchase_invoices` and `purchase_invoice_lines` columns.

**Done when**
- Every created bill line has a catalog item and an account.
- A failed Accept never leaves a bill in the books.
- Remembered items match automatically on the next bill from the same supplier.

---

# Bharat Connect list — dependent tasks

Each task tracks the Bharat Connect side of one area and depends on its module task above.
Order: **BC-1 → BC-2** and **BC-1 → BC-3**.

## BC-1 — Bharat Connect: Contacts and Catalog

**Owner:** Karthik
**Depends on:** Contacts module task (Karthik)
**Blocks:** BC-2, BC-3

- [ ] Search a contact on Bharat Connect by GSTIN; store the B2B ID on the contact.
- [ ] Invite contacts not on Bharat Connect.
- [ ] Request contact details by consent only (never auto-fill email or mobile).
- [ ] Hand the final Match catalog and create rules to Ranjith (doc 1.4).
- [ ] Contact and catalog tables (doc 1.6).

**Done when:** a saved contact has its B2B ID, ready for Invoices and Bills.

## BC-2 — Bharat Connect: Send sales invoices

**Owner:** Vairavan
**Depends on:** Invoices module task (Vairavan), BC-1

- [ ] Send an invoice over Bharat Connect; show its status (Sent To Buyer / Accepted / Rejected / Failed).
- [ ] Show the buyer's comment; Resend on Failed.
- [ ] Cancel & Delete with a required reason (1–100 characters).
- [ ] Show "in progress" until Bharat Connect replies (up to 180 seconds).
- [ ] Log every call in `bc_events`, shared with Bills (doc 2.9).

**Done when:** an invoice goes from Send to the buyer's answer, with every step logged.

## BC-3 — Bharat Connect: Receive bills

**Owner:** Ranjith
**Depends on:** Bills module task (Ranjith), BC-1, `bc_events` from BC-2

- [ ] Store incoming invoices as "Not created"; show them in the Bharat Connect view.
- [ ] Create Purchase Invoice = Accept; book the bill only after Bharat Connect confirms.
- [ ] Reject with a required comment.
- [ ] Match catalog and create, with Account Type, using Karthik's rules.
- [ ] Handle supplier Edit, Cancel, Close and Abandon.
- [ ] Bills tables (doc 3.11).

**Done when:** a supplier's invoice is either booked in LEDGERS with every line on a catalog item and account, or rejected.
