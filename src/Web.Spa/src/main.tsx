import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles.css';
import { App } from './App';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Không tìm thấy phần tử #root trong index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
