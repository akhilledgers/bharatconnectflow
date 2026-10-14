# Bharat Connect - test cases (Phase 1)

Every flow built in the prototype, plus the R3.8 rules it must meet. 125 cases.
Spreadsheet copy: `BharatConnect_Test_Cases.csv` (import into Google Sheets / Excel).

**Prototype status**: *Built* = works in the prototype · *Built (mock)* = simulated · *Gap - to fix* = required by R3.8, not built or built differently · *Backend only* = no screen to test · *Phase 2* = out of scope.

Most bill cases are set up from the dev panel `{ }` > Purchase.

| Area | Cases | Gaps |
|---|---|---|
| Onboarding | 17 | 1 |
| Disconnect | 3 | 0 |
| B2B IDs | 10 | 1 |
| Profile | 13 | 2 |
| Contacts | 13 | 3 |
| Catalog match | 14 | 2 |
| Sales invoices | 23 | 1 |
| Bills | 26 | 7 |
| Common | 6 | 1 |

## Onboarding

| ID | API | Scenario | Precondition | Steps | Expected | Type | Pri | Ref | Status |
|---|---|---|---|---|---|---|---|---|---|
| ONB-01 | ReqCheckEntity | Business not on Bharat Connect | Business PAN not registered on Bharat Connect | 1. Log in / switch to the business | PAN is checked. Top-bar B shows grey 'Not connected'; hover shows Onboard Now. Dashboard banner shown. | Positive | High | ONB 4.1 | Built |
| ONB-02 | ReqCheckEntity | Business already on Bharat Connect | PAN already registered via another platform | 1. Log in / switch to the business | Status 'ID found' (orange). Banner and chip offer Link Existing ID. | Positive | High | ONB 4.1 | Built |
| ONB-03 | - | Connection banner snooze | Not connected | 1. Click Remind me later on the dashboard banner<br>2. Open Invoices, Bills, Contacts | Banner hidden on all pages for 7 days (one shared decision), then returns. | Positive | Low | LEDGERS | Built |
| ONB-04 | - | Connect page layout | Not connected | 1. Settings > Bharat Connect | One page: 3-line business summary, generated B2B ID read-only with breakdown, ownership line, one consent checkbox. | Positive | Medium | README 2 | Built |
| ONB-05 | - | Consent required | Connect page open | 1. Leave consent unticked<br>2. Try Submit | Submit disabled until consent is ticked. | Negative | High | HB 1.1 | Built |
| ONB-06 | ReqVerifyOTP | Ownership already verified in LEDGERS | Mobile/email verified at LEDGERS sign-up | 1. Open connect page | Green 'ownership verified' line, no OTP step. | Positive | Medium | HB Ann. Q L1(b) | Built |
| ONB-07 | ReqVerifyOTP | Ownership not verified - correct OTP | Contact not verified | 1. Submit<br>2. Enter the OTP received | OTP accepted, flow continues. | Positive | High | HB Ann. Q L1(b) | Built (mock) |
| ONB-08 | ReqVerifyOTP | Wrong / expired OTP | OTP sent | 1. Enter a wrong OTP<br>2. Enter an expired OTP | Error shown, flow does not continue; resend available. | Negative | High | HB Ann. Q | Built (mock) |
| ONB-09 | ReqRegEntity, ReqRegID | Connect successfully | Consent ticked | 1. Click Submit | Card moves Sending > Creating ID > Waiting for confirmation > Success. Status Connected; B2B ID shown on overview as Default. | Positive | High | HB 1.1, ONB 2.4 | Built |
| ONB-10 | ReqRegEntity | Verification level sent | Connect submitted | 1. Inspect the reqRegEntity payload | verificationLevel = "1" always present (missing tag is treated as Level 5). | Positive | High | HB Ann. Q | Backend only |
| ONB-11 | ReqRegEntity | Registration rejected | Bharat Connect returns FAILURE | 1. Submit connect (Dev panel > Reject webhook) | Status Needs attention; red banner with reason; Fix Now opens the failing field. | Negative | High | ONB 4.1 | Built |
| ONB-12 | ReqRegEntity | No response in 180 seconds | respRegEntity not received | 1. Submit connect<br>2. Wait 180 s | Status stays Setting up; reqCheckStatus is called by txn.id and the result applied. | Edge | High | HB Ann. E, Ann. P | Gap - to fix |
| ONB-13 | ReqMapEntity, ReqFetchBusiness | Link existing ID | Status ID found | 1. Click Link Existing ID (banner, chip or page) | Linking... then Connected; found ID added as Default; same result from every entry point. | Positive | High | ONB 2.4 (confirm with NBBL) | Built |
| ONB-14 | - | Setting up state | Status Setting up | 1. Open Settings > Bharat Connect<br>2. Dev panel > Confirm webhook | Progress card shown; on confirmation status becomes Connected. | Positive | Medium | ONB 4.1 | Built |
| ONB-15 | - | Assisted setup state | Status Assisted setup | 1. Open Settings > Bharat Connect | Only Contact Us; no automatic flow. | Positive | Low | ONB 4.1 | Built |
| ONB-16 | - | Sole proprietor ID format | Business = Sharma Traders | 1. Open connect / Create ID | ID follows AAAA.BBBB.CCCC.DDD@BCB; no PAN/GSTIN base choice. | Positive | Medium | HB Ann. F (standard not confirmed) | Built |
| ONB-17 | All | Not connected = plain LEDGERS | Not connected | 1. Open Invoices, Bills, Contacts, a contact, an invoice | No Bharat Connect column, button or status anywhere except the Connect banner and sidebar placeholder. | Positive | High | README 7 | Built |

