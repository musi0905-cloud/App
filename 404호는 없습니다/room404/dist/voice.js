// Phone-call voice playback using the device's built-in Korean text-to-speech.
// Web: speechSynthesis. Capacitor app: TextToSpeech plugin when installed (Android WebView has no speechSynthesis).
// Each speaker gets a fixed pitch/rate so the guard and the other party sound different.
const SOUND_KEY='404_sound';
const SPEAKERS={
 '경비원':{pitch:.95,rate:1},
 '주민':{pitch:1.2,rate:1.02},
 '관리실':{pitch:1.05,rate:1.05},
 '방문객':{pitch:1.1,rate:1},
 '가족':{pitch:1.25,rate:.98},
 '회사 직원':{pitch:1,rate:1.08},
 '자동 응답':{pitch:.8,rate:.92},
 '모르는 사람':{pitch:.6,rate:.88}
};
export const SPEAKER_NAMES=Object.keys(SPEAKERS);

function nativeTTS(){return window.Capacitor?.isNativePlatform?.()?window.Capacitor.Plugins?.TextToSpeech:null}
function webTTS(){return typeof window.speechSynthesis==='object'&&typeof window.SpeechSynthesisUtterance==='function'?window.speechSynthesis:null}

export function soundOn(){try{return localStorage.getItem(SOUND_KEY)!=='off'}catch{return true}}
export function setSoundOn(on){try{localStorage.setItem(SOUND_KEY,on?'on':'off')}catch{}}
export function voiceAvailable(){return Boolean(nativeTTS()||webTTS())}
// iOS only speaks if the first utterance starts inside a user gesture: say nothing, right now, to unlock later speech.
let primed=false;
export function primeVoice(){if(primed)return;const synth=webTTS();if(!synth)return;try{synth.getVoices();const u=new SpeechSynthesisUtterance(' ');u.volume=0;u.lang='ko-KR';synth.speak(u);primed=true}catch{}}

function koreanVoice(synth){const voices=synth.getVoices();return voices.find(v=>/^ko(-|_|$)/i.test(v.lang))||null}

// Speak one line. Resolves when finished or cancelled; never rejects so playback can move on.
function speakLine(text,who,session){
 const p=SPEAKERS[who]||SPEAKERS['주민'];
 const native=nativeTTS();
 if(native)return native.speak({text,lang:'ko-KR',rate:p.rate,pitch:p.pitch,volume:1,category:'playback'}).catch(()=>{});
 const synth=webTTS();if(!synth)return Promise.resolve();
 return new Promise(resolve=>{
  const u=new SpeechSynthesisUtterance(text);u.lang='ko-KR';u.pitch=p.pitch;u.rate=p.rate;const v=koreanVoice(synth);if(v)u.voice=v;
  u.onend=u.onerror=()=>resolve();session.resolveCurrent=resolve;synth.speak(u);
 });
}

let active=null;
export function stopVoice(){
 if(!active)return;active.cancelled=true;active.resolveCurrent?.();active=null;
 nativeTTS()?.stop?.().catch?.(()=>{});webTTS()?.cancel();
}

// Play lines [{who,text}] in order. onLine(index) marks the line being spoken; -1 when done.
export async function playDialogue(lines,onLine=()=>{}){
 stopVoice();const session={cancelled:false};active=session;
 for(let i=0;i<lines.length;i++){
  if(session.cancelled)return false;onLine(i);
  await speakLine(lines[i].text,lines[i].who,session);
  if(!session.cancelled)await new Promise(r=>setTimeout(r,250));
 }
 if(active===session)active=null;
 if(!session.cancelled)onLine(-1);
 return !session.cancelled;
}
