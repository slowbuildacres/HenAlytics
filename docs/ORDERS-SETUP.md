# Customer orders: setup

Orders lets customers send pre-order requests and "add me to your list" requests
from a homestead's order page (`henalytics.com/o/<link>`). No payments.

## Before (or right after) the website goes live

1. **Run the SQL.** Open Supabase, then SQL Editor, paste all of
   `supabase/migrations/20261111_order_requests.sql`, and click **Run**. It makes the
   `order_requests` table, closed to the app (only the server reads and writes it).
   Until this runs, order pages show "Ordering is down for a moment."
2. **Optional:** add a Vercel environment variable `ORDER_FORM_SECRET` (any long random
   text). If it's missing, the server uses `UNSUBSCRIBE_TOKEN_SECRET`, which is
   already set.

Emails use the existing Resend setup (`RESEND_API_KEY`, `STOCK_EMAIL_FROM`).

## How it works

- **Owner:** More, then Orders, then "Set up my order page." Add menu items (or "Add my
  farm stand items"), a short hello, and pickup details. Share the link or save the
  QR sign.
- **Customer:** opens the link, picks quantities and/or writes a note, and sends it. They
  can also tick "Also email me when there's something fresh" or just join the list.
- **Owner:** new requests show in Orders, with a badge on More and a notice on Home.
  The owner also gets an email if "Email me new requests" is on. They can:
  - Accept, mark it ready, or mark it picked up.
  - Marking it picked up can add each item to Sales. Amounts start from the order and the menu and can be changed first. A menu item linked to a farm stand item takes it off the stand or back stock.
  - Each menu item has a private cost to make and a "count sales under" choice. These stay in the homestead's own data; the public page and the request rows only ever get the name, unit, price and note (`cleanMenu`).
  - Choose "Can't fill it" to decline.
  - Have the customer emailed at each step, with an optional message.

  Join requests go into the customer list (and the chosen email list) with one tap.
- **Spam limits:**
  - The form only works from the page itself: a signed time, at least 3 seconds after
    the page opens, plus a hidden honeypot field.
  - 5 requests an hour per visitor per homestead.
  - 60 requests a day per homestead.
  - 200 customer emails a day per homestead.
- **Turning it off or making a new link** in the app breaks the old link and QR sign
  right away.

## Housekeeping

Handled requests (picked up, declined, added, ignored) older than a year can be cleared with:

```sql
select public.prune_order_requests();
```