## Disconnect

| ID | API | Scenario | Precondition | Steps | Expected | Type | Pri | Ref | Status |
|---|---|---|---|---|---|---|---|---|---|
| DIS-01 | ReqActivateEntity | Disconnect blocked | Connected; an invoice is unpaid or part paid | 1. Overview > Disconnect | Disconnect disabled with tooltip giving the reason. | Negative | Medium | LEDGERS rule (SPEC Q6) | Built |
| DIS-02 | ReqActivateEntity | Disconnect business | Connected; nothing unpaid | 1. Overview > Disconnect > confirm | Business deactivated for this platform; status Not connected; all Bharat Connect UI disappears. | Positive | High | HB 1.5 | Backend only |
| DIS-03 | ReqActivateEntity | Reactivate business | Business deactivated | 1. Connect again | Business reactivated; IDs and history restored. | Positive | Medium | HB 1.5 | Backend only |

## B2B IDs

| ID | API | Scenario | Precondition | Steps | Expected | Type | Pri | Ref | Status |
|---|---|---|---|---|---|---|---|---|---|
| ID-01 | - | IDs list | Business = Sharma Traders | 1. Overview > Manage IDs | All IDs listed with visibility, identifier, status; legacy ID labelled. | Positive | Medium | HB 1.2 | Built |
| ID-02 | ReqCheckID | Create ID - live preview | Company business, connected | 1. Create ID<br>2. Choose PAN / GSTIN base<br>3. Type an ending | Preview updates as you type; availability checked. | Positive | Medium | HB 1.2 | Built |
| ID-03 | ReqCheckID | Ending length and characters | Create ID drawer open | 1. Enter 1 character<br>2. Enter 6 characters<br>3. Enter a space or symbol | Each is rejected with a message; only 2-5 letters/digits allowed. | Negative | Medium | LEDGERS rule, SW b2BId | Built |
| ID-04 | ReqCheckID | Ending already taken | Create ID drawer open | 1. Enter USED or TEST | Shown as taken with suggestion chips; clicking a chip fills it. | Negative | Medium | HB 1.2 | Built (mock) |
| ID-05 | ReqCheckID | Offensive or platform name | Create ID drawer open | 1. Enter an offensive word or a platform/brand name | Rejected. | Negative | Low | HB Ann. F | Built |
| ID-06 | ReqRegID | Create extra ID | Valid available ending | 1. Choose public/private and settlement account<br>2. Create | New active ID in the list with chosen visibility. | Positive | High | HB 1.2 | Built |
| ID-07 | - | Settlement account choices | Create ID drawer open | 1. Open settlement account list | Only verified LEDGERS bank accounts listed. | Negative | Low | HB Ann. R | Built |
| ID-08 | ReqEditId | Deactivate blocked | ID has open invoices or financing | 1. Deactivate the ID | Blocked; toast gives the reason. | Negative | Medium | LEDGERS rule | Built |
| ID-09 | ReqEditId | Deactivate / reactivate ID | ID with nothing open | 1. Deactivate (enter reason and description)<br>2. Reactivate | Status Deactivated, then Active. Reason and description sent (mandatory in R3.8). | Positive | High | HB 1.4, RN | Gap - to fix (no reason field; API not in sheet) |
| ID-10 | - | Legacy IDs | Legacy ID present | 1. View the IDs table | Labelled Legacy; not validated against the new format. | Positive | Low | README 4 | Built |

