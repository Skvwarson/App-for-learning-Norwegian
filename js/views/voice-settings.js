// Settings → Voice: choose where Norwegian audio comes from.

import { h, clear, add, toast } from '../ui/dom.js';
import {
  isBrave, norwegianVoices, voiceStatus, voicesReady, speak, listCloudVoices, clearAudioCache, voiceQuality,
  PROVIDERS, DEFAULT_ELEVEN_VOICE, DEFAULT_GOOGLE_VOICE,
} from '../core/speech.js';

const TEST_SENTENCE = 'Hei! Vi sees i morgen. Hyggelig å treffe deg!';

/** Advice for getting a good free Norwegian voice on this particular device/browser. */
export function deviceTip() {
  const ua = navigator.userAgent;
  const isEdge = /Edg\//.test(ua);
  const backup = ' Move your progress with Settings → Download backup, then Restore backup in the other browser.';
  if (/Windows/.test(ua) && isBrave()) return 'Brave can’t use Windows’ newer voice packs (even after you install Norwegian) and has no speech recognition of its own. Best fix in Brave: choose ElevenLabs above and add a free key – you get a natural Norwegian voice and a working microphone. (Microsoft Edge would also work, with free voices and microphone.)';
  if (/Windows/.test(ua) && !isEdge) return `This browser only sees Windows’ older built-in voices, so a newly installed Norwegian voice pack usually doesn’t show up. Open this app in Microsoft Edge – it has free natural Norwegian voices.${backup}`;
  if (isEdge && !norwegianVoices().length) return 'Edge’s natural voices need an internet connection. Check you’re online, then restart Edge.';
  if (isBrave()) return 'Brave has few voices and no speech recognition of its own. Choose ElevenLabs above (free key) for a natural voice and a working microphone.';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iPhone/iPad: Settings → Accessibility → Spoken Content → Voices → Norwegian → download “Nora (Enhanced)”. Then reload this page.';
  if (/Android/.test(ua)) return 'Android: Settings → search “Text-to-speech” → Google → install voice data → Norsk (bokmål). Then reload this page.';
  if (/Mac OS X/.test(ua)) return 'Mac: System Settings → Accessibility → Spoken Content → System voice → Manage Voices → Norwegian → download “Nora (Enhanced)”. Then restart the browser.';
  return 'Install a Norwegian (bokmål) voice in your system’s text-to-speech settings, then restart the browser.';
}

