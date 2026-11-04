// Optional AI conversation partner (Claude), called directly from the browser
// with the learner's own API key. The vendored SDK is loaded only when used.

import { settings } from './store.js';
import { knowledgeMap } from './deck.js';

let sdkPromise = null;
const sdk = () => (sdkPromise ??= import('../../vendor/anthropic-sdk.min.mjs'));

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (best quality)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (faster, cheaper)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fastest, cheapest)' },
];

export const SCENARIOS = [
  { id: 'free', icon: '💬', title: 'Free conversation', brief: 'A relaxed chat between friends about whatever the learner wants to talk about. Ask about their life, plans and interests.' },
  { id: 'intro', icon: '👋', title: 'Getting to know someone', brief: 'You meet the learner at a party in Oslo. Introduce yourself, ask their name, where they are from, what they do.' },
  { id: 'cafe', icon: '☕', title: 'At a café', brief: 'You are a friendly barista at a café in Oslo. Take the learner’s order, suggest pastries (skolebolle, kanelbolle, vaffel), tell the price, ask about paying.' },
  { id: 'day', icon: '🌤️', title: 'How was your day?', brief: 'You are the learner’s Norwegian flatmate. Ask how their day was and what they did, and share a little about yours.' },
  { id: 'weekend', icon: '🏔️', title: 'Weekend talk', brief: 'It is Monday at work. You are a colleague asking what the learner did at the weekend (past tense practice), and telling about your hike.' },
  { id: 'directions', icon: '🗺️', title: 'Asking for directions', brief: 'You are a local in Bergen. The learner is lost and asks for directions to the train station, the fish market (Fisketorget) or Bryggen.' },
  { id: 'shop', icon: '🧥', title: 'In a clothes shop', brief: 'You are a shop assistant. Help the learner find a winter jacket: size, colour, price, trying it on.' },
  { id: 'doctor', icon: '🩺', title: 'At the doctor', brief: 'You are a GP (fastlege). Ask what the problem is (“Hva kan jeg hjelpe deg med?”), where it hurts (“Har du vondt i …?”), for how long, and give simple advice.' },
  { id: 'opinions', icon: '🤔', title: 'Opinions', brief: 'Chat about Norwegian food (brunost, fiskeboller, taco on Fridays), the weather and life in Norway. Ask what the learner thinks, and give your own opinions.' },
];

const SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'Your next turn in the conversation, in simple Norwegian Bokmål.' },
    translation: { type: 'string', description: 'Natural English translation of reply.' },
    correction: {
      type: 'object',
      properties: {
        needed: { type: 'boolean', description: 'True if the learner’s last message had a mistake worth fixing or was not in Norwegian.' },
        corrected: { type: 'string', description: 'A natural, correct Norwegian version of the learner’s last message (empty if not needed).' },
        explanation: { type: 'string', description: 'One short, friendly English sentence explaining the main fix (empty if not needed).' },
      },
      required: ['needed', 'corrected', 'explanation'],
      additionalProperties: false,
    },
    suggestions: { type: 'array', items: { type: 'string' }, description: '2–3 short, simple things the learner could say next, in Norwegian.' },
    new_words: {
      type: 'array',
      items: { type: 'object', properties: { no: { type: 'string' }, en: { type: 'string' } }, required: ['no', 'en'], additionalProperties: false },
      description: 'Words in your reply the learner probably does not know yet (max 3), dictionary form.',
    },
  },
  required: ['reply', 'translation', 'correction', 'suggestions', 'new_words'],
  additionalProperties: false,
};

function systemPrompt(scenario) {
  const known = [...knowledgeMap().entries()].filter(([, v]) => v === 'known').map(([k]) => k);
  const learning = [...knowledgeMap().entries()].filter(([, v]) => v === 'learning').map(([k]) => k);
  const name = settings().name || 'the learner';
  const level = known.length < 150 ? 'complete beginner (A1)' : known.length < 600 ? 'beginner (A1–A2)' : 'lower intermediate (A2–B1)';
  return `You are a warm, patient Norwegian conversation partner helping ${name} learn to speak Norwegian (Bokmål). The learner is a ${level}.

Scenario: ${scenario.brief}

How to talk:
- Stay in the scenario and keep the conversation going: each reply is 1–3 short sentences and usually ends with a simple question.
- Use comprehensible input: mostly words the learner already knows, plus at most one or two new words per reply. Prefer present tense and short main clauses unless the scenario practises something else.
- Speak naturally, the way Norwegians actually talk (e.g. “Så hyggelig!”, “Ja, det skjønner jeg.”), but simply.
- Write only Norwegian in "reply". English belongs only in "translation" and "correction.explanation".
- If the learner writes English or gets stuck, help them: put the Norwegian way to say it in correction.corrected, and continue the conversation.
- Correct gently and only what matters for being understood or sounding natural; ignore missing capital letters and small punctuation. Don’t correct a message that is fine.
- suggestions: 2–3 easy replies the learner could give next, matched to their level.

Words the learner knows well: ${known.slice(0, 400).join(', ') || '(very few yet)'}
Words the learner is learning: ${learning.slice(0, 200).join(', ') || '(none yet)'}`;
}

/** Friendly message for an API error, using the SDK’s typed error classes. */
function explainError(e, Anthropic) {
  if (e instanceof Anthropic.AuthenticationError) return 'Your API key was rejected. Check it in Settings.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'This API key doesn’t have access to that model. Try another model in Settings.';
  if (e instanceof Anthropic.RateLimitError) return 'Rate limit reached – wait a moment and try again.';
  if (e instanceof Anthropic.BadRequestError) return `The request was rejected: ${e.message}`;
  if (e instanceof Anthropic.APIConnectionError) return 'Could not reach the Claude API. Check your internet connection.';
  if (e instanceof Anthropic.APIError) return `Claude API error ${e.status ?? ''}: ${e.message}`;
  return e?.message || String(e);
}

export function createConversation(scenarioId) {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];
  const messages = [];
  const system = systemPrompt(scenario);

  async function send(userText) {
    const { default: Anthropic } = await sdk();
    const apiKey = settings().aiKey;
    if (!apiKey) throw new Error('Add your Claude API key first.');
    const model = settings().aiModel || MODELS[0].id;
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    messages.push({ role: 'user', content: userText ?? '(Start the conversation now with a short, friendly opening line that fits the scenario.)' });
    const params = {
      model,
      max_tokens: 4000,
      system,
      messages,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    };
    // Haiku has no server-side refusal fallback; the others use the recommended default routing.
    const withFallback = model !== 'claude-haiku-5-5';
    let res;
    try {
      res = withFallback
        ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
        : await client.messages.create(params);
    } catch (e) {
      messages.pop();
      throw new Error(explainError(e, Anthropic));
    }
    if (res.stop_reason === 'refusal') {
      messages.pop();
      throw new Error('Claude declined to continue this message. Try rephrasing, or start a new conversation.');
    }
    messages.push({ role: 'assistant', content: res.content });
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    try {
      const out = JSON.parse(text);
      return { ...out, suggestions: out.suggestions ?? [], new_words: out.new_words ?? [] };
    } catch {
      if (res.stop_reason === 'max_tokens') return { reply: text, translation: '', correction: { needed: false }, suggestions: [], new_words: [] };
      return { reply: text, translation: '', correction: { needed: false }, suggestions: [], new_words: [] };
    }
  }

  return { scenario, send, messages };
}
