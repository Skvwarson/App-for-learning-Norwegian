// FSRS-5 spaced-repetition scheduler (Free Spaced Repetition Scheduler).
//
// FSRS models each memory with two numbers:
//   stability  (S), days until recall probability drops to 90 %
//   difficulty (D), 1 (easy) … 10 (hard), how fast stability grows
// and predicts retrievability R(t) = (1 + F·t/S)^-0.5.
// Each review is scheduled for the moment R is predicted to fall to your
// desired retention (default 90 %), i.e. just before you would forget.
// That is the "spacing effect" turned into an algorithm.
//
// Formulas follow the open FSRS-5 reference (open-spaced-repetition/py-fsrs).

export const DEFAULT_WEIGHTS = Object.freeze([
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
  0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
]);

export const Rating = Object.freeze({ Again: 1, Hard: 2, Good: 3, Easy: 4 });
export const State = Object.freeze({ New: 0, Learning: 1, Review: 2, Relearning: 3 });

const DECAY = -0.5;
const FACTOR = 19 / 81; // makes R(S, S) = 0.9
export const MINUTE = 60_000;
export const DAY = 86_400_000;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export function newSrsState(now = Date.now()) {
  return { state: State.New, due: now, s: 0, d: 0, step: 0, reps: 0, lapses: 0, last: 0 };
}

/** Probability (0-1) of recalling a memory with stability `s` after `elapsedDays`. */
export function retrievability(elapsedDays, s) {
  if (!s || s <= 0) return 0;
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / s, DECAY);
}

// Small deterministic PRNG so a button's preview interval equals the real one.
function seeded(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export function createScheduler(options = {}) {
  const w = options.weights ?? DEFAULT_WEIGHTS;
  const retention = clamp(options.retention ?? 0.9, 0.7, 0.99);
  const maxInterval = options.maxInterval ?? 36500;
  const learningSteps = options.learningSteps ?? [1, 10]; // minutes
  const relearningSteps = options.relearningSteps ?? [10]; // minutes
  const fuzz = options.fuzz ?? true;

  const initStability = (g) => Math.max(w[g - 1], 0.1);
  const initDifficulty = (g) => clamp(w[4] - Math.exp(w[5] * (g - 1)) + 1, 1, 10);

  function nextDifficulty(d, g) {
    const delta = -w[6] * (g - 3);
    const damped = d + (delta * (10 - d)) / 9; // linear damping (FSRS-5)
    const reverted = w[7] * initDifficulty(Rating.Easy) + (1 - w[7]) * damped; // mean reversion
    return clamp(reverted, 1, 10);
  }

  function recallStability(d, s, r, g) {
    const hardPenalty = g === Rating.Hard ? w[15] : 1;
    const easyBonus = g === Rating.Easy ? w[16] : 1;
    return s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) *
      (Math.exp((1 - r) * w[10]) - 1) * hardPenalty * easyBonus);
  }

  function forgetStability(d, s, r) {
    const longTerm = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]);
    const shortTerm = s / Math.exp(w[17] * w[18]);
    return Math.min(longTerm, shortTerm);
  }

  const shortTermStability = (s, g) => s * Math.exp(w[17] * (g - 3 + w[18]));

  /** Interval in whole days for a given stability. */
  function intervalDays(s, seed = '') {
    let ivl = (s / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
    ivl = clamp(Math.round(ivl), 1, maxInterval);
    if (fuzz && ivl >= 3 && seed) {
      const frac = ivl < 7 ? 0.15 : ivl < 20 ? 0.1 : 0.05;
      const span = Math.max(1, Math.round(ivl * frac));
      ivl = clamp(ivl + Math.round((seeded(seed) * 2 - 1) * span), 2, maxInterval);
    }
    return ivl;
  }

  function stepDelay(steps, step, g) {
    if (g === Rating.Again) return steps[0];
    if (g === Rating.Hard) {
      if (step === 0 && steps.length === 1) return steps[0] * 1.5;
      if (step === 0 && steps.length >= 2) return (steps[0] + steps[1]) / 2;
      return steps[step];
    }
    return steps[step + 1];
  }

  /**
   * Apply a rating to a card's SRS state. Pure: returns a new state object.
   * @param {object} srs  state from newSrsState()
   * @param {1|2|3|4} g   rating
   * @param {number} now  epoch ms
   * @param {string} seed stable id for fuzz
   */
  function review(srs, g, now = Date.now(), seed = '') {
    const c = { ...srs };
    const elapsedDays = c.last ? (now - c.last) / DAY : 0;
    const fuzzSeed = `${seed}:${c.reps}`;

    if (c.state === State.New) {
      c.s = initStability(g);
      c.d = initDifficulty(g);
    } else if (elapsedDays < 1) {
      c.s = shortTermStability(c.s, g);
      c.d = nextDifficulty(c.d, g);
    } else {
      const r = retrievability(elapsedDays, c.s);
      c.s = g === Rating.Again ? forgetStability(c.d, c.s, r) : recallStability(c.d, c.s, r, g);
      c.d = nextDifficulty(c.d, g);
    }
    c.s = clamp(c.s, 0.01, maxInterval);

    const graduate = () => {
      c.state = State.Review;
      c.step = 0;
      c.due = now + intervalDays(c.s, fuzzSeed) * DAY;
    };

    if (c.state === State.New || c.state === State.Learning || c.state === State.Relearning) {
      const steps = c.state === State.Relearning ? relearningSteps : learningSteps;
      if (c.state === State.New) { c.state = State.Learning; c.step = 0; }
      if (g === Rating.Easy || steps.length === 0) {
        graduate();
      } else if (g === Rating.Good && c.step + 1 >= steps.length) {
        graduate();
      } else {
        const delay = stepDelay(steps, c.step, g);
        if (g === Rating.Again) c.step = 0;
        else if (g === Rating.Good) c.step += 1;
        c.due = now + delay * MINUTE;
      }
    } else {
      // Review state
      if (g === Rating.Again) {
        c.lapses += 1;
        if (relearningSteps.length) {
          c.state = State.Relearning;
          c.step = 0;
          c.due = now + relearningSteps[0] * MINUTE;
        } else {
          c.due = now + intervalDays(c.s, fuzzSeed) * DAY;
        }
      } else {
        c.due = now + intervalDays(c.s, fuzzSeed) * DAY;
      }
    }

    c.reps += 1;
    c.last = now;
    return c;
  }

  /** What would each button do? Used to label buttons with their next interval. */
  function preview(srs, now = Date.now(), seed = '') {
    const out = {};
    for (const g of [1, 2, 3, 4]) {
      const next = review(srs, g, now, seed);
      out[g] = { srs: next, delayMs: next.due - now };
    }
    return out;
  }

  return { review, preview, intervalDays, retention, retrievabilityNow: (srs, now = Date.now()) =>
    srs.state === State.New ? 0 : retrievability((now - srs.last) / DAY, srs.s) };
}

export function formatDelay(ms) {
  const min = ms / MINUTE;
  if (min < 60) return `${Math.max(1, Math.round(min))}m`;
  const h = min / 60;
  if (h < 24) return `${Math.round(h)}h`;
  const d = ms / DAY;
  if (d < 30) return `${Math.round(d)}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}
