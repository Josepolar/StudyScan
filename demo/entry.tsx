import { createRoot } from 'react-dom/client';
import StudyScan from '../app/study-scan';
import { installDemo } from './storage';
installDemo();
createRoot(document.getElementById('root')!).render(<StudyScan/>);
