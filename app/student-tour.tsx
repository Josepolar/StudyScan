'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {CircleHelp,X,ArrowLeft,ArrowRight} from 'lucide-react';
import {Scout} from './mascot';
import {useDialog} from './use-dialog';

type Step={target:string;title:string;body:string;view?:string;menu?:boolean;optional?:boolean};
const workspaceSteps:Step[]=[
 {target:'.student-welcome',view:'Overview',title:'Welcome to your learning space',body:'Hi! I’m Scout. This page brings your lessons, activities, and questions together. Let’s find your way around.'},
 {target:'.stats-grid',view:'Overview',title:'Your progress at a glance',body:'These cards show your assigned lessons, lessons you marked reviewed, questions, and learning activities. You can select a card to open that area.'},
 {target:'.join-strip',view:'Overview',title:'Join your class',body:'Your teacher gives you a class code. Choose Join a class and enter that code to find your assigned lessons. Ask your teacher if you don’t have one yet.'},
 {target:'[data-tour="nav-My lessons"]',view:'Overview',menu:true,title:'Find your way around',body:'Use this menu to move between Overview, My lessons, Assignments, and My questions. On a phone, the menu button opens these links.'},
 {target:'[data-tour="lesson-search"]',view:'My lessons',title:'Find a lesson',body:'Search for a lesson title or topic, or filter by subject. You only see learning materials your teacher has assigned to you.'},
 {target:'[data-tour="lesson-results"]',view:'My lessons',title:'Open your learning material',body:'Choose Start learning on a lesson card to read it. If this area is empty, join your class or ask your teacher to assign a lesson. Inside a lesson, choose Lesson tour to learn about the study assistant.'},
 {target:'[data-tour="activities"]',view:'Assignments',title:'Check your activities',body:'Find your teacher’s instructions and due dates here. Open an activity to work on it. Some activities require independent work, so AI help may be switched off.'},
 {target:'.question-filters',view:'My questions',title:'Revisit your questions',body:'Find past learning conversations and teacher follow-ups here. Search or filter the list, then open a question to read the answer and any note from your teacher.'},
 {target:'[data-tour="student-tour"]',view:'Overview',title:'You can always take another tour',body:'Choose Quick tour whenever you need a reminder. When you open a lesson, this becomes Lesson tour. You’re ready to explore at your own pace!'}
];
const lessonSteps:Step[]=[
 {target:'.reading-header',title:'Start with your teacher’s lesson',body:'This is your teacher-approved learning material. Read the lesson first and note any part you want help understanding.'},
 {target:'.lesson-activities',optional:true,title:'Read your activity instructions',body:'Check what your teacher asks you to do and when it is due. Select an activity to set the assistant’s context, or choose Complete activity to open your work. Selecting it does not submit an answer.'},
 {target:'.attachments',title:'Keep your resources close',body:'Download any resources your teacher has attached here. If there are no attachments, use the approved lesson text above.'},
 {target:'[data-tour="review-lesson"]',title:'Keep track of your reading',body:'Choose Mark as reviewed after you have read the lesson. This updates your progress; it does not submit an activity or give you a grade.'},
 {target:'.assistant-pane header',title:'Meet your study assistant',body:'Ask for a simpler explanation, a definition, or a helpful example from this lesson. Help follows your teacher’s settings and may sometimes be unavailable.'},
 {target:'.assistant-controls',title:'Choose what you’re working on',body:'Use Lesson review for general lesson questions, or select an activity. Your teacher’s assistance rules apply to that selection.'},
 {target:'.composer',title:'Ask a question',body:'Type what you want to understand, then choose the send button. Keep passwords and personal information out of your questions. This tour won’t send anything.'},
 {target:'.chat-history',title:'Check the explanation and ask for help',body:'Your conversation appears here. When source passages are provided, open them to check the material. Use Flag for teacher on an answer if you need more help or think something is wrong. AI can make mistakes.'},
 {target:'.assistant-bubble details summary',optional:true,title:'Check the source passages',body:'Open this control to compare the explanation with the teacher-approved material used for the answer.'},
 {target:'.flag-button',optional:true,title:'Ask your teacher to take a closer look',body:'Use this when an explanation is unclear or seems incorrect. Your question is flagged for your teacher to review. Flagging is a request for follow-up, not an instant reply.'},
 {target:'.chat-history .teacher-reply',optional:true,title:'Read your teacher’s follow-up',body:'Your teacher’s clarification appears here with the conversation. You can also revisit it later in My questions.'}
];
const storageKey=(id:string)=>`studyscan.studentTour.v1.${id}`;
function wasSeen(id:string){try{return localStorage.getItem(storageKey(id))==='seen';}catch{return false;}}
function remember(id:string){try{localStorage.setItem(storageKey(id),'seen');}catch{/* Tours remain usable when storage is blocked. */}}
function useTourDialog(onClose:()=>void){
 const close=useRef(onClose);close.current=onClose;
 const previousFocus=useRef(typeof document==='undefined'?null:document.activeElement as HTMLElement|null),dialog=useDialog(()=>close.current());
 useEffect(()=>{const root=document.getElementById('root'),previous=root?.inert;if(root)root.inert=true;return()=>{if(root)root.inert=previous||false;const target=previousFocus.current?.isConnected?previousFocus.current:document.querySelector<HTMLElement>('[data-tour="student-tour"]');target?.focus({preventScroll:true});};},[]);
 return dialog;
}

