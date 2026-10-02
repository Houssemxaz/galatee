export function calculatePromotionDiscountCents(amountCents, rewardType, rewardValue) {
  const amount = Math.max(0, Math.trunc(Number(amountCents) || 0));
  const value = Math.max(0, Math.trunc(Number(rewardValue) || 0));
  if (rewardType === "fixed") return Math.min(amount, value * 100);
  return Math.min(amount, Math.floor(amount * value / 100));
}

export function getBestPromotion(lines, promotions = []) {
  if (!Array.isArray(lines) || !lines.length || !Array.isArray(promotions)) return null;
  return promotions
    .filter((promotion) => promotion?.active !== false)
    .map((promotion) => previewPromotion(promotion, lines))
    .filter(Boolean)
    .sort((left, right) => right.discountCents - left.discountCents)[0] || null;
}

export function previewPromotion(promotion, lines) {
  const targetIds = promotion?.targetIds || [];
  const eligibleLines = lines.filter((line) => targetIds.includes(line.id || line.productId));
  if (!eligibleLines.length) return null;
  if (promotion.scope === "pack") {
    const presentIds = new Set(eligibleLines.filter((line) => line.quantity > 0).map((line) => line.id || line.productId));
    if (targetIds.length < 2 || targetIds.some((id) => !presentIds.has(id))) return null;
  }
  const eligibleAmountCents = eligibleLines.reduce((sum, line) => sum + Math.max(0, Math.trunc(Number(line.lineTotal ?? line.lineTotalCents) || 0)), 0);
  if (eligibleAmountCents <= 0) return null;
  const discountCents = promotion.scope === "items"
    ? eligibleLines.reduce((sum, line) => {
        const lineAmount = Math.max(0, Math.trunc(Number(line.lineTotal ?? line.lineTotalCents) || 0));
        if (promotion.rewardType !== "fixed") return sum + calculatePromotionDiscountCents(lineAmount, promotion.rewardType, promotion.rewardValue);
        return sum + Math.min(lineAmount, Math.max(1, Number(line.quantity) || 1) * Number(promotion.rewardValue || 0) * 100);
      }, 0)
    : calculatePromotionDiscountCents(eligibleAmountCents, promotion.rewardType, promotion.rewardValue);
  if (discountCents <= 0) return null;
  return {
    id: promotion.id,
    title: promotion.title,
    description: promotion.description || "",
    rewardType: promotion.rewardType,
    rewardValue: promotion.rewardValue,
    scope: promotion.scope,
    targetIds,
    eligibleAmountCents,
    discountCents,
  };
}
