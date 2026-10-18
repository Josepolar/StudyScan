import type { Lesson, Policy } from './types';
export function availability(policy:Policy, now=Date.now()) {
 if(!policy.enabled) return 'Your teacher has disabled assistance for this lesson.';
 if(policy.starts && now < Date.parse(policy.starts)) return 'Assistance is not available yet. Check the schedule set by your teacher.';
 if(policy.ends && now > Date.parse(policy.ends)) return 'The assistance window has ended. Please ask your teacher for help.';
 return null;
}
const stop = new Set('what why how when where which can could would should does do is are am it this that the a an to of in on for and or me you please explain help understand simpler terms with my i about'.split(' '));
const words = (value:string) => [...new Set(value.toLowerCase().match(/[a-z0-9]{3,}/g)||[])].filter(word=>!stop.has(word));
const overviewWords = new Set('main idea ideas key point points summarize summarise summary overview review lesson module topic material materials notes simple simply learn learning teach tell'.split(' '));
export function passages(lesson:Lesson, query:string) {
 const terms=words(query);
 const lessonTerms=new Set(words(`${lesson.title} ${lesson.topic}`));
 // Broad requests about this lesson use its actual source text even when the
 // topic label (e.g. Electricity) never appears inside the individual passages.
 // A topic name alone must not admit an unrelated question appended to it.
 const overview=terms.length>0&&terms.every(term=>lessonTerms.has(term)||overviewWords.has(term))&&
   (terms.some(term=>lessonTerms.has(term))||/\b(lesson|module|topic|materials?)\b/i.test(query));
 return lesson.content.split(/\n\s*\n/).map((text,i)=>({label:`${lesson.title} · passage ${i+1}`,text,score:terms.reduce((n,t)=>n+(new RegExp(`\\b${t}\\b`,'i').test(text)?1:0),0)})).filter(p=>p.text.trim()&&(overview||p.score>0)).sort((a,b)=>overview?0:b.score-a.score).slice(0,4);
}
export function blockedTopic(policy:Policy, query:string) {return policy.blockedTopics.split(/[\n,]/).map(x=>x.trim().toLowerCase()).filter(Boolean).some(t=>query.toLowerCase().includes(t));}
