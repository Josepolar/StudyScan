import { createRoot } from 'react-dom/client';
import StudyScan from '../app/study-scan';
import { installDemo } from './storage';
import AuthApp from '../auth/AuthApp';
const preview=new URL(location.href).searchParams.get('demo')==='1';
if(preview)installDemo();
createRoot(document.getElementById('root')!).render(preview?<StudyScan/>:<AuthApp/>);
