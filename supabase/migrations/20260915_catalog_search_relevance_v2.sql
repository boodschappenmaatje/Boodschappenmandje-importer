begin;

-- PWA 8 Search Relevance V2. Ranking happens in Postgres before pagination,
-- rather than reordering one alphabetic page in the browser.
create extension if not exists unaccent with schema extensions;

create or replace function public.catalog_search_normalize(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select trim(
    regexp_replace(
      lower(extensions.unaccent(coalesce(value, ''))),
      '[^[:alnum:]]+',
      ' ',
      'g'
    )
  );
$$;

create or replace function public.search_catalog_products_v2(
  p_term text,
  p_page integer default 1,
  p_page_size integer default 20,
  p_category text default null,
  p_brand text default null,
  p_offers_only boolean default false,
  p_max_price numeric default null,
  p_sort text default 'relevance',
  p_now date default current_date
)
returns table (
  product_data jsonb,
  current_price jsonb,
  relevance_score integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with request as (
    select
      public.catalog_search_normalize(left(coalesce(p_term, ''), 80)) as phrase,
      greatest(1, least(coalesce(p_page, 1), 500)) as page_number,
      greatest(1, least(coalesce(p_page_size, 20), 20)) as page_size,
      case
        when p_sort in ('relevance', 'price-asc', 'price-desc', 'name-asc')
          then p_sort
        else 'relevance'
      end as sort_mode
  ),
  request_tokens as (
    select
      r.*,
      regexp_split_to_array(r.phrase, E'\\s+') as tokens
    from request r
    where length(replace(r.phrase, ' ', '')) >= 2
  ),
  normalized_products as (
    select
      p.*,
      pp.price,
      pp.old_price,
      pp.is_offer,
      pp.offer_text,
      pp.valid_from,
      pp.valid_until,
      pp.fetched_at,
      pp.updated_at as price_updated_at,
      public.catalog_search_normalize(p.name) as normalized_name,
      public.catalog_search_normalize(p.brand) as normalized_brand,
      public.catalog_search_normalize(p.category) as normalized_category,
      public.catalog_search_normalize(p.product_type) as normalized_product_type,
      public.catalog_search_normalize(p.package_text) as normalized_package,
      regexp_split_to_array(public.catalog_search_normalize(p.name), E'\\s+') as name_tokens,
      regexp_split_to_array(public.catalog_search_normalize(p.brand), E'\\s+') as brand_tokens,
      regexp_split_to_array(public.catalog_search_normalize(p.category), E'\\s+') as category_tokens,
      regexp_split_to_array(public.catalog_search_normalize(p.product_type), E'\\s+') as product_type_tokens,
      regexp_split_to_array(public.catalog_search_normalize(p.package_text), E'\\s+') as package_tokens
    from public.products p
    left join public.product_prices pp on pp.product_id = p.id
    where p.supermarket = 'Hoogvliet'
      and (p_category is null or p.category = p_category)
      and (p_brand is null or p.brand = p_brand)
      and (p_max_price is null or pp.price <= p_max_price)
      and (
        not p_offers_only
        or (
          pp.is_offer is true
          and (pp.valid_from is null or pp.valid_from <= p_now)
          and (pp.valid_until is null or pp.valid_until >= p_now)
        )
      )
  ),
  candidates as (
    select np.*, rt.phrase, rt.tokens, rt.page_number, rt.page_size, rt.sort_mode
    from normalized_products np
    cross join request_tokens rt
    where not exists (
      select 1
      from unnest(rt.tokens) query_token
      where not (
        exists (select 1 from unnest(np.name_tokens) value_token where value_token like query_token || '%')
        or exists (select 1 from unnest(np.brand_tokens) value_token where value_token like query_token || '%')
        or exists (select 1 from unnest(np.category_tokens) value_token where value_token like query_token || '%')
        or exists (select 1 from unnest(np.product_type_tokens) value_token where value_token like query_token || '%')
        or exists (select 1 from unnest(np.package_tokens) value_token where value_token like query_token || '%')
      )
    )
  ),
  metrics as (
    select
      c.*,
      cardinality(c.tokens) as query_token_count,
      cardinality(c.name_tokens) as name_token_count,
      (select count(*)::integer from unnest(c.tokens) query_token where exists (
        select 1 from unnest(c.name_tokens) value_token where value_token like query_token || '%'
      )) as name_match_count,
      (select count(*)::integer from unnest(c.tokens) query_token where exists (
        select 1 from unnest(c.brand_tokens) value_token where value_token like query_token || '%'
      )) as brand_match_count,
      (select count(*)::integer from unnest(c.tokens) query_token where exists (
        select 1 from unnest(c.category_tokens) value_token where value_token like query_token || '%'
      )) as category_match_count,
      (select count(*)::integer from unnest(c.tokens) query_token where exists (
        select 1 from unnest(c.product_type_tokens) value_token where value_token like query_token || '%'
      )) as product_type_match_count,
      (select count(*)::integer from unnest(c.tokens) query_token where exists (
        select 1 from unnest(c.package_tokens) value_token where value_token like query_token || '%'
      )) as package_match_count,
      (select coalesce(sum(case when query_token = any(c.name_tokens) then 260 else 190 end), 0)::integer
        from unnest(c.tokens) query_token where exists (
          select 1 from unnest(c.name_tokens) value_token where value_token like query_token || '%'
        )) as name_token_score,
      (select coalesce(sum(case when query_token = any(c.product_type_tokens) then 240 else 180 end), 0)::integer
        from unnest(c.tokens) query_token where exists (
          select 1 from unnest(c.product_type_tokens) value_token where value_token like query_token || '%'
        )) as product_type_token_score,
      (select coalesce(sum(case when query_token = any(c.category_tokens) then 220 else 160 end), 0)::integer
        from unnest(c.tokens) query_token where exists (
          select 1 from unnest(c.category_tokens) value_token where value_token like query_token || '%'
        )) as category_token_score,
      (select coalesce(sum(case when query_token = any(c.brand_tokens) then 230 else 170 end), 0)::integer
        from unnest(c.tokens) query_token where exists (
          select 1 from unnest(c.brand_tokens) value_token where value_token like query_token || '%'
        )) as brand_token_score,
      (select coalesce(sum(case when query_token = any(c.package_tokens) then 60 else 35 end), 0)::integer
        from unnest(c.tokens) query_token where exists (
          select 1 from unnest(c.package_tokens) value_token where value_token like query_token || '%'
        )) as package_token_score,
      (select coalesce(sum(greatest(0, 280 - ((match_position - 1) * 45))), 0)::integer
        from unnest(c.tokens) query_token
        cross join lateral (
          select min(position)::integer as match_position
          from unnest(c.name_tokens) with ordinality as value_token(token, position)
          where value_token.token like query_token || '%'
        ) matched
        where matched.match_position is not null
      ) as name_position_score
    from candidates c
  ),
  scored as (
    select
      m.*,
      (
        case when m.normalized_name = m.phrase then 4000 else 0 end
        + case when m.normalized_name like m.phrase || ' %' then 2800 else 0 end
        + case when m.normalized_product_type = m.phrase then 2600 else 0 end
        + case
            when m.normalized_category = m.phrase or m.normalized_category like '% ' || m.phrase
              then 2400
            else 0
          end
        + case when m.normalized_brand = m.phrase then 2400 else 0 end
        + m.name_token_score + m.product_type_token_score
        + m.category_token_score + m.brand_token_score + m.package_token_score
        + m.name_position_score
        + case when m.name_match_count = m.query_token_count then 1300 else 0 end
        + case when m.product_type_match_count = m.query_token_count then 1200 else 0 end
        + case when m.category_match_count = m.query_token_count then 1100 else 0 end
        + case when m.brand_match_count = m.query_token_count then 1150 else 0 end
        + case when m.package_match_count = m.query_token_count then 150 else 0 end
        + case when m.name_match_count = m.query_token_count and m.product_type_match_count = m.query_token_count then 350 else 0 end
        + case when m.product_type_match_count = m.query_token_count and m.category_match_count = m.query_token_count then 2500 else 0 end
        + case when m.name_match_count = m.query_token_count and m.category_match_count = m.query_token_count then 700 else 0 end
        + case
            when m.name_match_count = m.query_token_count and m.name_token_count > 0
              then round(400.0 * m.query_token_count / m.name_token_count)::integer
            else 0
          end
        + 1200
      )::integer as score
    from metrics m
  )
  select
    jsonb_build_object(
      'id', s.id,
      'supermarket', s.supermarket,
      'sku', s.sku,
      'name', s.name,
      'brand', s.brand,
      'category', s.category,
      'product_type', s.product_type,
      'package_text', s.package_text,
      'weight_grams', s.weight_grams,
      'image_url', s.image_url,
      'source_url', s.source_url,
      'is_available', s.is_available,
      'updated_at', s.updated_at
    ) as product_data,
    case
      when s.price is null then null
      else jsonb_build_object(
        'product_id', s.id,
        'price', s.price,
        'old_price', s.old_price,
        'is_offer', s.is_offer,
        'offer_text', s.offer_text,
        'valid_from', s.valid_from,
        'valid_until', s.valid_until,
        'fetched_at', s.fetched_at,
        'updated_at', s.price_updated_at
      )
    end as current_price,
    s.score as relevance_score
  from scored s
  order by
    case when s.sort_mode = 'relevance' then s.score end desc nulls last,
    case when s.sort_mode = 'price-asc' then s.price end asc nulls last,
    case when s.sort_mode = 'price-desc' then s.price end desc nulls last,
    case when s.sort_mode = 'name-asc' then lower(s.name) end asc nulls last,
    lower(s.name) asc,
    s.id asc
  limit (select page_size + 1 from request_tokens)
  offset (select (page_number - 1) * page_size from request_tokens);
$$;

revoke all on function public.catalog_search_normalize(text) from public;
grant execute on function public.catalog_search_normalize(text) to anon, authenticated;

revoke all on function public.search_catalog_products_v2(
  text, integer, integer, text, text, boolean, numeric, text, date
) from public;
grant execute on function public.search_catalog_products_v2(
  text, integer, integer, text, text, boolean, numeric, text, date
) to anon, authenticated;

comment on function public.search_catalog_products_v2(
  text, integer, integer, text, text, boolean, numeric, text, date
) is
  'Generieke token-, context- en veldranking voor de read-only PWA-catalogus.';

commit;
