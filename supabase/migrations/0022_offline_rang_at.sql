-- بيعة بلا إنترنت تُحسب على اليوم الذي بيعت فيه، لا على يوم رفعها
--
-- place_order stamps the order with now(), so a sale rung at 11:50pm and sent
-- when the line came back at 00:20 landed on the NEXT day: the closing total
-- the owner reconciles the drawer against was short by that sale, and the next
-- morning started with money nobody sold.
--
-- The till already knows when it rang the sale, so it now says so. Correcting
-- the day also means re-drawing the sequence number from the RIGHT day's
-- counter — moving the order without that would risk colliding with an order
-- that already holds that number on the original day
-- (unique (business_day, order_seq)).
--
-- ADDITIVE: this replaces only place_order_idem, which this project created in
-- 0021 and nothing else calls. `place_order` is still not touched.

create or replace function public.place_order_idem(
  p_client_uid text,
  p_channel order_channel,
  p_lines jsonb,
  p_customer uuid default null,
  p_table text default null,
  p_note text default null,
  -- when the till actually rang it; null means "now", i.e. an online sale
  p_rang_at timestamptz default null
) returns table(order_id uuid, order_seq int, already boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_seq int;
  v_rang_day date;
  v_today date := (now() at time zone 'Asia/Baghdad')::date;
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

  -- A sale that belongs to an earlier business day: move it, and take a number
  -- from that day's counter so the move cannot collide. Only ever backwards —
  -- a till clock running fast must not push takings into tomorrow.
  if p_rang_at is not null then
    v_rang_day := (p_rang_at at time zone 'Asia/Baghdad')::date;
    if v_rang_day < v_today then
      insert into order_counters(business_day, last_seq) values (v_rang_day, 1)
        on conflict (business_day) do update set last_seq = order_counters.last_seq + 1
        returning last_seq into v_seq;
      update orders
         set business_day = v_rang_day,
             order_seq    = v_seq,
             created_at   = p_rang_at,
             paid_at      = case when paid_at is not null then p_rang_at else paid_at end
       where id = v_id;
    end if;
  end if;

  order_id := v_id; order_seq := v_seq; already := false; return next;
end $$;

revoke all on function public.place_order_idem(text, order_channel, jsonb, uuid, text, text, timestamptz) from public;
grant execute on function public.place_order_idem(text, order_channel, jsonb, uuid, text, text, timestamptz) to service_role;

-- the 6-argument version from 0021 is now shadowed; drop it so PostgREST cannot
-- pick the wrong overload
drop function if exists public.place_order_idem(text, order_channel, jsonb, uuid, text, text);
