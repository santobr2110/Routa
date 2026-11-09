// Ficha da moto: marcas, modelos sugeridos e placa.
// As listas só SUGEREM (autocompletar); a pessoa pode digitar qualquer marca e modelo.
// Para aumentar a lista, é só acrescentar aqui.

/** Marcas vendidas no Brasil, em ordem alfabética. */
export const BIKE_BRANDS = [
  "Aprilia",
  "Avelloz",
  "Bajaj",
  "Benelli",
  "BMW",
  "CFMoto",
  "Dafra",
  "Ducati",
  "Haojue",
  "Harley-Davidson",
  "Honda",
  "Husqvarna",
  "Indian",
  "Kawasaki",
  "KTM",
  "Kymco",
  "Moto Guzzi",
  "MV Agusta",
  "Royal Enfield",
  "Shineray",
  "Suzuki",
  "Triumph",
  "Voge",
  "Yamaha",
  "Zontes",
] as const;

/** Modelos mais comuns por marca (sugestões do autocompletar). */
export const BIKE_MODELS: Record<string, readonly string[]> = {
  Bajaj: ["Dominar 160", "Dominar 200", "Dominar 250", "Dominar 400"],
  BMW: [
    "G 310 GS",
    "G 310 R",
    "F 750 GS",
    "F 800 GS",
    "F 850 GS",
    "F 900 GS",
    "F 900 R",
    "F 900 XR",
    "R 1250 GS",
    "R 1250 GS Adventure",
    "R 1300 GS",
    "R 1300 GS Adventure",
    "R 1250 RT",
    "R 18",
    "S 1000 RR",
    "S 1000 XR",
  ],
  CFMoto: ["450MT", "650MT", "800MT", "450NK", "650NK"],
  Ducati: ["DesertX", "Diavel V4", "Monster", "Multistrada V2", "Multistrada V4", "Panigale V4", "Scrambler"],
  "Harley-Davidson": [
    "Fat Bob",
    "Fat Boy",
    "Heritage Classic",
    "Low Rider S",
    "Nightster",
    "Pan America 1250",
    "Road Glide",
    "Road King",
    "Sportster S",
    "Street Bob",
    "Street Glide",
  ],
  Honda: [
    "ADV 160",
    "Africa Twin",
    "Biz 125",
    "Bros 160",
    "CB 300F Twister",
    "CB 500F",
    "CB 500X",
    "CB 650R",
    "CB 1000R",
    "CG 160",
    "Elite 125",
    "NC 750X",
    "NX 500",
    "PCX 160",
    "Pop 110i",
    "Sahara 300",
    "Transalp",
    "XRE 190",
    "XRE 300",
    "XR 300L Tornado",
  ],
  Kawasaki: ["Ninja 400", "Ninja 650", "Versys 650", "Versys 1000", "Vulcan S", "Z400", "Z650", "Z900", "Z900RS"],
  KTM: ["390 Adventure", "390 Duke", "790 Adventure", "890 Adventure", "890 Duke", "1290 Super Adventure"],
  "Royal Enfield": [
    "Classic 350",
    "Continental GT 650",
    "Guerrilla 450",
    "Himalayan 411",
    "Himalayan 450",
    "Hunter 350",
    "Interceptor 650",
    "Meteor 350",
    "Scram 411",
    "Shotgun 650",
    "Super Meteor 650",
  ],
  Suzuki: ["Burgman 125", "GSX-8S", "GSX-S750", "GSX-S1000", "Hayabusa", "V-Strom 250", "V-Strom 650", "V-Strom 800DE", "V-Strom 1050"],
  Triumph: [
    "Bonneville T100",
    "Bonneville T120",
    "Rocket 3",
    "Scrambler 400 X",
    "Speed 400",
    "Speed Triple",
    "Street Triple",
    "Tiger 660 Sport",
    "Tiger 850 Sport",
    "Tiger 900",
    "Tiger 1200",
    "Trident 660",
  ],
  Yamaha: [
    "Crosser 150",
    "Fazer 150",
    "Fazer FZ25",
    "Factor 150",
    "Lander 250",
    "MT-03",
    "MT-07",
    "MT-09",
    "NEO 125",
    "NMax 160",
    "R3",
    "Ténéré 700",
    "Tracer 7",
    "Tracer 900 GT",
    "XMax 250",
  ],
};

/** Modelos sugeridos para a marca digitada (ignora maiúsculas e acentos). */
export function modelsFor(brand: string): readonly string[] {
  const key = normalizeKey(brand);
  const found = Object.keys(BIKE_MODELS).find((b) => normalizeKey(b) === key);
  return found ? BIKE_MODELS[found] : [];
}

/** Marca da lista com a grafia oficial ("bmw" → "BMW"); se não estiver na lista, devolve como veio. */
export function canonicalBrand(brand: string): string {
  const key = normalizeKey(brand);
  return BIKE_BRANDS.find((b) => normalizeKey(b) === key) ?? brand.trim();
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

/**
 * Placa sem hífen e em maiúsculas, ou null se for inválida.
 * Aceita Mercosul (ABC1D23) e o modelo antigo (ABC-1234).
 */
export function normalizePlate(raw: string): string | null {
  const plate = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate) ? plate : null;
}

/** Placa para mostrar: antiga com hífen (ABC-1234), Mercosul sem (ABC1D23). */
export function formatPlate(plate: string): string {
  return /^[A-Z]{3}\d{4}$/.test(plate) ? `${plate.slice(0, 3)}-${plate.slice(3)}` : plate;
}

type BikeFields = {
  bike: string;
  bike_brand: string | null;
  bike_model: string | null;
  bike_year: number | null;
  bike_color: string | null;
};

/** "Honda XRE 300 · 2022 · vermelha". Inscrições antigas só têm o campo bike. */
export function describeBike(r: BikeFields): string {
  const name = r.bike_brand && r.bike_model ? `${r.bike_brand} ${r.bike_model}` : r.bike;
  return [name, r.bike_year, r.bike_color?.toLowerCase()].filter(Boolean).join(" · ");
}

/** Último ano aceito: o ano que vem (modelo do ano seguinte já vendido). */
export function maxBikeYear(now = new Date()): number {
  return now.getFullYear() + 1;
}