## Profile

| ID | API | Scenario | Precondition | Steps | Expected | Type | Pri | Ref | Status |
|---|---|---|---|---|---|---|---|---|---|
| PRO-01 | - | Level badge | Connected | 1. Open profile<br>2. Hover Verified for Level N | Badge shows level; tooltip lists checks met per level. | Positive | Low | HB Ann. Q | Built |
| PRO-02 | - | Section tabs | Profile open | 1. Click each tab<br>2. Scroll | Tab scrolls to section; tab bar stays pinned; current section highlighted. | Positive | Low | README 6 | Built |
| PRO-03 | - | Read-only sourced fields | Profile open | 1. Look at PAN, legal name, GSTIN | Plain text with source badge; no input box. | Positive | Medium | README 6 | Built |
| PRO-04 | ReqEditEntity | Save a normal field | Profile open | 1. Change a tier-1 field<br>2. Save | Edited badge; bar shows '1 field changed'; Sending > 'Sent to Bharat Connect' > Up to date after 3 s. Full record sent, not just the change. | Positive | High | HB 1.3 | Built |
| PRO-05 | ReqEditEntity | Save a confirmation field | Profile open | 1. Change a tier-2 field (e.g. settlement default)<br>2. Save<br>3. Cancel, then Save > Confirm & Send | Before > after diff shown; Cancel returns; Confirm sends. | Positive | High | README 6 | Built |
| PRO-06 | - | Invalid field | Profile open | 1. Add an address with a wrong pincode | Field red with message; bar shows 'Fix: ...' link that scrolls to it; Save blocked. | Negative | Medium | README 6 | Built |
| PRO-07 | ReqEditEntity | Update rejected | Dev panel > next save = Rejected | 1. Change a field<br>2. Save | Bar points at the rejected field; editing it clears the error. | Negative | High | README 6 | Built |
| PRO-08 | ReqEditEntity | Version conflict | Dev panel > next save = Conflict | 1. Change a field<br>2. Save | Stale fields refreshed, user's edits kept, conflict banner above the bar. | Edge | Medium | README 6 | Built |
| PRO-09 | - | Switch business with unsaved edits | Edits pending | 1. Dev panel > switch business | Other business opens clean; edits don't leak. | Edge | Low | README | Built |
| PRO-10 | ReqEditEntity | MCC by level | Level 1, 2 and 3 | 1. Open profile at each level | MCC and bank account required only at Level 3. | Positive | Medium | HB Ann. Q | Gap - to fix (required from Level 2) |
| PRO-11 | - | Upload KYC document | Below Level 3 | 1. Reach Full Verification<br>2. Upload a document | Uploaded, then Verified a few seconds later. | Positive | Medium | HB Ann. Q | Built (mock) |
| PRO-12 | - | Document re-requested | Document verified | 1. Dev: Simulate re-request | Amber dot on the button; upload reopens for that document only. | Edge | Low | README 6 | Built (mock) |
| PRO-13 | - | Payment address format | Bank account linked | 1. View payment address | Shown in Annexure I format, e.g. ABCDPUNB00131. | Positive | Medium | HB Ann. I | Gap - to fix (shows pan.ending@bcb) |

