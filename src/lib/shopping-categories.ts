const CATEGORY_KEYWORDS: Array<{ category: string; keywords: string[] }> = [
  {
    category: "produce",
    keywords: [
      "gemuese",
      "gemuse",
      "salat",
      "spinat",
      "gurke",
      "tomate",
      "paprika",
      "karotte",
      "zwiebel",
      "kartoffel",
      "pilz",
      "brokkoli",
      "zucchini",
      "kohlenhydratarm",
    ],
  },
  {
    category: "fruit",
    keywords: [
      "apfel",
      "banane",
      "beere",
      "orange",
      "zitrone",
      "kiwi",
      "traube",
      "mango",
      "ananas",
      "birne",
    ],
  },
  {
    category: "dairy",
    keywords: [
      "milch",
      "joghurt",
      "quark",
      "käse",
      "kaese",
      "skyr",
      "butter",
      "sahne",
    ],
  },
  {
    category: "meat",
    keywords: [
      "haehnchen",
      "hahnchen",
      "pute",
      "rind",
      "hack",
      "lachs",
      "thunfisch",
      "fisch",
      "schinken",
      "wurst",
      "aufschnitt",
      "ei",
    ],
  },
  {
    category: "grains",
    keywords: [
      "reis",
      "nudel",
      "hafer",
      "müsli",
      "muesli",
      "brot",
      "toast",
      "mehl",
      "quinoa",
      "couscous",
    ],
  },
  {
    category: "drinks",
    keywords: [
      "wasser",
      "saft",
      "tee",
      "kaffee",
      "drink",
      "limonade",
      "monster",
      "energy",
      "energydrink",
    ],
  },
  {
    category: "snacks",
    keywords: ["nuss", "riegel", "chips", "schokolade", "cracker"],
  },
];

function normalizeLabel(label: string) {
  return label
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .trim();
}

export function resolveShoppingCategory(label: string) {
  const normalized = normalizeLabel(label);

  for (const group of CATEGORY_KEYWORDS) {
    if (group.keywords.some((keyword) => normalized.includes(keyword))) {
      return group.category;
    }
  }

  return "other";
}

export function getShoppingCategoryLabel(category: string) {
  if (category === "produce") return "Gemüse";
  if (category === "fruit") return "Obst";
  if (category === "dairy") return "Milchprodukte";
  if (category === "meat") return "Fleisch, Fisch & Eier";
  if (category === "grains") return "Getreide & Basics";
  if (category === "snacks") return "Snacks";
  if (category === "drinks") return "Getränke";
  return "Sonstiges";
}
