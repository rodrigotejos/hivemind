import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ProjectView from './pages/ProjectView';
import MessagesView from './pages/MessagesView';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen text-zinc-300 selection:bg-indigo-500/30">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects/:id" element={<ProjectView />} />
          <Route path="/projects/:id/messages" element={<MessagesView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
