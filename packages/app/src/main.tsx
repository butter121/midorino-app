import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '@midorino/ui/src/styles/ui.css';
import './styles.css';
import { IconSprite } from '@midorino/ui';
createRoot(document.getElementById('root')!).render(<StrictMode><IconSprite /><App /></StrictMode>);
