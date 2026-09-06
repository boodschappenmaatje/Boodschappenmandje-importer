function baseURL(value) {
  const url = new URL(value);
  url.pathname = url.pathname.replace(/\/$/, "");
  if (!url.pathname.endsWith("/rest/v1")) url.pathname += "/rest/v1";
  return url;
}

function headers(secret, prefer) {
  const result = {
    apikey: secret,
    "Content-Type": "application/json",
    Prefer: prefer,
  };
  // Nieuwe sb_secret_-sleutels zijn gateway API keys, geen JWT's. Alleen de
  // oudere service-role JWT hoort tevens in Authorization.
  if (!secret.startsWith("sb_secret_")) result.Authorization = `Bearer ${secret}`;
  return result;
}

async function postJSON(url, secret, payload, prefer) {
  const response = await fetch(url, {
    method: "POST",
    headers: headers(secret, prefer),
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase ${response.status}: ${body.slice(0, 500)}`);
  }
  return body ? JSON.parse(body) : [];
}

function productPayload(product) {
  const payload = {
    supermarket: product.supermarket,
    sku: product.sku,
    name: product.name,
    package_text: product.packageText,
    source_url: product.sourceURL,
    updated_at: product.fetchedAt,
  };
  // Een niet-verkregen optioneel veld mag bestaande betrouwbare data niet
  // met null overschrijven. Bij een nieuw record blijven zulke kolommen null.
  if (product.brand != null) payload.brand = product.brand;
  if (product.category != null) payload.category = product.category;
  if (product.weightGrams != null) payload.weight_grams = product.weightGrams;
  if (product.imageURL != null) payload.image_url = product.imageURL;
  if (product.isAvailable != null) payload.is_available = product.isAvailable;
  return payload;
}

function pricePayload(productID, product) {
  return {
    product_id: productID,
    price: product.price,
    old_price: product.oldPrice,
    is_offer: product.isOffer,
    offer_text: product.offerText,
    valid_from: product.validFrom,
    valid_until: product.validUntil,
    fetched_at: product.fetchedAt,
    updated_at: product.fetchedAt,
  };
}

export async function upsertProducts(config, products) {
  const base = baseURL(config.supabaseURL);
  const imported = [];

  for (const product of products) {
    const productURL = new URL(`${base.pathname}/products`, base);
    productURL.searchParams.set("on_conflict", "supermarket,sku");
    productURL.searchParams.set("select", "id,sku,name");
    const rows = await postJSON(
      productURL,
      config.supabaseSecret,
      [productPayload(product)],
      "resolution=merge-duplicates,return=representation",
    );
    const stored = rows[0];
    if (!stored?.id || stored.sku !== product.sku) {
      throw new Error(`Supabase gaf geen veilig gekoppeld product_id terug voor SKU ${product.sku}.`);
    }

    const priceURL = new URL(`${base.pathname}/product_prices`, base);
    priceURL.searchParams.set("on_conflict", "product_id");
    priceURL.searchParams.set("select", "product_id,price,is_offer,updated_at");
    const priceRows = await postJSON(
      priceURL,
      config.supabaseSecret,
      [pricePayload(stored.id, product)],
      "resolution=merge-duplicates,return=representation",
    );
    const storedPrice = priceRows[0];
    if (storedPrice?.product_id !== stored.id || Number(storedPrice.price) !== product.price) {
      throw new Error(`Prijscontrole mislukte voor SKU ${product.sku}.`);
    }
    imported.push({ sku: product.sku, name: product.name, price: product.price });
  }

  return imported;
}
