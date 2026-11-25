-- بيع بلا إنترنت: جعل تسجيل الطلب آمناً من التكرار
--
-- A sale taken while the cafe's internet is down is held on the POS and replayed
-- later. The dangerous moment is a reply that never arrives: the server may have
-- committed the order, the till cannot tell, and a naive retry books the sale
-- twice. The till therefore stamps every sale with a uid it generates BEFORE the
-- first attempt, and the uid — not the attempt — decides identity.
--
-- STRICTLY ADDITIVE, on a live database that has drifted ahead of this folder
-- and is shared with another system: one nullable column, one partial unique
-- index, one new function. `place_order` itself is NOT touched; the new function
-- wraps it, so anything else calling place_order is unaffected.

alter table public.orders add column if not exists client_uid text;

-- partial: the 2,393 existing orders stay null, and nulls never collide
create unique index if not exists orders_client_uid_key
  on public.orders (client_uid) where client_uid is not null;

/** place_order, but safe to call twice with the same client_uid.
 *
 *  Returns `already = true` when this uid was recorded by an earlier attempt, so
 *  the caller can tell "your sale is in" from "I just created it" and skip
 *  re-charging it. The insert and the stamping share one transaction: if two
 *  replays race, the unique index rejects the second and its whole order rolls
 *  back, so a duplicate cannot survive even for an instant. */
create or replace function public.place_order_idem(
  p_client_uid text,
  p_channel order_channel,
  p_lines jsonb,
  p_customer uuid default null,
  p_table text default null,
  p_note text default null
) returns table(order_id uuid, order_seq int, already boolean)
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_seq int;
begin
  if p_client_uid is null or length(trim(p_client_uid)) = 0 then
    raise exception 'client_uid required';
  end if;

  select o.id, o.order_seq into v_id, v_seq from orders o where o.client_uid = p_client_uid;
  if found then
    order_id := v_id; order_seq := v_seq; already := true; return next; return;
  end if;

  select po.order_id, po.order_seq into v_id, v_seq
    from public.place_order(p_channel, p_lines, p_customer, p_table, p_note) po;
  update orders set client_uid = p_client_uid where id = v_id;

  order_id := v_id; order_seq := v_seq; already := false; return next;
end $$;

revoke all on function public.place_order_idem(text, order_channel, jsonb, uuid, text, text) from public;
grant execute on function public.place_order_idem(text, order_channel, jsonb, uuid, text, text) to service_role;