export function voiceCard({ s, set, field, check }) {
  const status = h('div.voice-status');
  const renderStatus = () => {
    const st = voiceStatus();
    clear(status);
    add(status,
      h('span.dot', { class: !st.ok ? 'bad' : st.quality >= 3 ? 'mature' : 'learning' }),
      h('span', st.ok ? h('span', 'Speaking with ', h('b', st.label)) : h('b', `⚠️ ${st.label}`)),
      st.ok && st.quality < 3 ? h('span.small.muted', '· basic quality – see tips below') : null);
  };

  // --- device voices
  const deviceVoiceSel = h('select.input', { id: 'voice-device', onchange: (e) => { set('voiceURI', e.target.value); renderStatus(); } });
  const fillDevice = () => {
    const voices = norwegianVoices();
    clear(deviceVoiceSel);
    add(deviceVoiceSel,
      h('option', { value: '' }, voices.length ? 'Automatic (best Norwegian voice)' : 'No Norwegian voice found on this device'),
      ...voices.map((v) => h('option', { value: v.voiceURI, selected: v.voiceURI === s.voiceURI }, `${voiceQuality(v) >= 3 ? '★ ' : ''}${v.name} (${v.lang})`)));
    renderStatus();
  };
  voicesReady().then(fillDevice);
  fillDevice();

  // --- cloud voices
  const cloudBlock = (p, keyField, voiceField, defaultVoice, intro, steps) => {
    const keyIn = h('input.input', { id: `${p}-key`, type: 'password', value: s[keyField], placeholder: 'API key', autocomplete: 'off' });
    const voiceSel = h('select.input', { id: `${p}-voice`, onchange: (e) => { set(voiceField, e.target.value); renderStatus(); } },
      h('option', { value: s[voiceField] || defaultVoice }, s[voiceField] || `${defaultVoice} (default)`));
    const load = async (btn) => {
      const key = keyIn.value.trim();
      if (!key) return toast('Paste your API key first.', { kind: 'warn' });
      set(keyField, key);
      btn.disabled = true;
      try {
        const voices = await listCloudVoices(p, key);
        if (!voices.length) throw new Error('No voices found for this key.');
        const current = s[voiceField] && voices.some((v) => v.id === s[voiceField]) ? s[voiceField] : voices[0].id;
        clear(voiceSel);
        add(voiceSel, ...voices.map((v) => h('option', { value: v.id, selected: v.id === current }, v.label)));
        set(voiceField, current);
        set('ttsProvider', p);
        renderStatus();
        toast(`Loaded ${voices.length} voices. Press “Test voice”.`, { icon: '🔊' });
      } catch (e) {
        toast(e.message, { kind: 'warn', ms: 6000 });
      }
      btn.disabled = false;
    };
    return h('div.stack.tight.provider-block', { dataset: { provider: p } },
      h('p.small', intro),
      field('API key', keyIn, 'Stored only in this browser. Not included in backups.'),
      h('div.row', h('button.btn.small', { type: 'button', onclick: (e) => load(e.currentTarget) }, 'Save key & load voices')),
      field('Voice', voiceSel),
      h('details.small', h('summary', 'How do I get a key?'), h('ol', ...steps.map((x) => h('li', x)))));
  };

  const eleven = cloudBlock('elevenlabs', 'elevenKey', 'elevenVoice', DEFAULT_ELEVEN_VOICE,
    'The most natural-sounding option, and it also powers the 🎙 microphone in browsers without speech recognition (like Brave). Voice: Flash v2.5 model (supports Norwegian); microphone: Scribe v2. ElevenLabs’ free plan includes a monthly allowance; each sentence is generated once and saved on this device, so replays cost nothing.',
    [h('span', 'Sign up at ', h('a', { href: 'https://elevenlabs.io', target: '_blank', rel: 'noopener' }, 'elevenlabs.io'), '.'),
      'Profile → API keys → Create key. Allow “Text to Speech”, “Speech to Text” (for the microphone) and “Voices: read” (so the voice list loads).',
      'Paste it here and press “Save key & load voices”.',
      'Tip: in ElevenLabs’ Voice Library, search “Norwegian” and add a native voice to My Voices – it will then appear in the list here for the best accent.']);

  const google = cloudBlock('google', 'googleKey', 'googleVoice', DEFAULT_GOOGLE_VOICE,
    'Google’s Norwegian (nb-NO) neural voices – the same family Google Translate uses, but through the official API. Google’s monthly free quota covers far more than this whole course.',
    [h('span', 'Open ', h('a', { href: 'https://console.cloud.google.com/', target: '_blank', rel: 'noopener' }, 'console.cloud.google.com'), ' and create a project (billing must be enabled, but usage within the free quota costs nothing).'),
      'APIs & Services → Library → enable “Cloud Text-to-Speech API”.',
      'APIs & Services → Credentials → Create credentials → API key. Restrict it to the Text-to-Speech API and to this website’s address.',
      'Paste it here and press “Save key & load voices”.']);

  const deviceBlock = h('div.stack.tight.provider-block', { dataset: { provider: 'device' } },
    field('Norwegian voice', deviceVoiceSel, '★ = natural/neural voice'),
    h('div.card.tip.small', h('b', 'Best free voice on this device: '), deviceTip()),
    h('label.row.small', check('allowForeignVoice'), ' If no Norwegian voice exists, use another language’s voice anyway (not recommended – it mispronounces Norwegian)'));

  const blocks = [deviceBlock, eleven, google];
  const showBlocks = (p) => blocks.forEach((b) => { b.hidden = b.dataset.provider !== p; });
  const providerSel = h('div.choices.provider-choices', ...Object.entries(PROVIDERS).map(([p, label]) => h('button.choice', {
    type: 'button', class: (s.ttsProvider || 'device') === p ? 'selected' : '',
    onclick: (e) => {
      set('ttsProvider', p);
      providerSel.querySelectorAll('.choice').forEach((c) => c.classList.toggle('selected', c === e.currentTarget));
      showBlocks(p);
      renderStatus();
    },
  }, h('span', label))));
  showBlocks(s.ttsProvider || 'device');

  return h('div.card.stack',
    h('div.kicker', '🔊 Voice'),
    status,
    providerSel,
    ...blocks,
    field('Speaking speed', h('input', { id: 'voice-rate', type: 'range', min: 0.5, max: 1.2, step: 0.05, value: s.ttsRate, onchange: (e) => set('ttsRate', Number(e.target.value)) })),
    h('div.row.wrap',
      h('button.btn', { type: 'button', onclick: () => speak(TEST_SENTENCE) }, '▶ Test voice'),
      h('button.btn.ghost.small', { type: 'button', onclick: async () => { await clearAudioCache(); toast('Saved audio cleared.'); } }, 'Clear saved audio')),
    h('div.kicker', '🎵 Sound'),
    h('label.row', check('sound'), ' Sound effects'),
    h('label.row', check('haptics'), ' Vibration (phones)'),
    h('label.row', check('shadowing'), ' Show shadowing microphones on dialogue lines'));
}

