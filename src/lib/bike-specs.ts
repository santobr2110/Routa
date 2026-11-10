// Tabela de modelos da Routa: cilindrada (cc) e estilo, para o Raio-X do comboio.
// Cobre os modelos sugeridos em bikes.ts. Modelo fora da lista: a pessoa escolhe a faixa.
// Para aumentar, é só acrescentar aqui (a chave ignora maiúsculas, acentos e espaços).

export type BikeStyle = "street" | "trail" | "sport" | "custom" | "scooter" | "touring";
export type CcBand = "up_to_300" | "300_700" | "700_1000" | "over_1000";

export const STYLE_LABELS: Record<BikeStyle, string> = {
  street: "Street / naked",
  trail: "Trail / big trail",
  sport: "Esportiva",
  custom: "Custom",
  scooter: "Scooter",
  touring: "Touring",
};

export const CC_BAND_LABELS: Record<CcBand, string> = {
  up_to_300: "Até 300cc",
  "300_700": "300 a 700cc",
  "700_1000": "700 a 1000cc",
  over_1000: "Mais de 1000cc",
};

type Spec = readonly [cc: number, style: BikeStyle];

const SPECS: Record<string, Record<string, Spec>> = {
  Bajaj: {
    "Dominar 160": [160, "street"],
    "Dominar 200": [199, "street"],
    "Dominar 250": [249, "street"],
    "Dominar 400": [373, "street"],
  },
  BMW: {
    "G 310 GS": [313, "trail"],
    "G 310 R": [313, "street"],
    "F 750 GS": [853, "trail"],
    "F 800 GS": [798, "trail"],
    "F 850 GS": [853, "trail"],
    "F 900 GS": [895, "trail"],
    "F 900 R": [895, "street"],
    "F 900 XR": [895, "touring"],
    "R 1250 GS": [1254, "trail"],
    "R 1250 GS Adventure": [1254, "trail"],
    "R 1300 GS": [1300, "trail"],
    "R 1300 GS Adventure": [1300, "trail"],
    "R 1250 RT": [1254, "touring"],
    "R 18": [1802, "custom"],
    "S 1000 RR": [999, "sport"],
    "S 1000 XR": [999, "touring"],
  },
  CFMoto: {
    "450MT": [449, "trail"],
    "650MT": [649, "trail"],
    "800MT": [799, "trail"],
    "450NK": [449, "street"],
    "650NK": [649, "street"],
  },
  Ducati: {
    DesertX: [937, "trail"],
    "Diavel V4": [1158, "custom"],
    Monster: [937, "street"],
    "Multistrada V2": [937, "trail"],
    "Multistrada V4": [1158, "trail"],
    "Panigale V4": [1103, "sport"],
    Scrambler: [803, "street"],
  },
  "Harley-Davidson": {
    "Fat Bob": [1868, "custom"],
    "Fat Boy": [1868, "custom"],
    "Heritage Classic": [1868, "custom"],
    "Low Rider S": [1923, "custom"],
    Nightster: [975, "custom"],
    "Pan America 1250": [1252, "trail"],
    "Road Glide": [1923, "touring"],
    "Road King": [1868, "touring"],
    "Sportster S": [1252, "custom"],
    "Street Bob": [1868, "custom"],
    "Street Glide": [1923, "touring"],
  },
  Honda: {
    "ADV 160": [157, "scooter"],
    "Africa Twin": [1084, "trail"],
    "Biz 125": [124, "scooter"],
    "Bros 160": [162, "trail"],
    "CB 300F Twister": [293, "street"],
    "CB 500F": [471, "street"],
    "CB 500X": [471, "trail"],
    "CB 650R": [649, "street"],
    "CB 1000R": [998, "street"],
    "CG 160": [162, "street"],
    "Elite 125": [124, "scooter"],
    "NC 750X": [745, "trail"],
    "NX 500": [471, "trail"],
    "PCX 160": [156, "scooter"],
    "Pop 110i": [109, "street"],
    "Sahara 300": [293, "trail"],
    Transalp: [755, "trail"],
    "XRE 190": [184, "trail"],
    "XRE 300": [291, "trail"],
    "XR 300L Tornado": [293, "trail"],
  },
  Kawasaki: {
    "Ninja 400": [399, "sport"],
    "Ninja 650": [649, "sport"],
    "Versys 650": [649, "trail"],
    "Versys 1000": [1043, "trail"],
    "Vulcan S": [649, "custom"],
    Z400: [399, "street"],
    Z650: [649, "street"],
    Z900: [948, "street"],
    Z900RS: [948, "street"],
  },
  KTM: {
    "390 Adventure": [373, "trail"],
    "390 Duke": [373, "street"],
    "790 Adventure": [799, "trail"],
    "890 Adventure": [889, "trail"],
    "890 Duke": [889, "street"],
    "1290 Super Adventure": [1301, "trail"],
  },
  "Royal Enfield": {
    "Classic 350": [349, "street"],
    "Continental GT 650": [648, "street"],
    "Guerrilla 450": [452, "street"],
    "Himalayan 411": [411, "trail"],
    "Himalayan 450": [452, "trail"],
    "Hunter 350": [349, "street"],
    "Interceptor 650": [648, "street"],
    "Meteor 350": [349, "custom"],
    "Scram 411": [411, "trail"],
    "Shotgun 650": [648, "custom"],
    "Super Meteor 650": [648, "custom"],
  },
  Suzuki: {
    "Burgman 125": [125, "scooter"],
    "GSX-8S": [776, "street"],
    "GSX-S750": [749, "street"],
    "GSX-S1000": [999, "street"],
    Hayabusa: [1340, "sport"],
    "V-Strom 250": [248, "trail"],
    "V-Strom 650": [645, "trail"],
    "V-Strom 800DE": [776, "trail"],
    "V-Strom 1050": [1037, "trail"],
  },
  Triumph: {
    "Bonneville T100": [900, "street"],
    "Bonneville T120": [1200, "street"],
    "Rocket 3": [2458, "custom"],
    "Scrambler 400 X": [398, "street"],
    "Speed 400": [398, "street"],
    "Speed Triple": [1160, "street"],
    "Street Triple": [765, "street"],
    "Tiger 660 Sport": [660, "trail"],
    "Tiger 850 Sport": [888, "trail"],
    "Tiger 900": [888, "trail"],
    "Tiger 1200": [1160, "trail"],
    "Trident 660": [660, "street"],
  },
  Yamaha: {
    "Crosser 150": [149, "trail"],
    "Fazer 150": [149, "street"],
    "Fazer FZ25": [249, "street"],
    "Factor 150": [149, "street"],
    "Lander 250": [249, "trail"],
    "MT-03": [321, "street"],
    "MT-07": [689, "street"],
    "MT-09": [890, "street"],
    "NEO 125": [125, "scooter"],
    "NMax 160": [155, "scooter"],
    R3: [321, "sport"],
    "Ténéré 700": [689, "trail"],
    "Tracer 7": [689, "touring"],
    "Tracer 900 GT": [890, "touring"],
    "XMax 250": [249, "scooter"],
  },
};

function key(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

const INDEX = new Map<string, { cc: number; style: BikeStyle }>();
for (const [brand, models] of Object.entries(SPECS)) {
  for (const [model, [cc, style]] of Object.entries(models)) {
    INDEX.set(`${key(brand)}|${key(model)}`, { cc, style });
  }
}

/** Cilindrada e estilo do modelo, ou null se não está na tabela. */
export function bikeSpec(brand: string, model: string): { cc: number; style: BikeStyle } | null {
  if (!brand.trim() || !model.trim()) return null;
  return INDEX.get(`${key(brand)}|${key(model)}`) ?? null;
}

/** Faixa de cilindrada (mesma regra do banco, save_convoy_profile). */
export function ccBand(cc: number): CcBand {
  return cc <= 300 ? "up_to_300" : cc <= 700 ? "300_700" : cc <= 1000 ? "700_1000" : "over_1000";
}
