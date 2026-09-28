export function calculateRewardDiscountCents(amountCents, rewardType, rewardValue) {
  const amount = Math.max(0, Math.trunc(Number(amountCents) || 0));
  const value = Math.max(0, Math.trunc(Number(rewardValue) || 0));
  if (rewardType === "fixed") return Math.min(amount, value * 100);
  return Math.min(amount, Math.floor(amount * value / 100));
}

export function rewardCalculationLabel(amountCents, rewardType, rewardValue, format) {
  const amount = Math.max(0, Math.trunc(Number(amountCents) || 0));
  const value = Math.max(0, Math.trunc(Number(rewardValue) || 0));
  const discount = calculateRewardDiscountCents(amount, rewardType, value);
  const after = Math.max(0, amount - discount);
  if (rewardType === "fixed") {
    return `${format(amount)} − ${format(value * 100)} = ${format(after)}`;
  }
  return `${format(amount)} − ${value}% = ${format(after)}`;
}

export function getEligibleLines(lines, settings) {
  const eligibleIds = settings?.eligibleDishIds || [];
  if (!eligibleIds.length) return lines;
  return lines.filter((line) => eligibleIds.includes(line.id));
}

export function isRewardApplicable(lines, settings) {
  if (!lines.length) return false;
  const eligibleIds = settings?.eligibleDishIds || [];
  if (!eligibleIds.length) return true;
  const eligibleLines = getEligibleLines(lines, settings);
  if (settings?.rewardScope === "pack") {
    return eligibleIds.length >= 2 && eligibleIds.every((id) => eligibleLines.some((line) => line.id === id && line.quantity > 0));
  }
  return eligibleLines.some((line) => line.quantity > 0);
}

export function getMissingEligibleTitles(lines, menu, settings) {
  if (settings?.rewardScope !== "pack") return [];
  const eligibleIds = settings?.eligibleDishIds || [];
  return menu
    .filter((item) => eligibleIds.includes(item.id) && !lines.some((line) => line.id === item.id && line.quantity > 0))
    .map((item) => item.title);
}
