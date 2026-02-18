export type IngredientConversionOverrides = {
  mlDensityGPerMl?: number | null;
  gramsPerPiece?: number | null;
  gramsPerHand?: number | null;
  gramsPerTeaspoon?: number | null;
  gramsPerTablespoon?: number | null;
  gramsPerPinch?: number | null;
  gramsPerCup?: number | null;
  gramsPerSlice?: number | null;
  gramsPerBunch?: number | null;
  gramsPerCan?: number | null;
};

export type UnitConversionWarningCode =
  | "UNKNOWN_UNIT"
  | "MISSING_DENSITY"
  | "MISSING_INGREDIENT_OVERRIDE"
  | "USED_DEFAULT";

export type UnitConversionWarning = {
  code: UnitConversionWarningCode;
  message: string;
};

type UnitConfig = {
  ratio?: number;
  kind: "weight" | "volume" | "piece";
  defaultOverrideKey?: keyof IngredientConversionOverrides;
};

type OverrideKey = keyof IngredientConversionOverrides;

const UNIT_CONFIG: Record<string, UnitConfig> = {
  g: { ratio: 1, kind: "weight" },
  gram: { ratio: 1, kind: "weight" },
  grams: { ratio: 1, kind: "weight" },
  kg: { ratio: 1000, kind: "weight" },
  ml: { ratio: 1, kind: "volume" },
  milliliter: { ratio: 1, kind: "volume" },
  millilitre: { ratio: 1, kind: "volume" },
  l: { ratio: 1000, kind: "volume" },
  liter: { ratio: 1000, kind: "volume" },
  litre: { ratio: 1000, kind: "volume" },
  hand: { kind: "piece", defaultOverrideKey: "gramsPerHand" },
  hands: { kind: "piece", defaultOverrideKey: "gramsPerHand" },
  hande: { kind: "piece", defaultOverrideKey: "gramsPerHand" },
  haende: { kind: "piece", defaultOverrideKey: "gramsPerHand" },
  hände: { kind: "piece", defaultOverrideKey: "gramsPerHand" },
  el: { kind: "piece", defaultOverrideKey: "gramsPerTablespoon" },
  tbsp: { kind: "piece", defaultOverrideKey: "gramsPerTablespoon" },
  essloeffel: { kind: "piece", defaultOverrideKey: "gramsPerTablespoon" },
  esslöffel: { kind: "piece", defaultOverrideKey: "gramsPerTablespoon" },
  tl: { kind: "piece", defaultOverrideKey: "gramsPerTeaspoon" },
  tsp: { kind: "piece", defaultOverrideKey: "gramsPerTeaspoon" },
  teeloeffel: { kind: "piece", defaultOverrideKey: "gramsPerTeaspoon" },
  teelöffel: { kind: "piece", defaultOverrideKey: "gramsPerTeaspoon" },
  stk: { kind: "piece", defaultOverrideKey: "gramsPerPiece" },
  stueck: { kind: "piece", defaultOverrideKey: "gramsPerPiece" },
  stück: { kind: "piece", defaultOverrideKey: "gramsPerPiece" },
  piece: { kind: "piece", defaultOverrideKey: "gramsPerPiece" },
  pieces: { kind: "piece", defaultOverrideKey: "gramsPerPiece" },
  prise: { kind: "piece", defaultOverrideKey: "gramsPerPinch" },
  pinch: { kind: "piece", defaultOverrideKey: "gramsPerPinch" },
  tasse: { kind: "piece", defaultOverrideKey: "gramsPerCup" },
  cup: { kind: "piece", defaultOverrideKey: "gramsPerCup" },
  scheibe: { kind: "piece", defaultOverrideKey: "gramsPerSlice" },
  slice: { kind: "piece", defaultOverrideKey: "gramsPerSlice" },
  bund: { kind: "piece", defaultOverrideKey: "gramsPerBunch" },
  bunch: { kind: "piece", defaultOverrideKey: "gramsPerBunch" },
  dose: { kind: "piece", defaultOverrideKey: "gramsPerCan" },
  can: { kind: "piece", defaultOverrideKey: "gramsPerCan" },
};

const DEFAULT_OVERRIDES: Record<OverrideKey, number> = {
  mlDensityGPerMl: 1,
  gramsPerPiece: 100,
  gramsPerHand: 50,
  gramsPerTeaspoon: 5,
  gramsPerTablespoon: 15,
  gramsPerPinch: 0.5,
  gramsPerCup: 240,
  gramsPerSlice: 30,
  gramsPerBunch: 60,
  gramsPerCan: 400,
};

