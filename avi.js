// Shared one-ply evaluator for the browser and training CLI.
(function () {
  const isNode = typeof module !== 'undefined' && typeof require === 'function';
  const G = isNode ? require('./script.js') : { RULES_VERSION, other };
  const engine = isNode ? require('./ai.js') : window.AI;
  const spatial = isNode ? require('./spatial.js') : window.Spatial;

  const abilities = spatial.abilities.filter(id => id !== 'block');
  const abilityIndex = new Map(abilities.map((id, i) => [id, i]));

  function features(st, me) {
    const scores = [1];
    for (const color of [me, G.other(me)]) {
      const p = st.players[color];
      const offset = scores.length;
      scores.push(
        Math.log1p(engine.lineScore(st.board, color)) / 8,
        Math.log1p(engine.specialScore(st.board, color)) / 8,
        p.bag.length / 20, p.hand.length / 3,
        Number(st.sealed === color), Number(st.chainTurn === color),
        Number(st.jammed === color), 0, 0, 0,
        ...Array(abilities.length * 2).fill(0),
      );
      for (const card of p.hand) scores[offset + 10 + (abilityIndex.get(card.ability) ?? 0)] += 1 / 3;
      for (const row of st.board) {
        for (const stone of row) {
          if (!stone || stone.color !== color) continue;
          scores[offset + 7] += 1 / 20;
          if (stone.ability === 'timeBomb') scores[offset + 8] += 1 / (stone.fuse ?? 2);
          if (stone.ability === 'grow') scores[offset + 9] += (stone.age ?? 0) % 2;
          if (stone.ability !== 'block') scores[offset + 10 + abilities.length + (abilityIndex.get(stone.ability) ?? 0)] += 1 / 4;
        }
      }
    }
    return scores;
  }

  function outcome(st, me) {
    if (st.phase === 'end') return st.winner ? (st.winner === me ? 1 : -1) : 0;
    return { sign: st.turn === me ? 1 : -1, x: features(st, st.turn) };
  }

  function chooseMove(weights) {
    let best = null;
    for (const { move, outcomes } of engine.onePlyOutcomes(outcome)) {
      const value = outcomes.reduce((sum, o) => sum + predict(weights, o), 0) / outcomes.length;
      if (!best || value > best.value) best = { move, value };
    }
    return best?.move;
  }

  function predict(weights, o) {
    if (typeof o === 'number') return o;
    return o.sign * Math.tanh(o.x.reduce((value, x, i) => value + x * weights[i], 0));
  }

  function modelWeights({ weights, rulesVersion }) {
    if (!Number.isInteger(rulesVersion) || rulesVersion < 2 || rulesVersion > G.RULES_VERSION
        || weights.length !== 1 + 2 * (10 + abilities.length * 2)
        || weights.some((weight) => !Number.isFinite(weight))) throw new Error('Incompatible weights');
    return weights;
  }

  const AVI = { chooseMove, modelWeights, features, outcome, predict };
  if (isNode) module.exports = AVI;
  else window.AVI = AVI;
})();
