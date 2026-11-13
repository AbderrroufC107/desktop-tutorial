import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '../components/ui.jsx';
import '../styles.css';

export function mount(Page) {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ToastProvider><Page /></ToastProvider>
    </StrictMode>
  );
}