export function normalizeUnit(unit: string) {
  return unit.trim().toLowerCase();
}

export function convertToGramsWithMetadata(args: {
  amount: number;
  unit: string;
  ingredient?: IngredientConversionOverrides;
}) {
  const normalizedUnit = normalizeUnit(args.unit);
  const config = UNIT_CONFIG[normalizedUnit];

  if (!config) {
    return {
      grams: null,
      warnings: [
        {
          code: "UNKNOWN_UNIT",
          message: `Nicht unterstützte Einheit: ${args.unit}`,
        } satisfies UnitConversionWarning,
      ],
      isEstimated: true,
    };
  }

  if (typeof config.ratio === "number") {
    if (config.kind === "volume") {
      const density =
        args.ingredient?.mlDensityGPerMl ?? DEFAULT_OVERRIDES.mlDensityGPerMl;
      return {
        grams: args.amount * config.ratio * density,
        warnings:
          args.ingredient?.mlDensityGPerMl == null
            ? [
                {
                  code: "USED_DEFAULT",
                  message: "Standard-Dichte verwendet (1 g/ml).",
                } satisfies UnitConversionWarning,
              ]
            : [],
        isEstimated: args.ingredient?.mlDensityGPerMl == null,
      };
    }

    return {
      grams: args.amount * config.ratio,
      warnings: [] as UnitConversionWarning[],
      isEstimated: false,
    };
  }

  const key = config.defaultOverrideKey;
  if (!key) {
    return {
      grams: null,
      warnings: [
        {
          code: "MISSING_INGREDIENT_OVERRIDE",
          message: `Keine Umrechnungskonfiguration für Einheit: ${args.unit}`,
        } satisfies UnitConversionWarning,
      ],
      isEstimated: true,
    };
  }

  const ingredientValue = args.ingredient?.[key];
  const fallbackValue = DEFAULT_OVERRIDES[key];
  const ratio = ingredientValue ?? fallbackValue;

  return {
    grams: args.amount * ratio,
    warnings:
      ingredientValue == null
        ? [
            {
              code: "USED_DEFAULT",
              message: `Standardwert für ${args.unit} verwendet.`,
            } satisfies UnitConversionWarning,
          ]
        : [],
    isEstimated: ingredientValue == null,
  };
}

export function convertToGrams(amount: number, unit: string) {
  const result = convertToGramsWithMetadata({ amount, unit });
  if (result.grams === null) {
    throw new Error(`Nicht unterstützte Einheit: ${unit}`);
  }
  return result.grams;
}

type NutritionPer100g = {
  fat?: number | null;
  carbs?: number | null;
  protein?: number | null;
  calories?: number | null;
  fiber?: number | null;
  sugar?: number | null;
  salt?: number | null;
};

function scaleNutritionValues(
  nutritionPer100g: NutritionPer100g,
  grams: number,
) {
  const factor = grams / 100;

  return {
    fat: (nutritionPer100g.fat ?? 0) * factor,
    carbs: (nutritionPer100g.carbs ?? 0) * factor,
    protein: (nutritionPer100g.protein ?? 0) * factor,
    calories: (nutritionPer100g.calories ?? 0) * factor,
    fiber: (nutritionPer100g.fiber ?? 0) * factor,
    sugar: (nutritionPer100g.sugar ?? 0) * factor,
    salt: (nutritionPer100g.salt ?? 0) * factor,
  };
}

export function calculateNutritionBy100g(args: {
  amount: number;
  unit: string;
  nutritionPer100g: NutritionPer100g;
}) {
  const grams = convertToGrams(args.amount, args.unit);

  return {
    grams,
    ...scaleNutritionValues(args.nutritionPer100g, grams),
  };
}

export function calculateNutritionBy100gWithConversion(args: {
  amount: number;
  unit: string;
  ingredient?: IngredientConversionOverrides;
  nutritionPer100g: NutritionPer100g;
}) {
  const conversion = convertToGramsWithMetadata({
    amount: args.amount,
    unit: args.unit,
    ingredient: args.ingredient,
  });

  if (conversion.grams === null) {
    return {
      grams: null,
      warnings: conversion.warnings,
      isEstimated: true,
      fat: 0,
      carbs: 0,
      protein: 0,
      calories: 0,
      fiber: 0,
      sugar: 0,
      salt: 0,
    };
  }

  return {
    grams: conversion.grams,
    warnings: conversion.warnings,
    isEstimated: conversion.isEstimated,
    ...scaleNutritionValues(args.nutritionPer100g, conversion.grams),
  };
}
