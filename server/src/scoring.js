export function getRating(percentage) {
  if (percentage >= 90) return "Excellent";
  if (percentage >= 80) return "Good";
  if (percentage >= 60) return "Low";
  return "Bad";
}

export function calculateScore(template, responses) {
  const totalScore = template.items.reduce((sum, item) => {
    const selected = Number(responses?.[item.id]?.score ?? 0);
    return sum + selected;
  }, 0);
  const maximumScore = template.items.reduce((sum, item) => sum + item.maxScore, 0);
  const percentage = maximumScore ? Number(((totalScore / maximumScore) * 100).toFixed(2)) : 0;
  return { totalScore, maximumScore, percentage, ratingStatus: getRating(percentage) };
}