## Contacts

| ID | API | Scenario | Precondition | Steps | Expected | Type | Pri | Ref | Status |
|---|---|---|---|---|---|---|---|---|---|
| CON-01 | - | GSTIN autofill when not connected | Business not connected | 1. Create Contact<br>2. Enter 33AADCI6142F1ZX | Name, PAN, address filled from GST; no Bharat Connect check or hint. | Positive | High | README 8 | Built |
| CON-02 | ReqSearchEntity | Counterparty on Bharat Connect | Connected | 1. Create Contact<br>2. Enter a 15-character GSTIN that is on Bharat Connect | Hint shown; 'On Bharat Connect' with B2B ID; email and mobile NOT filled. | Positive | High | HB 2.1, 2.2 | Built |
| CON-03 | ReqSearchEntity | Incomplete or invalid GSTIN | Connected | 1. Enter 14 characters<br>2. Enter an invalid GSTIN | No search made; invalid format message. | Negative | Medium | LEDGERS | Built |
| CON-04 | ReqSendInvite | Not on Bharat Connect - invite | Connected; GSTIN not found | 1. Enter GSTIN<br>2. Keep 'Invite them...' ticked<br>3. Save | 'Not on Bharat Connect yet'; box ticked by default; contact saved and invite sent toast. | Positive | High | HB 2.4 | Built |
| CON-05 | ReqSendInvite | Not on Bharat Connect - no invite | Connected; GSTIN not found | 1. Untick invite<br>2. Save | Contact saved; no invite sent. | Positive | Medium | HB 2.4 | Built |
| CON-06 | ReqNonPublicInfo | Request contact details | GSTIN found on Bharat Connect | 1. Click Request contact details | Consent request sent toast; fields stay empty until the counterparty shares. | Positive | High | HB 2.2-2.3 | Built (mock); API not in sheet |
| CON-07 | ReqShareNonPublicInfo | Counterparty shares details | Request pending | 1. Counterparty approves | Email / mobile filled on the contact. | Positive | Medium | HB 2.3 | Gap - to fix |
| CON-08 | ReqSearchEntity | B2B ID stored once | Contact saved with B2B ID | 1. Create an invoice for the contact | No new search; stored B2B ID used. | Positive | High | HB 2.1 notes 2-3 | Built |
| CON-09 | - | B mark on the list | Contacts with B2B ID / checked not found / no GSTIN | 1. Open Contacts | Full-colour B / grey B with Invite on hover / faint placeholder; names stay aligned. | Positive | Medium | README 8 | Built |
| CON-10 | - | Contact page | Contact with B2B ID | 1. Open the contact | B2B ID shown; invoices joined by B2B ID; Pending to send / Pending to accept counts open the right list. | Positive | Medium | README 8 | Built |
| CON-11 | ReqSendInvite | Auto-invite a found contact | GSTIN found on Bharat Connect | 1. Save the contact | Invite sent automatically (tells them we're on Bharat Connect). | Positive | Low | HB 2.4 note 1 | Gap - to fix |
| CON-12 | ReqSearchEntity | Re-check not-found contacts | Contact checked, not found | 1. Wait for the periodic job | Searched again; if now found, B2B ID saved and mark turns full colour. | Edge | Low | HB 2.1 note 4 | Gap - to fix |
| CON-13 | ReqSearchEntity | Search result limit | Search returns many results | 1. Search | At most 50 results handled. | Edge | Low | RN | Backend only |

## Catalog match

| ID | API | Scenario | Precondition | Steps | Expected | Type | Pri | Ref | Status |
|---|---|---|---|---|---|---|---|---|---|
| CAT-01 | - | Item linked on an earlier bill | Dev > Purchase > 'Linked before' | 1. Open Create from Bharat Connect | Line shows ✓ Catalog: <item>; no review needed. | Positive | High | Doc 1.4 | Built |
| CAT-02 | - | Same HSN and same name | Dev > 'All in catalog' | 1. Open Create page | Every line ✓ In catalog. | Positive | High | Doc 1.4 | Built |
| CAT-03 | - | Similar item | Dev > 'Similar item' | 1. Open Create page | Line shows ● Possible match: <item> · Review; Create disabled until confirmed. | Positive | High | Doc 1.4 | Built |
| CAT-04 | - | No match | Dev > 'All new' | 1. Open Create page | Line shows ● Not found in catalog · Review; nothing preselected (never defaults to new). | Positive | High | Doc 1.4 | Built |
| CAT-05 | - | Confirm suggested match | Possible match line | 1. Review<br>2. Confirm | Line becomes ✓; account taken from the item. | Positive | High | Doc 1.4 | Built |
| CAT-06 | - | Pick another item | Review popup open | 1. Change<br>2. Search<br>3. Pick an item | Top 5 ranked by HSN and name; picked item linked; its account used. | Positive | Medium | Doc 1.4 | Built |
| CAT-07 | - | Add new item - required fields | Review popup open | 1. + Add new item<br>2. Clear HSN / GST / unit / Account Type | Form prefilled from the bill; Add disabled until all required fields filled. | Negative | High | LEDGERS Create Catalog | Built |
| CAT-08 | - | Account Type preselection | New item for HSN 9965, 4819, 4820, a service, other | 1. Add new item for each | Freight Inward / Packing Materials / Office Expenses / Professional Fees / Purchases (same-HSN item's account wins). | Positive | Medium | Doc 1.4 | Built |
| CAT-09 | - | Remember for future bills | Remember ticked on a line | 1. Create the bill<br>2. Receive the next bill from the same supplier | Line matches automatically (✓ Catalog). | Positive | High | Doc 1.4 | Built |
| CAT-10 | - | Sales-only item picked | Dev > 'Sales-only item' | 1. Pick the sales-only item<br>2. Create | Purchase side added to the item with the chosen account. | Edge | Medium | Doc 1.4 | Built |
| CAT-11 | - | Missing HSN / GST from supplier | Dev > 'Missing HSN/GST' | 1. Add new item | HSN and GST must be entered before Add. | Negative | Medium | SW itemLists (optional fields) | Built |
| CAT-12 | - | No item name from supplier | productDescription missing | 1. Open Create page | Item column falls back to item code / HSN; matching still works. | Edge | Medium | SW itemLists | Gap - to fix |
| CAT-13 | - | New item in Catalog | Bill created with a new item | 1. Open Catalog > the item | B mark; Added From the bill; Created By Bharat Connect. | Positive | Medium | Doc 1.4 | Built |
| CAT-14 | - | Tax type of new item | Line has gstTaxType EXEMPT / NIL etc. | 1. Add new item | Non-Taxable set from gstTaxType. | Edge | Low | RN gstTaxType | Gap - to fix |

## Sales invoices

| ID | API | Scenario | Precondition | Steps | Expected | Type | Pri | Ref | Status |
|---|---|---|---|---|---|---|---|---|---|
| INV-01 | - | Create page | Connected; customer with B2B ID | 1. Create Invoice<br>2. Choose the customer | No send checkbox; B2B ID and 'Once created, review and send via Bharat Connect' shown. | Positive | High | Doc 2 | Built |
| INV-02 | - | Create never sends | Invoice form filled | 1. Create | Lands on the invoice with toast and callout 'Send via Bharat Connect?'; nothing sent. | Positive | High | Doc 2 | Built |
| INV-03 | ReqSendInvoice | Send from callout | Callout visible | 1. Send Now | Sending... > Sent To Buyer; callout follows status. | Positive | High | HB 5.1 | Built |
| INV-04 | ReqSendInvoice | Send from list | Invoice pending to send | 1. Click Send via B in the list | Sending... > Sent To Buyer. | Positive | High | HB 5.1 | Built |
| INV-05 | ReqSendInvite | Customer not on Bharat Connect | Customer has no B2B ID | 1. Hover Send in list<br>2. Open the invoice | Send greyed; Invite to Bharat Connect offered; invite toast on click. | Negative | High | Doc 2 | Built |
| INV-06 | - | Business not connected | Not connected | 1. Create an invoice | Callout offers Connect, not Send. | Negative | Medium | Doc 2 | Built |
| INV-07 | - | One filled button | Callout visible | 1. Look at the sidebar card | Sidebar Send is outline while callout shows; no second Invite. | Positive | Low | Design system | Built |
| INV-08 | ReqConfirmInvoice (incoming) | Buyer accepts | Invoice Sent To Buyer | 1. Dev > Simulate buyer response > Accept | Status Accepted with buyer's comment and history. | Positive | High | HB 5.4, Ann. H | Built |
| INV-09 | ReqConfirmInvoice (incoming) | Buyer rejects | Invoice Sent To Buyer | 1. Dev > Reject | Status Rejected with comment; Cancel & Delete offered. | Positive | High | HB Ann. H | Built |
| INV-10 | ReqConfirmInvoice (incoming) | Buyer returns | Invoice Sent To Buyer | 1. Dev > Return | Status Returned with comment; action Cancel (create a corrected one). | Positive | Medium | HB Ann. H | Built |
| INV-11 | ReqSendInvoice | Send fails | respSendInvoice FAILURE | 1. Dev > Fail<br>2. Retry from list / Send Again from invoice | Failed with reason; Retry / Send Again re-sends. | Negative | High | HB Ann. E | Built |
| INV-12 | ReqSendInvoice | No reply in 180 seconds | No respSendInvoice | 1. Send<br>2. Wait 180 s | Shows in progress; reqCheckStatus called; final status applied. | Edge | High | HB Ann. E, Ann. P | Gap - to fix |
| INV-13 | - | Status filter | Mixed statuses | 1. Filter icon > each status | List filtered; dot on the icon when a filter is active. | Positive | Medium | Doc 2 | Built |
| INV-14 | - | Pending banner | Invoices pending to send | 1. Show invoices<br>2. Dismiss | Filter applied; banner snoozed 3 days, independent of Bills. | Positive | Low | Doc 2 | Built |
| INV-15 | ReqStatusChangeInvoice | Cancel & Delete | Sent To Buyer, Returned or Rejected | 1. Cancel & Delete<br>2. Enter a reason<br>3. Confirm | Status Cancelled; invoice soft-deleted in LEDGERS; supplierAction CANCEL with supplierRemarks. | Positive | High | XL ReqStatusChangeInvoice | Built; API not in sheet |
| INV-16 | ReqStatusChangeInvoice | Cancel reason rules | Cancel dialog open | 1. Leave empty<br>2. Type 101 characters<br>3. Type a " character | Confirm blocked / input limited to 100 / " not allowed. | Negative | High | SW supplierRemarks 1-100 | Built |
| INV-17 | - | Cancel after Accept | Invoice Accepted | 1. Look for Cancel | Not offered; message to raise a credit note. | Negative | High | HB Ann. H | Built |
| INV-18 | ReqEditInvoice | Edit a sent invoice | Invoice sent | 1. Click Edit | Disabled: 'Sent on Bharat Connect. Cancel it and create a new one.' | Negative | High | Phase 1 scope | Built |
| INV-19 | - | Delete rules | GSTR-1 filed / receipt recorded / e-invoice | 1. Try Edit or Delete | Blocked with the reason; e-invoice never editable. | Negative | Medium | HB A4.3, editRules | Built |
| INV-20 | - | Printed invoice | Invoice sent | 1. Print | 'B2B ID: ...' under our GSTIN. | Positive | Low | LEDGERS | Built |
| INV-21 | ReqSendInvoice | Pre-send checks | Totals don't add up / name or GSTIN differs from onboarding / other bank's VPA | 1. Send | Blocked with the reason before calling the API. | Negative | High | HB A4.1(i) | Backend only |
| INV-22 | - | Top-bar count | Invoices pending to send and bills pending | 1. Look at the B in the top bar<br>2. Hover and click each stat | Red count = pending to send + pending to accept; stats open the right list. | Positive | Medium | README 1 | Built |
| INV-23 | ReqEditInvoice | Edit & Resend | Invoice sent | - | Not available in Phase 1. | Negative | Low | Phase 1 scope | Phase 2 - not in Phase 1 |

## Bills

| ID | API | Scenario | Precondition | Steps | Expected | Type | Pri | Ref | Status |
|---|---|---|---|---|---|---|---|---|---|
| BIL-01 | - | Not connected | Not connected | 1. Open Purchase Invoices | LEDGERS list only; no Bharat Connect button. | Positive | High | Doc 3 | Built |
| BIL-02 | - | Default list | Connected | 1. Open Purchase Invoices | Only bills in the books; LEDGERS columns; newest bill number first; no Bharat Connect column. | Positive | High | Doc 3 | Built |
| BIL-03 | ReqSendInvoice (incoming) | Bill received | Connected | 1. Dev > Purchase > Receive a bill | Red count on the Bharat Connect button goes up; bill not in default list or totals. | Positive | High | HB 5.1 | Built |
| BIL-04 | - | Bharat Connect view | Bills in several statuses | 1. Click Bharat Connect | All received invoices; waiting first with Create; Bill Number '—' until created. | Positive | High | Doc 3 | Built |
| BIL-05 | - | Zero waiting | Nothing waiting | 1. Look at the button | No red count. | Edge | Low | Doc 3 | Built |
| BIL-06 | - | Pending banner | Bills waiting | 1. Show bills<br>2. Dismiss | Opens Bharat Connect view; snooze 3 days, independent of Invoices. | Positive | Low | Doc 3 | Built |
| BIL-07 | - | Create page prefill | Bill waiting | 1. Create | Amounts, quantities and taxes locked; Bill No = next LEDGERS number; Invoice No = supplier's. | Positive | High | Doc 3 | Built |
| BIL-08 | - | Vendor block | Supplier is / is not a LEDGERS contact | 1. Open Create page | Vendor from contact (by B2B ID or GSTIN) or invoice; GSTIN and B2B ID lines; no remove; state from GSTIN when no address. | Positive | Medium | Doc 3 | Built |
| BIL-09 | - | Create disabled | An item unresolved or Remarks empty | 1. Look at Create | Disabled until every item is resolved and Remarks entered. | Negative | High | Doc 3 | Built |
| BIL-10 | ReqConfirmInvoice | Remarks rules | Create page | 1. Type 101 characters<br>2. Type "<br>3. Press Enter | Stops at 100; " and line breaks removed; text right-aligned, box grows. | Negative | High | SW buyerRemarks 1-100 | Built |
| BIL-11 | ReqConfirmInvoice | Create = Accept | All items resolved, Remarks filled | 1. Create Purchase Invoice | Accept sent; bill booked; back to list with the bill on top, highlighted, B mark; new items in Catalog. | Positive | High | HB 5.4 | Built |
| BIL-12 | ReqConfirmInvoice | Accept fails | respConfirmInvoice FAILURE | 1. Create Purchase Invoice | 'Accepting...' then error; NO bill booked; invoice stays waiting. | Negative | High | HB 5.4, A4.2, Ann. E | Gap - to fix (books immediately) |
| BIL-13 | ReqConfirmInvoice | Accept slow | No reply for up to 180 s | 1. Create Purchase Invoice | 'Accepting...' shown; reqCheckStatus after 180 s. | Edge | High | HB Ann. E, P | Gap - to fix |
| BIL-14 | ReqConfirmInvoice | Reject | Bill waiting | 1. Reject<br>2. Enter a comment (1-100, no ")<br>3. Confirm | Status Rejected; never becomes a bill. | Positive | High | HB Ann. H, SW buyerRemarks | Built |
| BIL-15 | ReqConfirmInvoice | Reject without comment | Reject dialog open | 1. Leave comment empty | Confirm blocked. | Negative | High | SW buyerRemarks required | Built |
| BIL-16 | ReqEditInvoice (incoming) | Supplier edits | Bill waiting | 1. Dev > Simulate supplier > Edit | Bill replaced in place; still waiting; current version stored. | Positive | High | HB Ann. H | Built |
| BIL-17 | ReqStatusChangeInvoice (incoming) | Supplier cancels | Bill waiting | 1. Dev > Simulate supplier > Cancel | Status Cancelled with reason; Create gone. | Positive | High | XL ReqStatusChangeInvoice | Built; API not in sheet |
| BIL-18 | ReqStatusChangeInvoice (incoming) | Supplier closes / abandons | Bill waiting or accepted | 1. Supplier sends CLOSE / ABANDON | Status Closed / Abandoned shown; Create not offered. | Positive | Medium | XL ReqStatusChangeInvoice | Gap - to fix |
| BIL-19 | - | After Accept | Bill created | 1. Try Edit, Reject, Cancel, Delete | Not allowed; Delete says 'Raise a debit note instead.' | Negative | High | HB Ann. H, 5.12 | Built |
| BIL-20 | - | Return | Bill waiting | 1. Look for Return | Not offered in Phase 1. | Negative | Low | Phase 1 scope | Phase 2 - not in Phase 1 |
| BIL-21 | - | Supplier's amounts | Tax-inclusive invoice / rounding differences | 1. Create Purchase Invoice | Lines and totals equal the supplier's amounts exactly. | Edge | High | SW itemLists, isItemAmtTaxInclusive | Gap - to fix (recomputed) |
| BIL-22 | ReqSendInvoice (incoming) | Validate incoming invoice | Wrong B2B ID / totals don't add up / bad status | 1. Supplier sends the invoice | respSendInvoice FAILURE with reason; nothing shown to the user. | Negative | High | HB 5.1, A4.1(iii) | Gap - to fix |
| BIL-23 | ReqSendInvoice (incoming) | Incoming debit note | type = DEBIT NOTE | 1. Supplier sends it | Labelled debit note and linked to the original bill. | Edge | Low | XL ReqSendInvoice | Gap - to fix |
| BIL-24 | - | Reverse charge | reverseChargeTax = Y | 1. Create Purchase Invoice | LEDGERS Reverse Charge setting prefilled. | Edge | Low | SW transactionDetails | Gap - to fix |
| BIL-25 | - | Booked lines | Bill created | 1. Open the bill / journal | Every line has a catalog item and an account. | Positive | High | Doc 3 | Built |
| BIL-26 | - | Printed bill | Bill created | 1. Print | 'B2B ID: ...' under the supplier's GSTIN. | Positive | Low | LEDGERS | Built |

## Common

| ID | API | Scenario | Precondition | Steps | Expected | Type | Pri | Ref | Status |
|---|---|---|---|---|---|---|---|---|---|
| COM-01 | All | Ack and response timing | Any request | 1. Send any request | Ack/Nack within 5 s; result on webhook within 180 s, else reqCheckStatus. | Edge | High | HB Ann. E, P | Backend only |
| COM-02 | All | Duplicate txn.id | Request already sent | 1. Resend with the same txn.id | Rejected as duplicate. | Negative | Medium | HB Ann. B | Backend only |
| COM-03 | All | Broadcast copy | Business mapped to several platforms | 1. Receive a non-primary copy | Stored, never rejected. | Edge | Medium | HB Ann. O | Backend only |
| COM-04 | - | Role permissions | Custom role without Sales Invoice Update / Purchase Bill Create / Settings Bharat Connect | 1. Try Send, Create from Bharat Connect, Onboard | Each blocked for that role. | Negative | High | README Roles | Gap - to fix (not enforced) |
| COM-05 | - | Event log | Any Bharat Connect action | 1. Do the action | Request, response and status change written to bc_events. | Positive | High | Doc 2.9 | Backend only |
| COM-06 | - | Toasts | Any action | 1. Do the action | Toast top-right, green / red, closes after 4 s. | Positive | Low | LEDGERS | Built |
