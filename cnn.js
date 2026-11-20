// JavaScript inference for the Metal-trained board value network.
(function () {
  const node = typeof module !== 'undefined' && typeof require === 'function';
  const G = node ? require('./script.js') : { SIZE, RULES_VERSION, state, withSimulationRandom };
  const Spatial = node ? require('./spatial.js') : window.Spatial;
  const AVI = node ? require('./avi.js') : window.AVI;
  const AI = node ? require('./ai.js') : window.AI;
  const Tactics = node ? require('./tactics.js') : window.Tactics;
  const area = G.SIZE * G.SIZE;
  const neighbors = Array.from({ length: area }, (_, p) => {
    const x = p % G.SIZE, y = Math.floor(p / G.SIZE);
    const result = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (x + dx < 0 || x + dx >= G.SIZE || y + dy < 0 || y + dy >= G.SIZE) continue;
      result.push([p + dy * G.SIZE + dx, (dy + 1) * 3 + dx + 1]);
    }
    return result;
  });

  function convolution(weights, prefix, inputChannels, channels, relu = true) {
    const raw = weights[prefix + '.weight'];
    const bias = weights[prefix + '.bias'];
    const kernel = new Float32Array(9 * inputChannels * channels);
    for (let k = 0; k < 9; k++) for (let i = 0; i < inputChannels; i++) for (let o = 0; o < channels; o++) {
      kernel[(k * inputChannels + i) * channels + o] = raw[o][Math.floor(k / 3)][k % 3][i];
    }
    return (input, output) => {
      for (let p = 0; p < area; p++) {
        const offset = p * channels;
        output.set(bias, offset);
        for (const [position, k] of neighbors[p]) {
          const source = position * inputChannels;
          const start = k * inputChannels * channels;
          for (let i = 0; i < inputChannels; i++) {
            const value = input[source + i];
            if (value === 0) continue;
            const index = start + i * channels;
            for (let o = 0; o < channels; o++) output[offset + o] += value * kernel[index + o];
          }
        }
        if (relu) for (let o = 0; o < channels; o++) output[offset + o] = Math.max(0, output[offset + o]);
      }
    };
  }

  function linear(weights, key, input, relu = false) {
    return weights[key + '.weight'].map((row, i) => {
      let value = weights[key + '.bias'][i];
      for (let j = 0; j < row.length; j++) value += row[j] * input[j];
      return relu ? Math.max(0, value) : value;
    });
  }

  function directionalLayer(weights, channels) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    const indices = directions.map(([dy, dx]) => Array.from({ length: area }, (_, p) => {
      const y = Math.floor(p / G.SIZE), x = p % G.SIZE;
      return [-2, -1, 0, 1, 2].map(k => {
        const py = y + k * dy, px = x + k * dx;
        return px < 0 || px >= G.SIZE || py < 0 || py >= G.SIZE ? -1 : (py * G.SIZE + px) * 14;
      });
    }));
    const w = weights['directional.weight'], b = weights['directional.bias'];
    return (input, output) => {
      for (let p = 0; p < area; p++) for (let o = 0; o < channels; o++) {
        let value = b[o];
        const positions = indices[Math.floor(4 * o / channels)][p];
        for (let k = 0; k < 5; k++) {
          if (positions[k] < 0) continue;
          for (let c = 0; c < 14; c++) value += w[o][14 * k + c] * input[positions[k] + c];
        }
        output[p * channels + o] = Math.max(0, value);
      }
    };
  }

  function attentionSummary(weights, spatial, context, channels, cross) {
    const blocks = [[0, 4], [4, 8], [8, 11]];
    const tokens = [];
    for (const [y0, y1] of blocks) for (const [x0, x1] of blocks) {
      const token = [...weights.positions[tokens.length]];
      const count = (y1 - y0) * (x1 - x0);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        for (let c = 0; c < channels; c++) token[c] += spatial[(y * G.SIZE + x) * channels + c] / count;
      }
      tokens.push(token);
    }
    const n = Spatial.abilitiesPerColor - 1;
    const hand = [...context.slice(11, 11 + n), ...context.slice(21 + 2 * n, 21 + 3 * n)];
    const counts = [...hand.map(value => value * 3), 1];
    const active = cross ? counts.flatMap((count, i) => count > 0 ? [i] : []) : tokens.map((_, i) => i);
    const inputs = active.map(i => cross ? weights['ability_encoder.weight'][i] : tokens[i]);
    const keys = inputs.map(input => linear(weights, 'key', input));
    const values = inputs.map(input => linear(weights, 'attention_value', input));
    const mean = Array(channels).fill(0), max = Array(channels).fill(-Infinity);
    for (const token of tokens) {
      const query = linear(weights, 'query', token);
      const logits = keys.map((key, i) => {
        let dot = 0;
        for (let c = 0; c < channels; c++) dot += query[c] * key[c];
        return dot / Math.sqrt(channels) + (cross ? Math.log(Math.max(1, counts[active[i]])) : 0);
      });
      const peak = Math.max(...logits);
      const probs = logits.map(logit => Math.exp(logit - peak));
      const sum = probs.reduce((a, b) => a + b, 0);
      const mixed = Array(channels).fill(0);
      for (let i = 0; i < values.length; i++) for (let c = 0; c < channels; c++) {
        mixed[c] += values[i][c] * probs[i] / sum;
      }
      const out = linear(weights, 'attention_out', mixed);
      for (let c = 0; c < channels; c++) {
        const v = token[c] + out[c];
        mean[c] += v / tokens.length;
        max[c] = Math.max(max[c], v);
      }
    }
    if (cross) return [...mean, ...max];
    return [...mean, ...max, ...linear(weights, 'hand_out', linear(weights, 'hand_hidden', hand, true), true)];
  }

  function evaluator(model) {
    if (!['spatial-value-v1', 'spatial-value-v2', 'spatial-value-v3'].includes(model.type)
        || !Number.isInteger(model.rulesVersion) || model.rulesVersion < 2 || model.rulesVersion > G.RULES_VERSION
        || model.vocabulary !== Spatial.vocabulary) {
      throw new Error('Incompatible spatial model');
    }
    const w = model.weights;
    const architecture = model.architecture ?? 'cnn';
    if (!['cnn', 'se', 'attention', 'directional', 'cross'].includes(architecture)) {
      throw new Error('Unknown spatial architecture');
    }
    const channels = model.channels ?? 12;
    const embedding = w['embedding.weight'];
    const dualColor = model.type !== 'spatial-value-v1';
    const inputChannels = dualColor ? 14 : 12;
    const conv1 = architecture === 'directional' ? directionalLayer(w, channels)
      : convolution(w, 'conv1', inputChannels, channels);
    const conv2 = convolution(w, 'conv2', channels, channels);
    const conv3 = model.type === 'spatial-value-v3' ? convolution(w, 'conv3', channels, channels) : null;
    const input = new Float32Array(area * Math.max(inputChannels, channels));
    const hidden = new Float32Array(area * channels);
    const residual = architecture === 'se' ? convolution(w, 'residual', channels, channels, false) : null;
    const branch = residual && new Float32Array(area * channels);
    const pooled = new Float32Array(w['hidden.weight'][0].length);

    function predict(board, context) {
      for (let p = 0; p < area; p++) {
        const i = p * inputChannels, j = p * 4;
        const piece = board[j];
        input.set(embedding[piece], i);
        input[i + 8] = Number(board[j + 1] === 1);
        input[i + 9] = Number(board[j + 1] === 2);
        input[i + 10] = board[j + 2] / 2;
        input[i + 11] = board[j + 3] / 7;
        if (dualColor) {
          const size = Spatial.abilitiesPerColor;
          const joker = piece > 0 && (piece - 1) % size === Spatial.jokerIndex;
          input[i + 12] = Number(joker || (piece > 0 && piece <= size));
          input[i + 13] = Number(joker || (piece > size && piece <= 2 * size));
        }
      }
      conv1(input, hidden);
      conv2(hidden, input);
      if (residual) {
        residual(input, branch);
        const mean = Array(channels).fill(0);
        for (let i = 0; i < branch.length; i++) mean[i % channels] += branch[i] / area;
        const gate = linear(w, 'se_expand', linear(w, 'se_reduce', mean, true)).map(v => 1 / (1 + Math.exp(-v)));
        for (let i = 0; i < branch.length; i++) input[i] = Math.max(0, hidden[i] + branch[i] * gate[i % channels]);
      }
      if (conv3) conv3(input, hidden);
      const spatial = conv3 ? hidden : input;
      pooled.fill(0, 0, 2 * channels);
      for (let p = 0; p < area; p++) for (let i = 0; i < channels; i++) {
        const v = spatial[p * channels + i];
        pooled[i] += v / area;
        pooled[channels + i] = Math.max(pooled[channels + i], v);
      }
      pooled.set(context, 2 * channels);
      if (architecture === 'attention' || architecture === 'directional' || architecture === 'cross') {
        pooled.set(attentionSummary(w, spatial, context, channels, architecture === 'cross'), 2 * channels + context.length);
      }
      let result = w['value.bias'][0];
      for (let i = 0; i < w['hidden.bias'].length; i++) {
        let value = w['hidden.bias'][i];
        const kernel = w['hidden.weight'][i];
        for (let j = 0; j < pooled.length; j++) value += pooled[j] * kernel[j];
        result += Math.max(0, value) * w['value.weight'][0][i];
      }
      return Math.tanh(result);
    }

    return { predict, score: st => predict(Spatial.encode(st), AVI.features(st, st.turn)) };
  }

  function shortlist(ranked, limit, coverHand) {
    if (!coverHand) return ranked.slice(0, limit);
    const reserved = new Map();
    for (const candidate of ranked) {
      if (!reserved.has(candidate.move.i)) reserved.set(candidate.move.i, candidate);
    }
    return [...new Set([...reserved.values(), ...ranked])].slice(0, limit);
  }

  function chooseMove(model, { plies = 1, rolloutValue, top = 3, samples = 2, knownBag = false, coverHand = false } = {}) {
    const options = { knownBag };
    const preRanked = Tactics.rank(rolloutValue ?? model.score, 14, options);
    if (!preRanked.length || preRanked[0].priority >= 1e6) return preRanked[0]?.move;
    const ranked = rolloutValue ? rescore(model, shortlist(preRanked, 16, coverHand), options) : preRanked;
    if (plies <= 1 || ranked.length < 2 || ranked[0].priority >= 1e6) return ranked[0]?.move;
    const current = G.state;
    const first = AI.save();
    const logs = current.logs, fx = current.fx;
    const me = current.turn;
    const safe = ranked.filter(candidate => Boolean(candidate.danger) === Boolean(ranked[0].danger));
    const value = () => current.phase === 'end'
      ? (current.winner ? (current.winner === me ? 1 : -1) : 0)
      : model.score(current) * (current.turn === me ? 1 : -1);
    try {
      return G.withSimulationRandom(() => {
        const worlds = knownBag ? Array(samples).fill(first)
          : Array.from({ length: samples }, () => AI.sampleWorld(first));
        let best = null;
        const candidates = shortlist(safe, top, coverHand);
        for (const candidate of candidates) {
          let total = 0;
          for (let i = 0; i < samples; i++) {
            AI.restore(worlds[i]);
            if (!AI.apply(candidate.move).ok) continue;
            for (let ply = 1; ply < plies && current.phase === 'play'; ply++) {
              const reply = rolloutValue && (knownBag || ply + 1 < plies)
                ? Tactics.rank(rolloutValue, 8, options)[0]?.move
                : AI.chooseMove({ depth: 1, cells: 8, noise: 0 });
              if (!reply || !AI.apply(reply).ok) break;
            }
            total += value();
          }
          const combined = 0.65 * total / samples + 0.35 * candidate.score - 0.25 * candidate.threes - 2 * candidate.poison;
          if (!best || combined > best.value) best = { move: candidate.move, value: combined };
        }
        return best?.move ?? ranked[0].move;
      });
    } finally {
      AI.restore(first);
      current.logs = logs;
      current.fx = fx;
    }
  }

  function rescore(model, candidates, options) {
    const results = AI.onePlyOutcomes((st, me) => {
      if (st.phase === 'end') return st.winner ? (st.winner === me ? 1 : -1) : 0;
      return model.score(st) * (st.turn === me ? 1 : -1);
    }, 0, 4, candidates.map(({ move }) => move), options);
    return results.map(({ move, outcomes }, i) => {
      const candidate = candidates[i];
      const score = outcomes.reduce((sum, o) => sum + o, 0) / outcomes.length;
      const value = 0.75 * score + 0.25 * candidate.score;
      return { ...candidate, move, score: value, priority: Tactics.priority(value, candidate.danger, candidate.threes, candidate.poison) };
    }).sort((a, b) => b.priority - a.priority);
  }

  function attentionMove(model, aviWeights, {knownBag = false, plies = 2} = {}) {
    return chooseMove(model, {
      plies, knownBag, coverHand:true,
      rolloutValue: aviWeights && (st => AVI.predict(aviWeights, {sign:1,x:AVI.features(st,st.turn)})),
    });
  }

  const CNN = { evaluator, chooseMove, attentionMove };
  if (node) module.exports = CNN;
  else window.CNN = CNN;
})();
