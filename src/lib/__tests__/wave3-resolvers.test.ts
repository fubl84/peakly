import { canUpdateEnrollmentVariants } from "@/lib/enrollment-service";
import { parseIngredientNutritionSuggestionResponse } from "@/lib/ai/ingredient-nutrition-suggestion";
import { getNutritionMatchResult } from "@/lib/nutrition-matching";
import {
  buildSlotNutritionTarget,
  getSlotRecipeMatches,
} from "@/lib/nutrition-slot-matching";
import {
  calculateNutritionBy100g,
  convertToGrams,
  convertToGramsWithMetadata,
} from "@/lib/unit-conversion";
import { resolveAssignmentsForEnrollmentWeek } from "@/lib/variant-resolver";
import { resolveEnrollmentWeek } from "@/lib/week-resolver";

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected '${expected}', got '${actual}'`);
  }
}

async function testSlotNutritionMatchingHelpers() {
  const target = buildSlotNutritionTarget([
    {
      amount: 100,
      unit: "g",
      ingredient: {
        fat: 4,
        carbs: 20,
        protein: 12,
        calories: 180,
        fiber: 1,
        sugar: 1,
        salt: 0.2,
        mlDensityGPerMl: null,
        gramsPerPiece: null,
        gramsPerHand: null,
        gramsPerTeaspoon: null,
        gramsPerTablespoon: null,
        gramsPerPinch: null,
        gramsPerCup: null,
        gramsPerSlice: null,
        gramsPerBunch: null,
        gramsPerCan: null,
      },
    },
  ]);

  assertEqual(
    target.calories,
    180,
    "Slot target calories should be calculated",
  );
  assertEqual(target.protein, 12, "Slot target protein should be calculated");

  const matches = getSlotRecipeMatches({
    target,
    recipes: [
      {
        id: "r1",
        name: "Nahe dran",
        calories: 186,
        protein: 12.5,
        carbs: 21,
        fat: 4.2,
      },
      {
        id: "r2",
        name: "Protein zu hoch",
        calories: 182,
        protein: 14,
        carbs: 21,
        fat: 4,
      },
    ],
    limit: 5,
  });

  assertEqual(
    matches.length,
    1,
    "Only recipes inside tolerance should be returned",
  );
  assertEqual(matches[0]?.id, "r1", "Closest valid recipe should be included");
}

async function testIngredientNutritionSuggestionParsing() {
  const validRaw = `{"found":true,"confidence":"MEDIUM","reason":"Näherungswert aus Datenbanktreffer.","nutritionPer100g":{"calories":250,"protein":10.5,"carbs":30,"fat":8,"fiber":4,"sugar":2.1,"salt":0.3},"conversionEstimates":{"mlDensityGPerMl":1,"gramsPerPiece":120,"gramsPerHand":55,"gramsPerTeaspoon":5,"gramsPerTablespoon":15,"gramsPerPinch":0.5,"gramsPerCup":240,"gramsPerSlice":30,"gramsPerBunch":70,"gramsPerCan":400},"needsAlternativeDescription":false,"suggestedAlternativeDescription":null}`;

  const parsed = parseIngredientNutritionSuggestionResponse(validRaw);

  assertEqual(parsed.found, true, "Suggestion parser should map found flag");
  assertEqual(
    parsed.nutritionPer100g.protein,
    10.5,
    "Suggestion parser should map protein value",
  );

  let invalidPayloadFailed = false;
  try {
    parseIngredientNutritionSuggestionResponse(
      '{"found":true,"confidence":"MEDIUM","reason":"ok","nutritionPer100g":{"calories":-1,"protein":1,"carbs":1,"fat":1,"fiber":1,"sugar":1,"salt":1},"conversionEstimates":{"mlDensityGPerMl":1,"gramsPerPiece":120,"gramsPerHand":55,"gramsPerTeaspoon":5,"gramsPerTablespoon":15,"gramsPerPinch":0.5,"gramsPerCup":240,"gramsPerSlice":30,"gramsPerBunch":70,"gramsPerCan":400},"needsAlternativeDescription":false,"suggestedAlternativeDescription":null}',
    );
  } catch {
    invalidPayloadFailed = true;
  }

  assertEqual(
    invalidPayloadFailed,
    true,
    "Suggestion parser should reject negative nutrition values",
  );
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function testWeekResolver() {
  const startDate = new Date("2026-01-01T00:00:00Z");

  const week1 = resolveEnrollmentWeek({
    startDate,
    referenceDate: new Date("2026-01-03T00:00:00Z"),
  });
  assertEqual(week1, 1, "Week resolver should return week 1 inside first week");

  const week3 = resolveEnrollmentWeek({
    startDate,
    referenceDate: new Date("2026-01-16T00:00:00Z"),
  });
  assertEqual(week3, 3, "Week resolver should progress weekly");

  const beforeStart = resolveEnrollmentWeek({
    startDate,
    referenceDate: new Date("2025-12-30T00:00:00Z"),
  });
  assertEqual(
    beforeStart,
    0,
    "Week resolver should return 0 before start date",
  );

  const capped = resolveEnrollmentWeek({
    startDate,
    referenceDate: new Date("2026-03-30T00:00:00Z"),
    maxWeeks: 8,
  });
  assertEqual(capped, 8, "Week resolver should cap by maxWeeks");

  const sameDay = resolveEnrollmentWeek({
    startDate,
    referenceDate: new Date("2026-01-01T00:00:00Z"),
  });
  assertEqual(sameDay, 1, "Week resolver should return week 1 on start date");

  const day7Boundary = resolveEnrollmentWeek({
    startDate,
    referenceDate: new Date("2026-01-08T00:00:00Z"),
  });
  assertEqual(
    day7Boundary,
    2,
    "Week resolver should move to week 2 exactly after 7 days",
  );

  const day14Boundary = resolveEnrollmentWeek({
    startDate,
    referenceDate: new Date("2026-01-15T00:00:00Z"),
  });
  assertEqual(
    day14Boundary,
    3,
    "Week resolver should move to week 3 exactly after 14 days",
  );

  const hardCap = resolveEnrollmentWeek({
    startDate,
    referenceDate: new Date("2026-02-20T00:00:00Z"),
    maxWeeks: 1,
  });
  assertEqual(hardCap, 1, "Week resolver should honor hard cap of 1 week");
}

async function testUnitConversion() {
  assertEqual(convertToGrams(2, "kg"), 2000, "kg conversion should be correct");
  assertEqual(
    convertToGrams(3, "hands"),
    150,
    "hands conversion should be correct",
  );
  assertEqual(convertToGrams(1, "EL"), 15, "EL conversion should be correct");
  assertEqual(convertToGrams(2, "TL"), 10, "TL conversion should be correct");
  assertEqual(
    convertToGrams(1, "HAND"),
    50,
    "HAND conversion should be correct",
  );
  assertEqual(
    convertToGrams(1, "Stk"),
    100,
    "STK conversion should be correct",
  );
  assertEqual(
    convertToGrams(2, "  stÜck  "),
    200,
    "Unit normalization should handle whitespace and umlaut casing",
  );
  assertEqual(convertToGrams(1.5, "L"), 1500, "L conversion should be correct");
  assertEqual(
    convertToGrams(2, "Dose"),
    800,
    "Dose default conversion should be correct",
  );
  assertEqual(
    convertToGrams(1, "Prise"),
    0.5,
    "Prise default conversion should be correct",
  );

  const handWithOverride = convertToGramsWithMetadata({
    amount: 2,
    unit: "HAND",
    ingredient: {
      gramsPerHand: 65,
    },
  });
  assertEqual(
    handWithOverride.grams,
    130,
    "Ingredient override should be used when provided",
  );
  assertEqual(
    handWithOverride.warnings.length,
    0,
    "Override conversion should not warn",
  );

  const handWithDefault = convertToGramsWithMetadata({
    amount: 2,
    unit: "HAND",
  });
  assertEqual(
    handWithDefault.grams,
    100,
    "Default hand conversion should be applied",
  );
  assertEqual(
    handWithDefault.warnings.length,
    1,
    "Default conversion should emit warning",
  );

  const nutrition = calculateNutritionBy100g({
    amount: 250,
    unit: "g",
    nutritionPer100g: {
      protein: 10,
      calories: 120,
    },
  });

  assertEqual(nutrition.grams, 250, "Nutrition grams should be normalized");
  assertEqual(nutrition.protein, 25, "Protein calculation should be scaled");
  assertEqual(nutrition.calories, 300, "Calories calculation should be scaled");

  const nutritionWithNulls = calculateNutritionBy100g({
    amount: 1,
    unit: "kg",
    nutritionPer100g: {
      fat: null,
      carbs: undefined,
      protein: null,
      calories: 50,
    },
  });
  assertEqual(
    nutritionWithNulls.grams,
    1000,
    "Nutrition grams should support non-gram input",
  );
  assertEqual(
    nutritionWithNulls.calories,
    500,
    "Nutrition scaling should support kg conversion",
  );
  assertEqual(
    nutritionWithNulls.fat,
    0,
    "Null nutrition values should default to zero",
  );
  assertEqual(
    nutritionWithNulls.carbs,
    0,
    "Undefined nutrition values should default to zero",
  );

  const unknownUnit = convertToGramsWithMetadata({
    amount: 1,
    unit: "bucket",
  });
  assertEqual(unknownUnit.grams, null, "Unknown unit should return null grams");
  assertEqual(
    unknownUnit.warnings[0]?.code,
    "UNKNOWN_UNIT",
    "Unknown unit should produce UNKNOWN_UNIT warning",
  );

  let unsupportedUnitFailed = false;
  try {
    convertToGrams(1, "bucket");
  } catch {
    unsupportedUnitFailed = true;
  }

  assertEqual(unsupportedUnitFailed, true, "Unsupported units must throw");
}

async function testNutritionMatching() {
  const closeMatch = getNutritionMatchResult({
    target: {
      calories: 600,
      carbs: 50,
      fat: 20,
      protein: 30,
    },
    candidate: {
      calories: 660,
      carbs: 55,
      fat: 17,
      protein: 33,
    },
  });

  assertEqual(
    closeMatch.isMatch,
    true,
    "Candidate within tolerance should match",
  );
  assertEqual(
    closeMatch.diffs.protein.percent,
    10,
    "Protein diff should be calculated in percent",
  );

  const proteinOutOfRange = getNutritionMatchResult({
    target: {
      calories: 600,
      carbs: 50,
      fat: 20,
      protein: 30,
    },
    candidate: {
      calories: 610,
      carbs: 52,
      fat: 19,
      protein: 34,
    },
  });

  assertEqual(
    proteinOutOfRange.isMatch,
    false,
    "Protein above 10% should fail even when other macros are close",
  );
}

async function testEnrollmentImmutabilityRule() {
  const startInFuture = canUpdateEnrollmentVariants(
    new Date(Date.now() + 24 * 60 * 60 * 1000),
    new Date(),
  );
  assertEqual(
    startInFuture,
    true,
    "Future enrollment should allow variant updates",
  );

  const started = canUpdateEnrollmentVariants(
    new Date(Date.now() - 24 * 60 * 60 * 1000),
    new Date(),
  );
  assertEqual(
    started,
    false,
    "Started enrollment should block variant updates",
  );
}

async function testVariantResolverFiltering() {
  const captured: Array<{ where: unknown; orderBy: unknown }> = [];

  const fakePrismaClient = {
    pathAssignment: {
      findMany: async (query: unknown) => {
        captured.push({
          where: (query as { where: unknown }).where,
          orderBy: (query as { orderBy: unknown }).orderBy,
        });
        return [{ id: "assignment-1" }];
      },
    },
  };

  const result = await resolveAssignmentsForEnrollmentWeek({
    prismaClient: fakePrismaClient as never,
    pathId: "path-1",
    week: 4,
    selectedVariantOptionIds: ["variant-1", "variant-2"],
  });

  assertEqual(
    Array.isArray(result),
    true,
    "Variant resolver should return assignment list",
  );
  assertEqual(captured.length, 1, "Variant resolver should execute a query");

  const firstWhere = captured[0].where as {
    pathId?: string;
    weekStart?: { lte?: number };
    weekEnd?: { gte?: number };
    OR?: unknown[];
    kind?: unknown;
  };

  assertEqual(
    firstWhere.pathId,
    "path-1",
    "Variant resolver should filter by pathId",
  );
  assertEqual(
    firstWhere.weekStart?.lte,
    4,
    "Variant resolver should apply weekStart <= selected week",
  );
  assertEqual(
    firstWhere.weekEnd?.gte,
    4,
    "Variant resolver should apply weekEnd >= selected week",
  );
  assertEqual(
    Array.isArray(firstWhere.OR),
    true,
    "Variant resolver should include OR variant filter",
  );
  assertEqual(
    Array.isArray(captured[0].orderBy),
    true,
    "Variant resolver should apply deterministic ordering",
  );

  await resolveAssignmentsForEnrollmentWeek({
    prismaClient: fakePrismaClient as never,
    pathId: "path-1",
    week: 5,
    selectedVariantOptionIds: [],
    kind: "NUTRITION",
  });

  assertEqual(
    captured.length,
    2,
    "Variant resolver should execute second query for kind-filter scenario",
  );

  const secondWhere = captured[1].where as {
    kind?: unknown;
    OR?: Array<{ variantOptionId?: unknown }>;
  };

  assertEqual(
    secondWhere.kind,
    "NUTRITION",
    "Variant resolver should pass through explicit kind filter",
  );

  const variantFilter = secondWhere.OR?.[1]?.variantOptionId as
    | { in?: unknown[] }
    | undefined;
  assert(
    Array.isArray(variantFilter?.in),
    "Variant resolver should still include variant in-filter when list is empty",
  );
  assertEqual(
    variantFilter?.in?.length,
    0,
    "Variant resolver should pass an empty variant list without crashing",
  );
}

async function main() {
  await testWeekResolver();
  await testUnitConversion();
  await testNutritionMatching();
  await testSlotNutritionMatchingHelpers();
  await testIngredientNutritionSuggestionParsing();
  await testEnrollmentImmutabilityRule();
  await testVariantResolverFiltering();
  console.log("Wave 3 unit tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
