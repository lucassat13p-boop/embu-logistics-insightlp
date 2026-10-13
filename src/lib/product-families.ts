type ProductRow = { product: string | null };

const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

// Explicit whole-word rules, never material/brand similarity or fuzzy matching.
const families: [string, RegExp][] = [
  ["MASSA CORRIDA", /\bMASSA CORRIDA\b/], ["MASSA ACRÍLICA", /\bMASSA ACRILICA\b/],
  ["LAVA ROUPAS", /\bLAVA[ -]?ROUPAS\b/], ["CREME DE PENTEAR", /\bCREME (?:DE|PARA) PENTEAR\b/],
  ["PORTA-RETRATO", /\bPORTA[ -]?RETRATOS?\b/], ["TELA MOSQUITEIRA", /\bTELA MOSQUITEIRA\b/],
  ["PASTA DE AMENDOIM", /\bPASTA DE AMENDOIM\b/],
  ["TINTA", /\bTINTAS?\b/], ["ESPELHO", /\bESPELHOS?\b/], ["TORNEIRA", /\bTORNEIRAS?\b/],
  ["LÂMPADA", /\bLAMPADAS?\b/], ["TAÇA", /\bTACAS?\b/], ["COPO", /\bCOPOS?\b/],
  ["PRATO", /\bPRATOS?\b/], ["JARRA", /\bJARRAS?\b/], ["POTE", /\bPOTES?\b/],
  ["TIGELA", /\bTIGELAS?\b/], ["CHALEIRA", /\bCHALEIRAS?\b/], ["AQUÁRIO", /\bAQUARIOS?\b/],
  ["AMACIANTE", /\bAMACIANTES?\b/], ["SABONETE", /\bSABONETES?\b/],
  ["SHAMPOO", /\bSHAMPOOS?\b/], ["CONDICIONADOR", /\bCONDICIONADORES?\b/],
  ["MÁSCARA CAPILAR", /\bMASCARA (?:CAPILAR|DE HIDRATACAO)\b/],
  ["GELATINA CAPILAR", /\bGELATINA CAPILAR\b/], ["IMPERMEABILIZANTE", /\bIMPERMEABILIZANTES?\b/],
  ["RESINA", /\bRESINAS?\b/], ["MESA", /\bMESAS?\b/], ["QUADRO", /\bQUADROS?\b/],
  ["ESPÁTULA", /\bESPATULAS?\b/], ["PINCEL", /\b(?:PINCEL|PINCEIS)\b/],
  ["ROLO DE PINTURA", /\bROLOS? (?:DE|PARA) PINTURA\b/],
];

export function productFamily(product: string | null | undefined): string | null {
  if (!product?.trim()) return null;
  const name = normalized(product);
  // A product used "para" another object is not that object's family.
  const purpose = name.search(/\bPARA\b/);
  const matches = families.flatMap(([family, pattern]) => {
    const match = pattern.exec(name);
    const accessory = /\b(?:REMOVEDOR|DILUENTE|SUPORTE|CAPA|TAMPA|REFIL|ACESSORIO)\b/.test(name.slice(0, match?.index ?? 0));
    return match && !accessory && (purpose < 0 || match.index < purpose) ? [{ family, index: match.index }] : [];
  }).sort((a, b) => a.index - b.index);
  // Mixed bundles retain their full identity; do not assign one component's family.
  if (matches.length > 1 && /\+|\bE\b/.test(name.slice(matches[0]?.index ?? 0, matches[matches.length - 1]?.index))) return name;
  if (matches[0]) return matches[0].family;
  // "Vidro" as a material (e.g. jarra de vidro) never overrides the actual object.
  if (/^VIDROS?(?:\s|$)/.test(name)) return "VIDRO";
  return name;
}

export function countProductFamilies(rows: readonly ProductRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const family = productFamily(row.product);
    if (family) counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR"));
}