// Units 13–18 (A2): the situations of everyday life in Norway, building on
// units 1–12. Same arc and fields as data/units.js.

const W = (no, en, extra = {}) => ({ no, en, ...extra });

export const A2_UNITS = [
  // ───────────────────────────────────────────────────────────── 13
  {
    id: 'u13',
    title: 'Hos legen',
    subtitle: 'Health, the body and “must / should / can”',
    goal: 'Say what hurts, understand simple advice from a doctor and ask what you have to do.',
    scene: 'Emma has had a sore throat for days. She goes to her GP (fastlege).',
    focus: 'Listen: what is wrong with Emma – and what does the doctor tell her to do?',
    dialogue: [
      ['Legen', 'Hei, Emma. Hva kan jeg hjelpe deg med?', 'Hi, Emma. What can I help you with?'],
      ['Emma', 'Jeg føler meg ikke bra. Jeg har vondt i halsen og hodet.', 'I don’t feel well. I have a sore throat and a headache.'],
      ['Legen', 'Hvor lenge har du hatt vondt?', 'How long have you been in pain?'],
      ['Emma', 'Siden mandag. Og i natt hadde jeg feber.', 'Since Monday. And last night I had a fever.'],
      ['Legen', 'La meg se. Åpne munnen, er du snill.', 'Let me see. Open your mouth, please.'],
      ['Legen', 'Det ser ut som en vanlig forkjølelse.', 'It looks like an ordinary cold.'],
      ['Emma', 'Må jeg ta medisin?', 'Do I have to take medicine?'],
      ['Legen', 'Nei, men du bør hvile og drikke mye vann. Du kan ta paracet hvis du har feber.', 'No, but you should rest and drink lots of water. You can take paracetamol if you have a fever.'],
      ['Emma', 'Kan jeg gå på jobb i morgen?', 'Can I go to work tomorrow?'],
      ['Legen', 'Nei, du bør være hjemme i et par dager. God bedring!', 'No, you should stay at home for a couple of days. Get well soon!'],
      ['Emma', 'Tusen takk!', 'Thank you so much!'],
    ],
    words: [
      W('Hva kan jeg hjelpe deg med?', 'What can I help you with?', { pos: 'phrase' }),
      W('Jeg føler meg ikke bra.', 'I don’t feel well.', { pos: 'phrase' }),
      W('å ha vondt i', 'to have a pain in (Jeg har vondt i hodet = my head hurts)', { pos: 'verb' }),
      W('en hals', 'a throat, a neck', { pos: 'noun', g: 'en' }),
      W('et hode', 'a head', { pos: 'noun', g: 'et' }),
      W('en mage', 'a stomach, a belly', { pos: 'noun', g: 'en', ex: ['Jeg har vondt i magen.', 'I have a stomach ache.'] }),
      W('feber', 'fever', { pos: 'noun', g: 'en' }),
      W('siden', 'since', { pos: 'preposition' }),
      W('å hvile', 'to rest', { pos: 'verb', forms: 'hviler · hvilte · har hvilt' }),
      W('må', 'must, have to (å måtte)', { pos: 'verb form' }),
      W('bør', 'should, ought to (å burde)', { pos: 'verb form' }),
      W('en medisin', 'a medicine', { pos: 'noun', g: 'en' }),
      W('en forkjølelse', 'a cold (illness)', { pos: 'noun', g: 'en' }),
      W('hvis', 'if', { pos: 'conjunction' }),
      W('God bedring!', 'Get well soon!', { pos: 'phrase' }),
    ],
    grammar: {
      title: 'Modal verbs: kan, må, vil, skal, bør',
      body: `<p>Modal verbs are followed by the <b>bare infinitive – no å</b>:</p>
<p class="formula">Jeg <b>må</b> hvile. &nbsp;·&nbsp; Du <b>bør</b> drikke vann. &nbsp;·&nbsp; <b>Kan</b> jeg gå på jobb?</p>
<table class="mini"><tr><td><b>kan</b></td><td>can, may</td></tr><tr><td><b>må</b></td><td>must, have to</td></tr>
<tr><td><b>vil</b></td><td>want to</td></tr><tr><td><b>skal</b></td><td>am going to, shall (plans)</td></tr><tr><td><b>bør</b></td><td>should, ought to</td></tr></table>
<p>Careful: <i>du må ikke</i> = you <b>must not</b>. “You don’t have to” is <i>du trenger ikke</i>.</p>`,
      examples: [
        ['Du bør drikke mye vann.', 'You should drink lots of water.'],
        ['Jeg vil ikke ta medisin.', 'I don’t want to take medicine.'],
        ['Du trenger ikke å komme i morgen.', 'You don’t have to come tomorrow.'],
      ],
      drills: [
        { type: 'fill', q: 'Jeg ___ hvile i dag. (must)', a: 'må', en: 'I have to rest today.' },
        { type: 'fill', q: 'Du ___ drikke mye vann. (should)', a: 'bør', en: 'You should drink a lot of water.' },
        { type: 'fill', q: '___ jeg gå på jobb i morgen? (can)', a: 'kan', en: 'Can I go to work tomorrow?' },
        { type: 'order', tiles: ['vil', 'Jeg', 'ta', 'ikke', 'medisin.'], a: 'Jeg vil ikke ta medisin.', en: 'I don’t want to take medicine.' },
      ],
    },
    roleplay: {
      title: 'At the doctor',
      partner: 'Legen',
      lines: [
        { who: 'them', no: 'Hei! Hva kan jeg hjelpe deg med?', en: 'Hi! What can I help you with?' },
        { who: 'you', cue: 'Say you don’t feel well – you have a headache.', accept: ['jeg føler meg ikke bra jeg har vondt i hodet', 'jeg har vondt i hodet'], model: 'Jeg føler meg ikke bra. Jeg har vondt i hodet.' },
        { who: 'them', no: 'Hvor lenge har du hatt vondt?', en: 'How long have you been in pain?' },
        { who: 'you', cue: 'Say: since Monday.', accept: ['siden mandag'], model: 'Siden mandag.' },
        { who: 'them', no: 'Har du feber?', en: 'Do you have a fever?' },
        { who: 'you', cue: 'Say no, but you have a sore throat.', accept: ['nei men jeg har vondt i halsen'], model: 'Nei, men jeg har vondt i halsen.' },
        { who: 'them', no: 'Du bør hvile og drikke mye vann.', en: 'You should rest and drink lots of water.' },
        { who: 'you', cue: 'Ask if you have to take medicine.', accept: ['må jeg ta medisin'], model: 'Må jeg ta medisin?' },
        { who: 'them', no: 'Nei, det trenger du ikke. God bedring!', en: 'No, you don’t need to. Get well soon!' },
        { who: 'you', cue: 'Say thank you so much.', accept: ['tusen takk', 'takk skal du ha'], model: 'Tusen takk!' },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────── 14
  {
    id: 'u14',
    title: 'En ny leilighet',
    subtitle: 'Your home, rooms and “the …” in singular and plural',
    goal: 'Describe a flat or house, ask about the rent and offer to help.',
    scene: 'Sofie has moved. She shows Emma her new flat.',
    focus: 'Listen: which rooms does the flat have – and what does Emma like best?',
    dialogue: [
      ['Sofie', 'Velkommen! Kom inn.', 'Welcome! Come in.'],
      ['Emma', 'For en fin leilighet! Hvor mange rom har den?', 'What a nice flat! How many rooms does it have?'],
      ['Sofie', 'Den har tre rom: en stue, et soverom og et kontor.', 'It has three rooms: a living room, a bedroom and a study.'],
      ['Emma', 'Og kjøkkenet?', 'And the kitchen?'],
      ['Sofie', 'Kjøkkenet er her til venstre. Det er lite, men praktisk.', 'The kitchen is here on the left. It’s small but practical.'],
      ['Emma', 'Jeg liker balkongen best! Du har jo utsikt over hele byen.', 'I like the balcony best! You have a view over the whole city.'],
      ['Sofie', 'Ja, det er derfor jeg flyttet hit.', 'Yes, that’s why I moved here.'],
      ['Emma', 'Er husleia høy?', 'Is the rent high?'],
      ['Sofie', 'Ja, ganske høy, men det er verdt det.', 'Yes, quite high, but it’s worth it.'],
      ['Emma', 'Trenger du hjelp med å bære møblene?', 'Do you need help carrying the furniture?'],
      ['Sofie', 'Ja takk! Sofaen og bokhylla står fortsatt nede i bilen.', 'Yes please! The sofa and the bookshelf are still down in the car.'],
    ],
    words: [
      W('en leilighet', 'a flat, an apartment', { pos: 'noun', g: 'en', forms: 'leiligheten · leiligheter · leilighetene' }),
      W('et rom', 'a room (plural: rom)', { pos: 'noun', g: 'et', forms: 'rommet · rom · rommene' }),
      W('ei stue', 'a living room (stua = the living room)', { pos: 'noun', g: 'ei', alt: ['en stue'] }),
      W('et soverom', 'a bedroom', { pos: 'noun', g: 'et' }),
      W('et kjøkken', 'a kitchen', { pos: 'noun', g: 'et' }),
      W('et bad', 'a bathroom', { pos: 'noun', g: 'et', ex: ['Badet er ved siden av soverommet.', 'The bathroom is next to the bedroom.'] }),
      W('en balkong', 'a balcony', { pos: 'noun', g: 'en' }),
      W('best', 'best (liker … best = like … best)', { pos: 'adverb' }),
      W('derfor', 'that’s why, therefore', { pos: 'adverb' }),
      W('å flytte', 'to move (house)', { pos: 'verb', forms: 'flytter · flyttet · har flyttet' }),
      W('ei husleie', 'rent (husleia = the rent)', { pos: 'noun', g: 'ei', alt: ['en husleie'] }),
      W('høy', 'high; tall', { pos: 'adj', forms: 'høy · høyt · høye' }),
      W('å trenge', 'to need', { pos: 'verb', forms: 'trenger · trengte · har trengt' }),
      W('et møbel', 'a piece of furniture (møbler = furniture)', { pos: 'noun', g: 'et' }),
      W('fortsatt', 'still', { pos: 'adverb' }),
    ],
    grammar: {
      title: '“The” at the end – in singular and plural',
      body: `<p>You know <i>en leilighet → leilighet<b>en</b></i>. Plural adds <b>-er</b>, and “the …” in plural adds <b>-ene</b>:</p>
<table class="mini"><tr><th></th><th>a</th><th>the</th><th>(some)</th><th>the (pl.)</th></tr>
<tr><td>en</td><td>leilighet</td><td>leiligheten</td><td>leiligheter</td><td>leilighetene</td></tr>
<tr><td>ei</td><td>stue</td><td>stua</td><td>stuer</td><td>stuene</td></tr>
<tr><td>et</td><td>kjøkken</td><td>kjøkkenet</td><td>kjøkken</td><td>kjøkkenene</td></tr>
<tr><td>et</td><td>rom</td><td>rommet</td><td><b>rom</b></td><td>rommene</td></tr></table>
<p><b>Tip:</b> short et-words (one syllable) get <i>no</i> ending in the plural: <i>et hus – to hus, et rom – tre rom</i>.</p>`,
      examples: [
        ['Leiligheten har tre rom.', 'The flat has three rooms.'],
        ['Rommene er store og lyse.', 'The rooms are big and bright.'],
        ['Vi har to bad.', 'We have two bathrooms.'],
      ],
      drills: [
        { type: 'fill', q: 'the flat = ___ (en leilighet)', a: 'leiligheten', en: 'the flat' },
        { type: 'fill', q: 'the rooms = ___ (et rom)', a: 'rommene', en: 'the rooms' },
        { type: 'fill', q: 'two houses = to ___ (et hus)', a: 'hus', en: 'two houses' },
        { type: 'fill', q: 'the kitchen = ___ (et kjøkken)', a: 'kjøkkenet', en: 'the kitchen' },
      ],
    },
    roleplay: {
      title: 'Viewing a flat',
      partner: 'Utleieren',
      lines: [
        { who: 'them', no: 'Hei! Velkommen. Dette er leiligheten.', en: 'Hi! Welcome. This is the flat.' },
        { who: 'you', cue: 'Say what a nice flat – and ask how many rooms it has.', accept: ['for en fin leilighet hvor mange rom har den', 'hvor mange rom har den', 'for en fin leilighet hvor mange rom har leiligheten'], model: 'For en fin leilighet! Hvor mange rom har den?' },
        { who: 'them', no: 'Den har en stue, to soverom og et lite kjøkken.', en: 'It has a living room, two bedrooms and a small kitchen.' },
        { who: 'you', cue: 'Ask if it has a balcony.', accept: ['har den balkong', 'har den en balkong', 'har leiligheten balkong', 'er det balkong', 'er det en balkong'], model: 'Har den balkong?' },
        { who: 'them', no: 'Ja, med utsikt over byen.', en: 'Yes, with a view over the city.' },
        { who: 'you', cue: 'Ask if the rent is high.', accept: ['er husleia høy', 'er husleien høy', 'hvor høy er husleia', 'hvor mye er husleia'], model: 'Er husleia høy?' },
        { who: 'them', no: 'Den er tolv tusen kroner i måneden.', en: 'It’s twelve thousand kroner a month.' },
        { who: 'you', cue: 'Say that’s fine – you’ll take it!', accept: ['det er greit jeg tar den', 'greit jeg tar den', 'jeg tar den', 'den tar jeg'], model: 'Det er greit. Jeg tar den!' },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────── 15
  {
    id: 'u15',
    title: 'På jobb',
    subtitle: 'Work, colleagues and “I have lived / have worked”',
    goal: 'Talk about your job and how long you have lived somewhere – the classic small-talk questions.',
    scene: 'Lunch break at Emma’s new job. A colleague, Ahmed, sits down next to her.',
    focus: 'Listen: what does Ahmed do, and how long has he been in Norway?',
    dialogue: [
      ['Ahmed', 'Hei! Er du ny her?', 'Hi! Are you new here?'],
      ['Emma', 'Ja, jeg begynte i forrige uke. Jeg heter Emma.', 'Yes, I started last week. My name is Emma.'],
      ['Ahmed', 'Hyggelig! Jeg heter Ahmed. Hva jobber du med?', 'Nice to meet you! I’m Ahmed. What do you do?'],
      ['Emma', 'Jeg er ingeniør. Og du?', 'I’m an engineer. And you?'],
      ['Ahmed', 'Jeg jobber med IT. Jeg har jobbet her i fire år.', 'I work in IT. I’ve worked here for four years.'],
      ['Emma', 'Har du alltid bodd i Oslo?', 'Have you always lived in Oslo?'],
      ['Ahmed', 'Nei, jeg har bodd i Bergen og Stavanger også. Jeg kom til Norge for ti år siden.', 'No, I’ve lived in Bergen and Stavanger too. I came to Norway ten years ago.'],
      ['Emma', 'Du snakker veldig godt norsk!', 'You speak Norwegian really well!'],
      ['Ahmed', 'Takk! Det tok tid, men nå går det fint. Har du lært mye norsk?', 'Thanks! It took time, but now it’s going well. Have you learned a lot of Norwegian?'],
      ['Emma', 'Jeg har lært litt, men jeg øver hver dag.', 'I’ve learned a little, but I practise every day.'],
      ['Ahmed', 'Det er det viktigste! Skal vi spise lunsj sammen i morgen også?', 'That’s the most important thing! Shall we have lunch together tomorrow too?'],
    ],
    words: [
      W('Hva jobber du med?', 'What do you do (for work)?', { pos: 'phrase' }),
      W('Jeg jobber med …', 'I work with/in …', { pos: 'phrase', alt: ['jeg jobber med'] }),
      W('ny', 'new', { pos: 'adj', forms: 'ny · nytt · nye' }),
      W('i forrige uke', 'last week', { pos: 'phrase' }),
      W('en ingeniør', 'an engineer (Jeg er ingeniør – no article for jobs)', { pos: 'noun', g: 'en' }),
      W('en kollega', 'a colleague', { pos: 'noun', g: 'en', ex: ['Ahmed er en hyggelig kollega.', 'Ahmed is a nice colleague.'] }),
      W('alltid', 'always', { pos: 'adverb' }),
      W('for … siden', '… ago (for ti år siden = ten years ago)', { pos: 'phrase', ex: ['Jeg kom til Norge for ti år siden.', 'I came to Norway ten years ago.'] }),
      W('kom', 'came (past of å komme)', { pos: 'verb form' }),
      W('å øve', 'to practise', { pos: 'verb', forms: 'øver · øvde · har øvd' }),
      W('hver dag', 'every day', { pos: 'phrase' }),
      W('viktig', 'important (det viktigste = the most important thing)', { pos: 'adj' }),
      W('lunsj', 'lunch', { pos: 'noun', g: 'en' }),
      W('å ta tid', 'to take time', { pos: 'verb', ex: ['Det tar tid å lære norsk.', 'It takes time to learn Norwegian.'] }),
      W('Hvor lenge har du bodd i Norge?', 'How long have you lived in Norway?', { pos: 'phrase', ex: ['Hvor lenge har du bodd i Norge, Ahmed?', 'How long have you lived in Norway, Ahmed?'] }),
    ],
    grammar: {
      title: 'The present perfect: har + jobbet / bodd / vært',
      body: `<p>To talk about experience or something that has lasted <b>up to now</b>, use <b>har</b> + the past participle:</p>
<table class="mini"><tr><td>å jobbe</td><td>har jobb<b>et</b></td></tr><tr><td>å lære</td><td>har lær<b>t</b></td></tr><tr><td>å bo</td><td>har bo<b>dd</b></td></tr>
<tr><td>å være</td><td>har <b>vært</b></td></tr><tr><td>å se</td><td>har <b>sett</b></td></tr><tr><td>å gå</td><td>har <b>gått</b></td></tr></table>
<p><i>Jeg <b>har bodd</b> her <b>i</b> to år.</i> = I have lived here <b>for</b> two years (and still do).<br>
For a finished moment use the past tense: <i>I går <b>jobbet</b> jeg hjemme.</i></p>`,
      examples: [
        ['Har du vært i Bergen?', 'Have you been to Bergen?'],
        ['Jeg har aldri sett nordlys.', 'I have never seen the northern lights.'],
        ['Vi har bodd her i tre år.', 'We have lived here for three years.'],
      ],
      drills: [
        { type: 'fill', q: 'Jeg har ___ her i to år. (å bo)', a: 'bodd', en: 'I have lived here for two years.' },
        { type: 'fill', q: 'Har du ___ i Bergen? (å være)', a: 'vært', en: 'Have you been to Bergen?' },
        { type: 'fill', q: 'Vi har ___ mye norsk. (å lære)', a: 'lært', en: 'We have learned a lot of Norwegian.' },
        { type: 'order', tiles: ['har', 'Hun', 'her', 'jobbet', 'i', 'fire', 'år.'], a: 'Hun har jobbet her i fire år.', en: 'She has worked here for four years.' },
      ],
    },
    roleplay: {
      title: 'Lunch with a new colleague',
      partner: 'Ahmed',
      lines: [
        { who: 'them', no: 'Hei! Er du ny her?', en: 'Hi! Are you new here?' },
        { who: 'you', cue: 'Say yes – you started last week.', accept: ['ja jeg begynte i forrige uke'], model: 'Ja, jeg begynte i forrige uke.' },
        { who: 'them', no: 'Velkommen! Hva jobber du med?', en: 'Welcome! What do you do?' },
        { who: 'you', cue: 'Say what you work with (for example IT).', accept: ['jeg jobber med *', 'jeg er *'], model: 'Jeg jobber med IT.' },
        { who: 'them', no: 'Spennende! Hvor lenge har du bodd i Norge?', en: 'Exciting! How long have you lived in Norway?' },
        { who: 'you', cue: 'Say you have lived here for one year.', accept: ['jeg har bodd her i ett år', 'jeg har bodd her i et år', 'jeg har bodd i norge i ett år', 'i ett år', 'jeg har bodd her i * år'], model: 'Jeg har bodd her i ett år.' },
        { who: 'them', no: 'Du snakker jo bra norsk!', en: 'You speak good Norwegian!' },
        { who: 'you', cue: 'Say thanks – you practise every day.', accept: ['takk jeg øver hver dag', 'tusen takk jeg øver hver dag'], model: 'Takk! Jeg øver hver dag.' },
        { who: 'them', no: 'Skal vi spise lunsj sammen i morgen?', en: 'Shall we have lunch together tomorrow?' },
        { who: 'you', cue: 'Say: yes, gladly!', accept: ['ja gjerne', 'gjerne', 'ja takk gjerne'], model: 'Ja, gjerne!' },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────── 16
  {
    id: 'u16',
    title: 'På reise',
    subtitle: 'Travel, hotels and comparing things',
    goal: 'Check in at a hotel, ask what’s included and compare options (cheaper, faster, better).',
    scene: 'Emma travels to Tromsø to see the northern lights. She arrives at her hotel.',
    focus: 'Listen: how many nights is Emma staying – and is the bus or the taxi faster?',
    dialogue: [
      ['Resepsjonisten', 'God kveld! Velkommen til Tromsø.', 'Good evening! Welcome to Tromsø.'],
      ['Emma', 'Hei! Jeg har bestilt et rom. Navnet er Emma Brown.', 'Hi! I’ve booked a room. The name is Emma Brown.'],
      ['Resepsjonisten', 'Et øyeblikk … Ja, et enkeltrom i tre netter.', 'One moment … Yes, a single room for three nights.'],
      ['Emma', 'Akkurat. Er frokost inkludert?', 'Exactly. Is breakfast included?'],
      ['Resepsjonisten', 'Ja, frokosten serveres fra klokka sju til ti.', 'Yes, breakfast is served from seven to ten.'],
      ['Emma', 'Flott. Hvor kan jeg se nordlyset?', 'Great. Where can I see the northern lights?'],
      ['Resepsjonisten', 'Det er best å komme seg ut av byen. Der er det mørkere og roligere.', 'It’s best to get out of the city. It’s darker and quieter there.'],
      ['Emma', 'Er det billigere å ta bussen eller en taxi?', 'Is it cheaper to take the bus or a taxi?'],
      ['Resepsjonisten', 'Bussen er mye billigere, men taxien er raskere.', 'The bus is much cheaper, but the taxi is faster.'],
      ['Emma', 'Da tar jeg bussen. Her er kortet mitt.', 'Then I’ll take the bus. Here’s my card.'],
      ['Resepsjonisten', 'Takk. Rommet ditt er nummer 304. God tur!', 'Thank you. Your room is number 304. Have a good trip!'],
    ],
    words: [
      W('å bestille', 'to book, to order', { pos: 'verb', forms: 'bestiller · bestilte · har bestilt' }),
      W('Jeg har bestilt et rom.', 'I’ve booked a room.', { pos: 'phrase' }),
      W('et øyeblikk', 'a moment (Et øyeblikk! = One moment!)', { pos: 'noun', g: 'et' }),
      W('ei natt', 'a night (plural: netter)', { pos: 'noun', g: 'ei', alt: ['en natt'], ex: ['Vi sov godt i natt.', 'We slept well last night.'] }),
      W('inkludert', 'included', { pos: 'adj' }),
      W('nordlys', 'northern lights (nordlyset)', { pos: 'noun', g: 'et' }),
      W('mørk', 'dark (mørk – mørkere – mørkest)', { pos: 'adj' }),
      W('rolig', 'calm, quiet (rolig – roligere – roligst)', { pos: 'adj' }),
      W('billigere', 'cheaper (billig – billigere – billigst)', { pos: 'adj' }),
      W('rask', 'fast, quick (rask – raskere – raskest)', { pos: 'adj' }),
      W('eller', 'or', { pos: 'conjunction' }),
      W('en taxi', 'a taxi', { pos: 'noun', g: 'en' }),
      W('da', 'then, in that case', { pos: 'adverb' }),
      W('God tur!', 'Have a good trip!', { pos: 'phrase' }),
      W('et enkeltrom', 'a single room (et dobbeltrom = a double room)', { pos: 'noun', g: 'et' }),
    ],
    grammar: {
      title: 'Comparing: billigere, raskere, best',
      body: `<p>Add <b>-ere</b> for “more …” and <b>-est</b> for “most …”. “Than” is <b>enn</b>:</p>
<table class="mini"><tr><td>billig</td><td>billig<b>ere</b></td><td>billig<b>st</b></td></tr><tr><td>rask</td><td>rask<b>ere</b></td><td>rask<b>est</b></td></tr>
<tr><td>mørk</td><td>mørk<b>ere</b></td><td>mørk<b>est</b></td></tr></table>
<p class="formula">Bussen er billig<b>ere enn</b> taxien.</p>
<p>The most common ones are irregular – learn them as a set: <i>god – <b>bedre</b> – <b>best</b>, stor – <b>større</b> – <b>størst</b>, liten – <b>mindre</b> – <b>minst</b>, mange – <b>flere</b> – <b>flest</b></i>.</p>`,
      examples: [
        ['Toget er raskere enn bussen.', 'The train is faster than the bus.'],
        ['Oslo er større enn Tromsø.', 'Oslo is bigger than Tromsø.'],
        ['Hvilken kafé er best?', 'Which café is best?'],
      ],
      drills: [
        { type: 'fill', q: 'Bussen er ___ enn taxien. (billig)', a: 'billigere', en: 'The bus is cheaper than the taxi.' },
        { type: 'fill', q: 'Taxien er ___ enn bussen. (rask)', a: 'raskere', en: 'The taxi is faster than the bus.' },
        { type: 'fill', q: 'Oslo er ___ enn Tromsø. (stor)', a: 'større', en: 'Oslo is bigger than Tromsø.' },
        { type: 'fill', q: 'Om vinteren er det ___ i Tromsø enn i Oslo. (mørk)', a: 'mørkere', en: 'In winter it’s darker in Tromsø than in Oslo.' },
      ],
    },
    roleplay: {
      title: 'Checking in',
      partner: 'Resepsjonisten',
      lines: [
        { who: 'them', no: 'God kveld! Kan jeg hjelpe deg?', en: 'Good evening! Can I help you?' },
        { who: 'you', cue: 'Say you’ve booked a room.', accept: ['jeg har bestilt et rom', 'hei jeg har bestilt et rom'], model: 'Hei! Jeg har bestilt et rom.' },
        { who: 'them', no: 'Hva er navnet?', en: 'What’s the name?' },
        { who: 'you', cue: 'Say your name (“Navnet er …”).', accept: ['navnet er *', 'jeg heter *', 'mitt navn er *'], model: 'Navnet er {name}.' },
        { who: 'them', no: 'Takk. Et dobbeltrom i to netter?', en: 'Thank you. A double room for two nights?' },
        { who: 'you', cue: 'Say no – a single room for two nights.', accept: ['nei et enkeltrom i to netter', 'nei et enkeltrom'], model: 'Nei, et enkeltrom i to netter.' },
        { who: 'them', no: 'Å, unnskyld! Ja, et enkeltrom.', en: 'Oh, sorry! Yes, a single room.' },
        { who: 'you', cue: 'Ask if breakfast is included.', accept: ['er frokost inkludert', 'er frokosten inkludert'], model: 'Er frokost inkludert?' },
        { who: 'them', no: 'Ja, fra klokka sju. God tur!', en: 'Yes, from seven o’clock. Have a good trip!' },
        { who: 'you', cue: 'Say thank you so much.', accept: ['tusen takk', 'takk skal du ha', 'takk'], model: 'Tusen takk!' },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────── 17
  {
    id: 'u17',
    title: 'Skal vi møtes?',
    subtitle: 'Phone calls, changing plans and “because / if / that”',
    goal: 'Call someone, say you can’t come and why, and agree on a new time.',
    scene: 'Emma can’t make Friday. She calls Lars to change their plans.',
    focus: 'Listen: why can’t Emma come on Friday – and when do they meet instead?',
    dialogue: [
      ['Lars', 'Hallo, det er Lars.', 'Hello, it’s Lars.'],
      ['Emma', 'Hei, Lars! Det er Emma. Har du tid til å snakke?', 'Hi, Lars! It’s Emma. Do you have time to talk?'],
      ['Lars', 'Ja da. Hva skjer?', 'Sure. What’s up?'],
      ['Emma', 'Jeg kan dessverre ikke komme på fredag, fordi jeg må jobbe sent.', 'Unfortunately I can’t come on Friday, because I have to work late.'],
      ['Lars', 'Så synd! Passer det på lørdag i stedet?', 'What a pity! Does Saturday work instead?'],
      ['Emma', 'Ja, hvis det ikke blir for sent. Jeg skal på fest om kvelden.', 'Yes, if it isn’t too late. I’m going to a party in the evening.'],
      ['Lars', 'Hva med klokka to? Da kan vi ta en kaffe og gå en tur.', 'How about two o’clock? Then we can have a coffee and go for a walk.'],
      ['Emma', 'Perfekt. Jeg tror at det blir fint vær.', 'Perfect. I think the weather will be nice.'],
      ['Lars', 'Supert. Jeg sender deg en melding når jeg er på kafeen.', 'Great. I’ll send you a message when I’m at the café.'],
      ['Emma', 'Avtale! Vi snakkes!', 'Deal! Talk soon!'],
    ],
    words: [
      W('Har du tid til å snakke?', 'Do you have time to talk?', { pos: 'phrase' }),
      W('Hva skjer?', 'What’s up? (What’s happening?)', { pos: 'phrase' }),
      W('dessverre', 'unfortunately', { pos: 'adverb' }),
      W('sent', 'late', { pos: 'adverb' }),
      W('Så synd!', 'What a pity!', { pos: 'phrase' }),
      W('Passer det på …?', 'Does … work for you? (Passer det på lørdag?)', { pos: 'phrase', alt: ['passer det på'] }),
      W('i stedet', 'instead', { pos: 'phrase' }),
      W('en fest', 'a party', { pos: 'noun', g: 'en' }),
      W('Hva med …?', 'How about …? / What about …?', { pos: 'phrase', alt: ['hva med'] }),
      W('å gå en tur', 'to go for a walk', { pos: 'verb' }),
      W('å sende', 'to send', { pos: 'verb', forms: 'sender · sendte · har sendt' }),
      W('en melding', 'a (text) message', { pos: 'noun', g: 'en' }),
      W('at', 'that (Jeg tror at … = I think that …)', { pos: 'conjunction' }),
      W('en avtale', 'an appointment, a plan (Avtale! = Deal!)', { pos: 'noun', g: 'en' }),
      W('Vi snakkes!', 'Talk soon!', { pos: 'phrase' }),
    ],
    grammar: {
      title: '“Ikke” moves in clauses with fordi, hvis, at, når',
      body: `<p>In a normal sentence <b>ikke</b> comes after the verb: <i>Jeg kan <b>ikke</b> komme.</i></p>
<p>In a clause that starts with <b>fordi, hvis, at, når, som</b> … it comes <b>before</b> the verb:</p>
<p class="formula">… fordi jeg <b>ikke har</b> tid. &nbsp;·&nbsp; … hvis det <b>ikke regner</b>.</p>
<p>These clauses also keep normal word order (subject before verb), so V2 doesn’t apply inside them: <i>Jeg tror at <b>det blir</b> fint vær.</i> The same goes for words like <i>alltid, ofte, aldri</i>: <i>… fordi han <b>alltid</b> kommer sent.</i></p>`,
      examples: [
        ['Jeg kommer ikke, fordi jeg ikke har tid.', 'I’m not coming, because I don’t have time.'],
        ['Vi går en tur hvis det ikke regner.', 'We’ll go for a walk if it doesn’t rain.'],
        ['Hun sier at hun ikke kan komme.', 'She says that she can’t come.'],
      ],
      drills: [
        { type: 'order', tiles: ['jeg', 'fordi', 'har', 'ikke', 'tid'], a: 'fordi jeg ikke har tid', en: '… because I don’t have time' },
        { type: 'order', tiles: ['det', 'regner', 'hvis', 'ikke'], a: 'hvis det ikke regner', en: '… if it doesn’t rain' },
        { type: 'fill', q: 'Hun sier at hun ___ kan komme. (not)', a: 'ikke', en: 'She says that she can’t come.' },
        { type: 'order', tiles: ['tror', 'Jeg', 'det', 'at', 'blir', 'sol.'], a: 'Jeg tror at det blir sol.', en: 'I think it’ll be sunny.' },
      ],
    },
    roleplay: {
      title: 'Changing plans',
      partner: 'Lars',
      lines: [
        { who: 'them', no: 'Hei! Kommer du på kino på fredag?', en: 'Hi! Are you coming to the cinema on Friday?' },
        { who: 'you', cue: 'Say unfortunately you can’t, because you have to work.', accept: ['jeg kan dessverre ikke fordi jeg må jobbe', 'dessverre kan jeg ikke fordi jeg må jobbe', 'jeg kan ikke fordi jeg må jobbe', 'nei dessverre jeg må jobbe'], model: 'Jeg kan dessverre ikke, fordi jeg må jobbe.' },
        { who: 'them', no: 'Så synd! Passer det på lørdag i stedet?', en: 'What a pity! Does Saturday work instead?' },
        { who: 'you', cue: 'Say yes – and ask: how about two o’clock?', accept: ['ja hva med klokka to', 'ja hva med klokken to', 'hva med klokka to'], model: 'Ja! Hva med klokka to?' },
        { who: 'them', no: 'Perfekt. Jeg sender deg en melding.', en: 'Perfect. I’ll send you a message.' },
        { who: 'you', cue: 'Say: Deal! Talk soon!', accept: ['avtale vi snakkes', 'avtale vi sees'], model: 'Avtale! Vi snakkes!' },
      ],
    },
  },

  // ───────────────────────────────────────────────────────────── 18
  {
    id: 'u18',
    title: 'Hvordan har du det?',
    subtitle: 'Feelings, missing home and looking forward',
    goal: 'Say how you really feel, talk about missing people and what you look forward to.',
    scene: 'Sofie notices that Emma seems a bit down. They talk over a cup of tea.',
    focus: 'Listen: why is Emma a bit sad – and what is she looking forward to?',
    dialogue: [
      ['Sofie', 'Hei, Emma. Du ser litt trist ut. Hvordan har du det egentlig?', 'Hi, Emma. You look a bit sad. How are you really?'],
      ['Emma', 'Jeg er litt sliten. Og jeg savner familien min.', 'I’m a bit tired. And I miss my family.'],
      ['Sofie', 'Det forstår jeg. Det er ikke lett å bo langt hjemmefra.', 'I understand. It isn’t easy to live far from home.'],
      ['Emma', 'Nei. Mamma ringer hver søndag, men det er ikke det samme.', 'No. Mum calls every Sunday, but it isn’t the same.'],
      ['Sofie', 'Skal du hjem til jul?', 'Are you going home for Christmas?'],
      ['Emma', 'Ja! Jeg gleder meg veldig. Broren min kommer også, med barna sine.', 'Yes! I’m really looking forward to it. My brother is coming too, with his children.'],
      ['Sofie', 'Så koselig! Hvis du vil, kan du feire nyttårsaften med oss.', 'How lovely! If you like, you can celebrate New Year’s Eve with us.'],
      ['Emma', 'Virkelig? Det har jeg lyst til!', 'Really? I’d love that!'],
      ['Sofie', 'Selvfølgelig. Du er ikke alene her, vet du.', 'Of course. You’re not alone here, you know.'],
      ['Emma', 'Takk, Sofie. Nå er jeg i mye bedre humør.', 'Thanks, Sofie. Now I’m in a much better mood.'],
    ],
    words: [
      W('Hvordan har du det?', 'How are you? (How are you doing?)', { pos: 'phrase' }),
      W('å se … ut', 'to look … (Du ser trist ut = you look sad)', { pos: 'verb', ex: ['Du ser litt trist ut.', 'You look a bit sad.'] }),
      W('trist', 'sad', { pos: 'adj' }),
      W('sliten', 'tired, worn out', { pos: 'adj', forms: 'sliten · slitent · slitne' }),
      W('å savne', 'to miss (someone or something)', { pos: 'verb', forms: 'savner · savnet · har savnet' }),
      W('hjemmefra', 'from home (langt hjemmefra = far from home)', { pos: 'adverb' }),
      W('det samme', 'the same', { pos: 'phrase' }),
      W('jul', 'Christmas (God jul! = Merry Christmas!)', { pos: 'noun', g: 'ei' }),
      W('å glede seg til', 'to look forward to', { pos: 'verb', ex: ['Hun gleder seg til jul.', 'She is looking forward to Christmas.'] }),
      W('sin', 'his/her/their own (barna sine = his own children)', { pos: 'pronoun', forms: 'sin · si · sitt · sine' }),
      W('å feire', 'to celebrate', { pos: 'verb', forms: 'feirer · feiret · har feiret' }),
      W('nyttårsaften', 'New Year’s Eve', { pos: 'noun', g: 'en' }),
      W('å ha lyst til', 'to feel like, to want to', { pos: 'verb', ex: ['Jeg har lyst til å gå på kino.', 'I feel like going to the cinema.'] }),
      W('alene', 'alone', { pos: 'adverb' }),
      W('et humør', 'a mood (i godt humør = in a good mood)', { pos: 'noun', g: 'et' }),
      W('vet du', 'you know (at the end of a sentence)', { pos: 'phrase' }),
    ],
    grammar: {
      title: '“His own”: sin, si, sitt, sine',
      body: `<p>When the owner is the <b>subject of the same sentence</b>, Norwegian uses <b>sin / si / sitt / sine</b> (his/her/their own):</p>
<p class="formula">Lars ringer mora <b>si</b>. = Lars calls <b>his (own)</b> mother.</p>
<p>With <b>hans / hennes</b> it’s <i>someone else’s</i>: <i>Lars ringer mora <b>hans</b></i> = Lars calls his (another man’s) mother.</p>
<table class="mini"><tr><td>en-word</td><td>broren <b>sin</b></td></tr><tr><td>ei-word</td><td>søstera <b>si</b></td></tr><tr><td>et-word</td><td>huset <b>sitt</b></td></tr><tr><td>plural</td><td>barna <b>sine</b></td></tr></table>
<p>Never in the subject itself: <i>Moren <b>hans</b> heter Kari</i> (not <i>moren sin</i>).</p>`,
      examples: [
        ['Emma savner familien sin.', 'Emma misses her (own) family.'],
        ['Ahmed bor med kona si og barna sine.', 'Ahmed lives with his wife and his children.'],
        ['Søsteren hennes bor i Bergen.', 'Her sister lives in Bergen.'],
      ],
      drills: [
        { type: 'fill', q: 'Emma ringer mamma ___. (her own)', a: 'sin', en: 'Emma calls her mum.' },
        { type: 'fill', q: 'Ahmed bor med familien ___. (his own)', a: 'sin', en: 'Ahmed lives with his family.' },
        { type: 'fill', q: 'Broren kommer med barna ___. (his own)', a: 'sine', en: 'The brother is coming with his children.' },
        { type: 'fill', q: 'Lars er hyggelig. Moren ___ heter Kari. (his)', a: 'hans', en: 'Lars is nice. His mother is called Kari.' },
      ],
    },
    roleplay: {
      title: 'A heart-to-heart',
      partner: 'Sofie',
      lines: [
        { who: 'them', no: 'Hvordan har du det egentlig?', en: 'How are you really?' },
        { who: 'you', cue: 'Say you’re a bit tired, and you miss your family.', accept: ['jeg er litt sliten og jeg savner familien min', 'jeg er litt sliten og savner familien min'], model: 'Jeg er litt sliten, og jeg savner familien min.' },
        { who: 'them', no: 'Det forstår jeg. Skal du hjem til jul?', en: 'I understand. Are you going home for Christmas?' },
        { who: 'you', cue: 'Say yes – you’re really looking forward to it!', accept: ['ja jeg gleder meg veldig', 'ja jeg gleder meg', 'ja jeg gleder meg masse'], model: 'Ja, jeg gleder meg veldig!' },
        { who: 'them', no: 'Vil du feire nyttårsaften med oss?', en: 'Would you like to celebrate New Year’s Eve with us?' },
        { who: 'you', cue: 'Say: Really? I’d love to!', accept: ['virkelig det har jeg lyst til', 'ja det har jeg lyst til', 'virkelig ja gjerne'], model: 'Virkelig? Det har jeg lyst til!' },
        { who: 'them', no: 'Så bra! Du er ikke alene, vet du.', en: 'Great! You’re not alone, you know.' },
        { who: 'you', cue: 'Say thanks – now you’re in a much better mood.', accept: ['takk nå er jeg i mye bedre humør', 'takk nå er jeg i bedre humør'], model: 'Takk! Nå er jeg i mye bedre humør.' },
      ],
    },
  },
];
