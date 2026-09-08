export const UNKNOWN_PRODUCT_TYPE = "Onbekend";

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesTerm(text, rawTerm) {
  const term = normalize(rawTerm);
  if (!term) return false;
  if (term.includes(" ")) return ` ${text} `.includes(` ${term} `);
  return text.split(" ").some((token) => (
    token === term || (term.length >= 4 && token.startsWith(term))
  ));
}

function matchesAny(text, terms = []) {
  return terms.some((term) => matchesTerm(text, term));
}

// Specifieke typen staan vóór brede typen. De regels beschrijven producten,
// nooit SKU's, merken als zelfstandig type of verpakkingsvarianten.
const rules = Object.freeze([
  { type: "Cola", terms: ["cola", "coca cola", "pepsi"] },
  { type: "Sinas", terms: ["sinas", "fanta", "orange frisdrank"] },
  { type: "Lemon-lime", terms: ["sprite", "7up", "seven up", "lemon lime"] },
  { type: "Ice tea", terms: ["ice tea", "icetea", "iced tea"] },
  { type: "Energy", terms: ["energy", "energydrink", "red bull", "monster"] },
  { type: "Water", terms: ["mineraalwater", "bronwater", "water"], excludes: ["waterijs", "watermeloen"] },
  { type: "Sap", terms: ["vruchtensap", "appelsap", "sinaasappelsap", "juice", "sap"] },
  { type: "Limonade", terms: ["limonade", "siroop"] },

  { type: "Vleeswaren", terms: ["vleeswaren", "achterham", "salami", "boterhamworst", "filet americain"] },
  { type: "Shoarma", terms: ["shoarma"] },
  { type: "Schnitzel", terms: ["schnitzel"] },
  { type: "Hamburger", terms: ["hamburger", "runderburger", "kipburger", "beef burger"] },
  { type: "Gehakt", terms: ["gehakt", "rundergehakt", "kipgehakt", "half om half"] },
  { type: "Spek", terms: ["spek", "bacon"], excludes: ["spekkoek"] },
  { type: "Kipfilet", terms: ["kipfilet"], excludes: ["vleeswaren", "broodbeleg"] },
  { type: "Kipdelen", terms: ["kipdij", "kippenpoot", "drumstick", "kipvleugel", "kippenvleugel"] },
  { type: "Worst", terms: ["rookworst", "braadworst", "knakworst", "saucijs", "worst"] },
  { type: "Varkensvlees", terms: ["varkens", "karbonade", "procureur"] },
  { type: "Rundvlees", terms: ["rundvlees", "biefstuk", "ribeye", "entrecote", "runderlap"] },
  { type: "Vis", terms: ["zalm", "tonijn", "kabeljauw", "visfilet", "vissticks", "garnalen"] },

  { type: "Yoghurt", terms: ["yoghurt"] },
  { type: "Kwark", terms: ["kwark"] },
  { type: "Vla", terms: ["vla"] },
  { type: "Boter/margarine", terms: ["margarine", "halvarine", "roomboter", "bakboter"] },
  { type: "Room", terms: ["slagroom", "kookroom", "creme fraiche", "room"], excludes: ["roomijs", "roomkaas"] },
  { type: "Melk", terms: ["melk", "karnemelk"] },
  { type: "Kaasbeleg", terms: ["smeerkaas", "kaasplakken", "plakken kaas"] },
  { type: "Kaas", terms: ["kaas", "roomkaas"], excludes: ["kaassaus", "cheesecake"] },

  { type: "Pindakaas", terms: ["pindakaas"] },
  { type: "Zoet beleg", terms: ["hagelslag", "chocopasta", "jam", "vruchtenbeleg", "appelstroop"] },
  { type: "Broodjes", terms: ["bolletjes", "broodjes", "croissant", "pistolet", "stokbrood"] },
  { type: "Brood", terms: ["volkorenbrood", "witbrood", "bruinbrood", "meergranenbrood", "brood"] },

  { type: "Friet", terms: ["friet", "patat"] },
  { type: "Aardappelen", terms: ["aardappel"] },
  { type: "Noedels", terms: ["noedels", "noodles", "bami"] },
  { type: "Pasta", terms: ["spaghetti", "macaroni", "lasagne", "penne", "fusilli", "tagliatelle", "pasta"], excludes: ["pastasaus"] },
  { type: "Rijst", terms: ["rijst", "nasi"] },

  { type: "Chips", terms: ["chips"] },
  { type: "Tomaat", terms: ["tomaat"], excludes: ["tomatensaus", "tomatenketchup", "tomatenpuree"] },
  { type: "Paprika", terms: ["paprika"], excludes: ["chips", "paprikapoeder"] },
  { type: "Ui", terms: ["uien", "uitjes", "ui"] },
  { type: "Komkommer", terms: ["komkommer"] },
  { type: "Wortel", terms: ["wortel", "peen"] },
  { type: "Sla", terms: ["slamelange", "ijsbergsla", "veldsla", "sla"] },
  { type: "Broccoli", terms: ["broccoli"] },
  { type: "Bloemkool", terms: ["bloemkool"] },
  { type: "Spinazie", terms: ["spinazie"] },
  { type: "Andijvie", terms: ["andijvie"] },
  { type: "Sperziebonen", terms: ["sperziebonen"] },
  { type: "Champignons", terms: ["champignon"] },
  { type: "Appel", terms: ["appel"], excludes: ["appelsap", "appelstroop"] },
  { type: "Banaan", terms: ["banaan"] },
  { type: "Peer", terms: ["peer"] },
  { type: "Druiven", terms: ["druif", "druiven"] },
  { type: "Citrusfruit", terms: ["sinaasappel", "mandarijn", "citroen", "limoen"] },
  { type: "Groente", terms: ["groente"] },
  { type: "Fruit", terms: ["fruit"] },

  { type: "Pastasaus", terms: ["pastasaus"] },
  { type: "Tomatensaus", terms: ["tomatensaus", "tomatenpuree"] },
  { type: "Mayonaise", terms: ["mayonaise", "fritessaus"] },
  { type: "Ketchup", terms: ["ketchup"] },
  { type: "Curry", terms: ["currysaus", "curry"] },
  { type: "Maaltijdmix", terms: ["maaltijdmix", "wereldgerecht", "mix voor", "basis voor"] },
  { type: "Kruiden", terms: ["kruiden", "kruidenmix", "specerijen"] },

  { type: "Diepvriessnacks", terms: ["kroket", "frikandel", "kipnuggets", "bitterballen", "kaassouffle"] },
  { type: "IJs", terms: ["roomijs", "waterijs", "ijslolly"] },
  { type: "Chocolade", terms: ["chocolade", "chocoladereep"] },
  { type: "Koek", terms: ["koek", "spekkoek", "biscuit"] },
  { type: "Snoep", terms: ["snoep", "winegums", "drop"] },
  { type: "Borrel-/zoutsnacks", terms: ["borrelnoot", "zoutjes", "popcorn", "nootjes"] },

  { type: "Koffie", terms: ["koffie", "espresso", "koffiebonen"] },
  { type: "Thee", terms: ["thee"], excludes: ["theedoek"] },
  { type: "Ontbijtgranen", terms: ["ontbijtgranen", "muesli", "cornflakes", "cruesli"] },
  { type: "Havermout", terms: ["havermout"] },
  { type: "Soep", terms: ["soep"] },
  { type: "Peulvruchten", terms: ["bonen", "linzen", "kikkererwten", "peulvruchten"] },
  { type: "Bakproducten", terms: ["bloem", "meel", "bakmix", "bakpoeder"] },
  { type: "Olie/azijn", terms: ["olijfolie", "zonnebloemolie", "azijn", "olie"], excludes: ["oliebol"] },

  { type: "Toiletpapier", terms: ["toiletpapier"] },
  { type: "Keukenpapier", terms: ["keukenpapier"] },
  { type: "Wasmiddel", terms: ["wasmiddel", "wasverzachter"] },
  { type: "Vaatwas", terms: ["vaatwastabletten", "vaatwasmiddel"] },
  { type: "Afwasmiddel", terms: ["afwasmiddel"] },
  { type: "Schoonmaakmiddel", terms: ["allesreiniger", "schoonmaakmiddel"] },
  { type: "Vuilniszakken", terms: ["vuilniszak", "afvalzak"] },
  { type: "Persoonlijke verzorging", terms: ["shampoo", "tandpasta", "douchegel"] },
  { type: "Luiers", terms: ["luier"] },
  { type: "Kattenvoer", terms: ["kattenvoer", "kattenbrok"] },
  { type: "Hondenvoer", terms: ["hondenvoer", "hondenbrok"] },
]);

export function classifyProductType(product) {
  const primaryText = normalize([product?.name, product?.brand, product?.category].filter(Boolean).join(" "));
  for (const rule of rules) {
    if (matchesAny(primaryText, rule.excludes)) continue;
    if (matchesAny(primaryText, rule.terms)) return rule.type;
  }

  // Zoekcontext is alleen een laatste, brede fallback. Een specifieke merk- of
  // verpakkingsvariant wordt daardoor nooit een zelfstandig producttype.
  const contextText = normalize(product?.searchTerm);
  for (const rule of rules) {
    if (matchesAny(contextText, rule.terms)) return rule.type;
  }
  return UNKNOWN_PRODUCT_TYPE;
}

export function productTypeCoverage(products) {
  const counts = new Map();
  let classified = 0;
  for (const product of products) {
    const productType = classifyProductType(product);
    counts.set(productType, (counts.get(productType) ?? 0) + 1);
    if (productType !== UNKNOWN_PRODUCT_TYPE) classified += 1;
  }
  return {
    total: products.length,
    classified,
    unknown: products.length - classified,
    percentage: products.length === 0 ? 0 : (classified / products.length) * 100,
    counts,
  };
}
