import { createPath } from "@/app/admin/paths/actions";
import { createEnrollmentAction } from "@/app/dashboard/actions";
import { upsertNutritionCalendarEntryAction } from "@/app/dashboard/planner/nutrition/actions";
import { upsertTrainingCalendarEntryAction } from "@/app/dashboard/planner/training/actions";
import { addRecipeIngredientsToShoppingListAction } from "@/app/dashboard/shopping-list/actions";
import { prisma } from "@/lib/prisma";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected '${expected}', got '${actual}'`);
  }
}

function buildFormData(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

type TestUser = {
  id: string;
  email: string;
  role: "ADMIN" | "USER";
};

type TestAssets = {
  adminUser: TestUser;
  appUser: TestUser;
  pathName: string;
  pathId: string;
  trainingPlanId: string;
  nutritionPlanId: string;
  recipeId: string;
  ingredientId: string;
};

async function createTestUser(args: {
  email: string;
  role: "ADMIN" | "USER";
}): Promise<TestUser> {
  const user = await prisma.user.create({
    data: {
      email: args.email,
      passwordHash: "test-hash",
      displayName: `${args.role} Test`,
      userRoles: {
        create: {
          role: {
            connectOrCreate: {
              where: { name: args.role },
              create: { name: args.role },
            },
          },
        },
      },
    },
    select: {
      id: true,
      email: true,
      userRoles: {
        select: {
          role: true,
        },
      },
    },
  });

  return {
    id: user.id,
    email: user.email,
    role: user.userRoles[0]?.role === "ADMIN" ? "ADMIN" : "USER",
  };
}

async function testAdminCreatesPathFlow(assets: TestAssets) {
  const createPathForm = new FormData();
  createPathForm.set("name", assets.pathName);
  createPathForm.set("description", "Wave 6 F-03 path flow test");
  createPathForm.append("trainingPlanIds", assets.trainingPlanId);
  createPathForm.append("nutritionPlanIds", assets.nutritionPlanId);

  await createPath(createPathForm, {
    session: {
      user: {
        id: assets.adminUser.id,
        role: "ADMIN",
        email: assets.adminUser.email,
      },
    },
    skipRevalidate: true,
  });

  const createdPath = await prisma.path.findUnique({
    where: { name: assets.pathName },
    include: { assignments: true },
  });

  assert(createdPath !== null, "Flow 1: admin should create a path");

  const trainingAssignment = createdPath?.assignments.find(
    (entry: { kind: string; contentRefId: string }) =>
      entry.kind === "TRAINING" && entry.contentRefId === assets.trainingPlanId,
  );
  const nutritionAssignment = createdPath?.assignments.find(
    (entry: { kind: string; contentRefId: string }) =>
      entry.kind === "NUTRITION" &&
      entry.contentRefId === assets.nutritionPlanId,
  );

  assert(
    trainingAssignment !== undefined,
    "Flow 1: training assignment should exist",
  );
  assert(
    nutritionAssignment !== undefined,
    "Flow 1: nutrition assignment should exist",
  );
}

async function testUserEnrollmentFlow(assets: TestAssets) {
  const enrollmentForm = buildFormData({
    pathId: assets.pathId,
    startDate: new Date().toISOString(),
  });

  await createEnrollmentAction(enrollmentForm, {
    session: {
      user: {
        id: assets.appUser.id,
        role: "USER",
        email: assets.appUser.email,
      },
    },
    skipRevalidate: true,
  });

  const enrollment = await prisma.userPathEnrollment.findFirst({
    where: {
      userId: assets.appUser.id,
      pathId: assets.pathId,
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
  });

  assert(
    enrollment !== null,
    "Flow 2: user should be enrolled in created path",
  );
}

async function testPlanningAndShoppingListFlow(assets: TestAssets) {
  const trainingForm = buildFormData({
    week: "1",
    dayOfWeek: "1",
    trainingPlanId: assets.trainingPlanId,
  });

  await upsertTrainingCalendarEntryAction(trainingForm, {
    session: {
      user: {
        id: assets.appUser.id,
        role: "USER",
        email: assets.appUser.email,
      },
    },
    skipRevalidate: true,
  });

  const nutritionForm = buildFormData({
    week: "1",
    dayOfWeek: "1",
    mealType: "MORNING",
    recipeId: assets.recipeId,
  });

  await upsertNutritionCalendarEntryAction(nutritionForm, {
    session: {
      user: {
        id: assets.appUser.id,
        role: "USER",
        email: assets.appUser.email,
      },
    },
    skipRevalidate: true,
  });

  const addRecipeForm = buildFormData({
    week: "1",
    recipeId: assets.recipeId,
  });

  await addRecipeIngredientsToShoppingListAction(addRecipeForm, {
    session: {
      user: {
        id: assets.appUser.id,
        role: "USER",
        email: assets.appUser.email,
      },
    },
    skipRevalidate: true,
  });

  await addRecipeIngredientsToShoppingListAction(addRecipeForm, {
    session: {
      user: {
        id: assets.appUser.id,
        role: "USER",
        email: assets.appUser.email,
      },
    },
    skipRevalidate: true,
  });

  const enrollment = await prisma.userPathEnrollment.findFirst({
    where: {
      userId: assets.appUser.id,
      pathId: assets.pathId,
      isActive: true,
    },
    orderBy: { createdAt: "desc" },
  });

  assert(
    enrollment !== null,
    "Flow 3: active enrollment should exist for shopping list",
  );

  const shoppingList = await prisma.userShoppingList.findUnique({
    where: {
      enrollmentId_week: {
        enrollmentId: enrollment!.id,
        week: 1,
      },
    },
    include: {
      items: {
        where: { sourceRecipeId: assets.recipeId },
      },
    },
  });

  assert(
    shoppingList !== null,
    "Flow 3: shopping list should be generated for week 1",
  );
  assertEqual(
    shoppingList?.items.length,
    1,
    "Flow 3: recipe ingredient should be deduped into one shopping list item",
  );

  const dedupedItem = shoppingList?.items[0];
  assert(
    dedupedItem !== undefined,
    "Flow 3: deduped shopping list item should exist",
  );
  assertEqual(
    dedupedItem?.amount,
    400,
    "Flow 3: amount should be aggregated when importing recipe twice",
  );
}

async function createAssets(token: string): Promise<TestAssets> {
  const adminUser = await createTestUser({
    email: `f03-admin-${token}@test.local`,
    role: "ADMIN",
  });
  const appUser = await createTestUser({
    email: `f03-user-${token}@test.local`,
    role: "USER",
  });

  const ingredient = await prisma.ingredient.create({
    data: {
      name: `F03 Ingredient ${token}`,
      calories: 100,
      carbs: 10,
      protein: 10,
      fat: 5,
    },
    select: { id: true },
  });

  const trainingPlan = await prisma.trainingPlan.create({
    data: {
      name: `F03 Training ${token}`,
      internalName: `f03-training-${token}`,
      weekStart: 1,
      weekEnd: 1,
    },
    select: { id: true },
  });

  const nutritionPlan = await prisma.nutritionPlan.create({
    data: {
      name: `F03 Nutrition ${token}`,
      internalName: `f03-nutrition-${token}`,
      weekStart: 1,
      weekEnd: 1,
    },
    select: { id: true },
  });

  await prisma.nutritionPlanMealEntry.create({
    data: {
      nutritionPlanId: nutritionPlan.id,
      mealType: "MORNING",
      ingredientId: ingredient.id,
      amount: 200,
      unit: "G",
    },
  });

  const recipe = await prisma.recipe.create({
    data: {
      name: `F03 Recipe ${token}`,
      internalName: `f03-recipe-${token}`,
      ingredients: {
        create: [
          {
            ingredientId: ingredient.id,
            amount: 200,
            unit: "G",
          },
        ],
      },
      steps: {
        create: [
          {
            position: 1,
            description: "Mischen und servieren",
          },
        ],
      },
    },
    select: { id: true },
  });

  return {
    adminUser,
    appUser,
    pathName: `F03 Path ${token}`,
    pathId: "",
    trainingPlanId: trainingPlan.id,
    nutritionPlanId: nutritionPlan.id,
    recipeId: recipe.id,
    ingredientId: ingredient.id,
  };
}

async function cleanupAssets(token: string) {
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [`f03-admin-${token}@test.local`, `f03-user-${token}@test.local`],
      },
    },
  });

  await prisma.path.deleteMany({
    where: {
      name: `F03 Path ${token}`,
    },
  });

  await prisma.recipe.deleteMany({
    where: {
      internalName: `f03-recipe-${token}`,
    },
  });

  await prisma.nutritionPlan.deleteMany({
    where: {
      internalName: `f03-nutrition-${token}`,
    },
  });

  await prisma.trainingPlan.deleteMany({
    where: {
      internalName: `f03-training-${token}`,
    },
  });

  await prisma.ingredient.deleteMany({
    where: {
      name: `F03 Ingredient ${token}`,
    },
  });
}

async function main() {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let assets: TestAssets | null = null;

  try {
    assets = await createAssets(token);

    await testAdminCreatesPathFlow(assets);

    const createdPath = await prisma.path.findUnique({
      where: { name: assets.pathName },
      select: { id: true },
    });
    assert(createdPath !== null, "Path should exist after admin flow");
    assets.pathId = createdPath!.id;

    await testUserEnrollmentFlow(assets);
    await testPlanningAndShoppingListFlow(assets);

    console.log("Wave 6 F-03 E2E flow tests passed");
  } finally {
    await cleanupAssets(token);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
