import React from 'react';
import './App.css';
import VideoUploader from './components/VideoUploader/VideoUploader';

// Main App component remains simple
function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Vid2Audio Web UI</h1>
      </header>
      <main>
        <VideoUploader />
      </main>
    </div>
  );
}

export default App;