export default function StudentTour({userId,view,onNavigate}:{userId:string;view:string;onNavigate:(view:string,menu:boolean)=>void}){
 const [welcome,setWelcome]=useState(false),[session,setSession]=useState<{lesson:boolean;returnView:string;steps:Step[]}|null>(null);
 useEffect(()=>{setWelcome(!wasSeen(userId));},[userId]);
 const start=()=>{const lesson=view==='Lesson';setWelcome(false);setSession({lesson,returnView:view,steps:(lesson?lessonSteps:workspaceSteps).filter(step=>!step.optional||document.querySelector(step.target))});};
 const close=()=>{remember(userId);setWelcome(false);if(session&&!session.lesson)onNavigate(session.returnView,false);setSession(null);};
 return <><button data-tour="student-tour" className="button small tour-trigger" onClick={start}><CircleHelp size={17}/><span>{view==='Lesson'?'Lesson tour':'Quick tour'}</span></button>{welcome&&!session&&createPortal(<TourWelcome onStart={start} onClose={close}/>,document.body)}{session&&createPortal(<TourSteps steps={session.steps} onNavigate={onNavigate} onClose={close}/>,document.body)}</>;
}
function TourWelcome({onStart,onClose}:{onStart:()=>void;onClose:()=>void}){
 const dialog=useTourDialog(onClose);
 return <div className="student-tour-overlay"><section className="tour-card tour-welcome" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="tour-welcome-title" aria-describedby="tour-welcome-body"><button className="tour-close icon-button" aria-label="Skip tour" onClick={onClose}><X size={18}/></button><Scout small/><span className="tour-kicker">LET SCOUT SHOW YOU AROUND</span><h2 id="tour-welcome-title">A little tour. A confident start.</h2><p id="tour-welcome-body">Discover your lessons, activities, and where to ask for help. We’ll highlight one thing at a time. You can stop whenever you like.</p><div className="tour-actions"><button className="button" onClick={onClose}>Maybe later</button><button className="button primary" onClick={onStart}>Show me around <ArrowRight size={16}/></button></div><small>Replay it anytime using Quick tour.</small></section></div>;
}
function TourSteps({steps,onNavigate,onClose}:{steps:Step[];onNavigate:(view:string,menu:boolean)=>void;onClose:()=>void}){
 const [index,setIndex]=useState(0),[rect,setRect]=useState<{left:number;top:number;width:number;height:number}|null>(null),[position,setPosition]=useState({left:16,top:16});
 const dialog=useTourDialog(onClose),navigate=useRef(onNavigate),step=steps[index];navigate.current=onNavigate;
 useEffect(()=>{
  setRect(null);if(step.view)navigate.current(step.view,!!step.menu);
  let frame=0,attempts=0,target:HTMLElement|null=null;
  const measure=()=>{
   const width=window.innerWidth,height=window.innerHeight,card=dialog.current;
   const cardWidth=card?.getBoundingClientRect().width||Math.min(360,width-32),cardHeight=card?.getBoundingClientRect().height||280;
   const bounds=target?.getBoundingClientRect();
   const visible=bounds&&bounds.width>0&&bounds.height>0&&bounds.bottom>0&&bounds.top<height&&bounds.right>0&&bounds.left<width;
   if(visible){
    const left=Math.max(6,bounds.left-6),top=Math.max(6,bounds.top-6),right=Math.min(width-6,bounds.right+6),bottom=Math.min(height-6,bounds.bottom+6);
    setRect({left,top,width:Math.max(0,right-left),height:Math.max(0,bottom-top)});
    const below=bottom+14,above=top-cardHeight-14;
    setPosition({left:Math.max(16,Math.min(left,width-cardWidth-16)),top:below+cardHeight<=height-16?below:above>=16?above:Math.max(16,height-cardHeight-16)});
   }else{setRect(null);setPosition({left:Math.max(16,(width-cardWidth)/2),top:Math.max(16,(height-cardHeight)/2)});}
  };
  const locate=()=>{
   target=document.querySelector<HTMLElement>(step.target);
   if(target&&target.getClientRects().length){target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});frame=requestAnimationFrame(measure);}
   else if(attempts++<60)frame=requestAnimationFrame(locate);else measure();
  };
  frame=requestAnimationFrame(locate);
  const observer=new ResizeObserver(measure);if(dialog.current)observer.observe(dialog.current);
  window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);document.addEventListener('transitionend',measure,true);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);document.removeEventListener('transitionend',measure,true);};
 },[step,dialog]);
 return <div className="student-tour-overlay tour-active"><div className={`tour-spotlight ${rect?'':'tour-no-target'}`} style={rect||undefined} aria-hidden="true"/><section className="tour-card tour-step" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="tour-step-title" aria-describedby="tour-step-body" style={position}><button className="tour-close icon-button" aria-label="Close tour" onClick={onClose}><X size={18}/></button><div className="tour-step-label"><Scout small/><span>SCOUT’S GUIDE · {index+1} OF {steps.length}</span></div><div aria-live="polite" aria-atomic="true"><h2 id="tour-step-title">{step.title}</h2><p id="tour-step-body">{step.body}</p></div><progress aria-label="Tour progress" value={index+1} max={steps.length}/><div className="tour-actions"><button className="tour-skip" onClick={onClose}>Skip tour</button><span className="spacer"/>{index>0&&<button className="button small" onClick={()=>setIndex(index-1)}><ArrowLeft size={15}/>Back</button>}<button className="button primary small" onClick={()=>index===steps.length-1?onClose():setIndex(index+1)}>{index===steps.length-1?'Finish':'Next'}{index<steps.length-1&&<ArrowRight size={15}/>}</button></div></section></div>;
}
