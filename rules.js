(function (root, factory) {
  const rules = factory();
  if (typeof module === 'object' && module.exports) module.exports = rules;
  else root.MBTI_RULES = rules;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  function analyze(questions, dimensions, answers) {
    if (!Array.isArray(answers) || answers.length !== questions.length || answers.some(value => !Number.isInteger(value) || value < -2 || value > 2)) throw new Error('请先完成全部题目。');
    return dimensions.map(dimension => {
      let score = 0, maximum = 0;
      questions.forEach((question, index) => {
        if (question.dimension !== dimension.key) return;
        score += answers[index] * (question.pole === dimension.left ? 1 : -1);
        maximum += 2;
      });
      const leftPercent = Math.round(50 + score / maximum * 50);
      return { key: dimension.key, score, maximum, leftPercent, rightPercent: 100 - leftPercent, strength: Math.round(Math.abs(score) / maximum * 100), pole: score === 0 ? null : score > 0 ? dimension.left : dimension.right };
    });
  }
  function evaluate(questions, dimensions, answers, tieBreaks = {}) {
    const axes = analyze(questions, dimensions, answers);
    const unresolved = [];
    const letters = axes.map((axis, index) => {
      if (axis.pole) return axis.pole;
      const dimension = dimensions[index], choice = tieBreaks[axis.key];
      if (choice === dimension.left || choice === dimension.right) return choice;
      unresolved.push(axis.key); return '';
    });
    const baseCode = letters.slice(0, 4).every(Boolean) ? letters.slice(0, 4).join('') : null;
    const subtype = letters[4] || null;
    return { code: unresolved.length ? null : baseCode + '-' + subtype, baseCode, subtype, axes, unresolved };
  }
  return { analyze, evaluate };
});
