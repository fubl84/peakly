export function parseSetIndex(block: string) {
  const match = /^SET-(\d+)$/.exec(block);
  return match ? Number(match[1]) : null;
}

export function getTrainingBlockRank(block: string) {
  if (block === "WARMUP") return 1;

  const setIndex = parseSetIndex(block);
  if (setIndex !== null) {
    return 100 + setIndex;
  }

  if (block === "COOLDOWN") return 1000;

  return 500;
}

export function compareTrainingBlockOrder(left: string, right: string) {
  return getTrainingBlockRank(left) - getTrainingBlockRank(right);
}

export function compareTrainingExerciseOrder(
  left: { block: string; position: number },
  right: { block: string; position: number },
) {
  const blockDiff = compareTrainingBlockOrder(left.block, right.block);
  if (blockDiff !== 0) {
    return blockDiff;
  }

  return left.position - right.position;
}
