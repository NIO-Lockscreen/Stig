import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { TreeData, ViewMode } from './types';
import { createEmptyTree, generateId } from './constants';
import { Button } from './components/Button';
import { TreeVisualization } from './components/TreeVisualization';
import { generateFamilyStory } from './services/geminiService';
import { Leaf, LogOut, Printer, Sparkles, Sprout, Share2, ArrowLeft, Download, Upload } from 'lucide-react';

const App = () => {
  // State
  const [currentView, setCurrentView] = useState<'LOGIN' | 'GARDEN' | 'EDITOR'>('LOGIN');
  const [trees, setTrees] = useState<TreeData[]>([]);
  const [currentTreeId, setCurrentTreeId] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [aiStory, setAiStory] = useState<string | null>(null);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('family_trees');
    if (saved) {
      try {
        setTrees(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load trees", e);
      }
    }
  }, []);

  // Save to local storage whenever trees change
  useEffect(() => {
    if (trees.length > 0) {
      localStorage.setItem('family_trees', JSON.stringify(trees));
    }
  }, [trees]);

  const activeTree = trees.find(t => t.id === currentTreeId);

  const handleCreateTree = () => {
    const name = prompt("Hva skal treet hete?", "Familien Min");
    if (!name) return;
    const newTree = createEmptyTree(name);
    setTrees(prev => [...prev, newTree]);
    setCurrentTreeId(newTree.id);
    setFocusedNodeId(newTree.rootId);
    setCurrentView('EDITOR');
  };

  const handleOpenTree = (tree: TreeData) => {
    setCurrentTreeId(tree.id);
    // Ensure focused node is valid
    setFocusedNodeId(tree.rootId in tree.nodes ? tree.rootId : Object.keys(tree.nodes)[0]);
    setCurrentView('EDITOR');
    setAiStory(null);
  };

  const handleUpdateTree = (updatedTree: TreeData) => {
    setTrees(prev => prev.map(t => t.id === updatedTree.id ? updatedTree : t));
  };

  const handlePrint = () => {
    window.print();
  };

  const handleGenerateStory = async () => {
    if (!activeTree) return;
    setIsGeneratingStory(true);
    setAiStory(null);
    const story = await generateFamilyStory(activeTree);
    setAiStory(story);
    setIsGeneratingStory(false);
  };

  // --- EXPORT / IMPORT LOGIC ---

  const exportData = () => {
    const dataStr = JSON.stringify(trees, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `livets-tre-backup-${new Date().toISOString().slice(0, 10)}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = e.target?.result as string;
            const importedData = JSON.parse(content);

            if (Array.isArray(importedData)) {
                // Filter out duplicates based on ID to avoid crashes, or just append distinct ones
                const newTrees = importedData.filter((importedTree: TreeData) => 
                    !trees.some(existing => existing.id === importedTree.id)
                );
                
                if (newTrees.length === 0 && importedData.length > 0) {
                     alert("Dataen du importerte finnes allerede (samme ID).");
                } else {
                    setTrees(prev => [...prev, ...newTrees]);
                    alert(`Importerte ${newTrees.length} trær vellykket!`);
                }
            } else {
                alert("Filformatet ser feil ut. Det må være en backup fra denne siden.");
            }
        } catch (error) {
            console.error("Import error", error);
            alert("Kunne ikke lese filen. Er det en gyldig JSON-fil?");
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };


  // --- VIEWS ---

  const LoginView = () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Animated Clouds Background (Simple CSS implementation) */}
        <div className="absolute top-20 left-10 text-ghibli-sky/20 animate-float"><Leaf size={64} /></div>
        <div className="absolute bottom-20 right-10 text-ghibli-green/20 animate-float" style={{ animationDelay: '2s' }}><Sprout size={96} /></div>

        <div className="z-10 bg-white/80 backdrop-blur-sm p-12 rounded-[2rem] shadow-xl border border-ghibli-green/20 text-center max-w-md w-full">
            <h1 className="text-4xl font-serif text-ghibli-darkGreen mb-4">Livets Tre</h1>
            <p className="text-ghibli-earth mb-8 font-sans">Velkommen til din digitale hage. Her kan du plante minner, gro familietreet ditt, og la historiene blomstre.</p>
            
            <Button 
                onClick={() => setCurrentView('GARDEN')} 
                className="w-full justify-center text-lg py-3"
            >
                Gå inn i Hagen
            </Button>
            <p className="mt-4 text-xs text-ghibli-wood/60">Ingen passord trengs. Alt lagres lokalt i din nettleser.</p>
        </div>
    </div>
  );

  const GardenView = () => (
    <div className="min-h-screen p-8 max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center mb-12 gap-4">
            <h2 className="text-3xl font-serif text-ghibli-darkGreen flex items-center gap-3">
                <Sprout className="text-ghibli-green" />
                Min Hage
            </h2>
            
            <div className="flex flex-wrap justify-center gap-2">
                <Button variant="secondary" onClick={exportData} icon={<Download size={16} />}>
                    Eksporter
                </Button>
                <Button variant="secondary" onClick={triggerImport} icon={<Upload size={16} />}>
                    Importer
                </Button>
                <Button variant="ghost" onClick={() => setCurrentView('LOGIN')} icon={<LogOut size={18} />}>
                    Logg ut
                </Button>
                {/* Hidden File Input */}
                <input 
                    type="file" 
                    accept=".json" 
                    ref={fileInputRef} 
                    onChange={handleFileImport} 
                    className="hidden" 
                />
            </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* New Tree Card */}
            <button 
                onClick={handleCreateTree}
                className="h-64 rounded-2xl border-4 border-dashed border-ghibli-green/30 flex flex-col items-center justify-center text-ghibli-green hover:bg-white/50 hover:border-ghibli-green transition-all group"
            >
                <div className="w-16 h-16 rounded-full bg-ghibli-green/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <PlusIcon />
                </div>
                <span className="font-serif text-lg">Plant et nytt tre</span>
            </button>

            {/* Existing Trees */}
            {trees.map(tree => (
                <div key={tree.id} className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col justify-between border border-ghibli-earth/10 relative overflow-hidden h-64">
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-ghibli-green/10 rounded-full"></div>
                    <div>
                        <h3 className="text-2xl font-serif text-ghibli-darkGreen mb-2">{tree.name}</h3>
                        <p className="text-ghibli-earth text-sm">
                            {Object.keys(tree.nodes).length} medlemmer
                        </p>
                        <p className="text-ghibli-earth/60 text-xs mt-1">
                            Plantet: {new Date(tree.createdAt).toLocaleDateString()}
                        </p>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                         <Button onClick={() => handleOpenTree(tree)} variant="primary">
                            Åpne
                         </Button>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  const EditorView = () => {
    if (!activeTree || !focusedNodeId) return <div>Laster tre...</div>;

    return (
        <div className="min-h-screen flex flex-col">
            {/* Toolbar */}
            <nav className="h-16 bg-white/90 backdrop-blur shadow-sm border-b border-ghibli-earth/10 flex items-center justify-between px-6 sticky top-0 z-50 no-print">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => setCurrentView('GARDEN')}
                        className="p-2 hover:bg-gray-100 rounded-full text-ghibli-wood transition-colors"
                    >
                        <ArrowLeft />
                    </button>
                    <h2 className="text-xl font-serif text-ghibli-darkGreen">{activeTree.name}</h2>
                </div>
                
                <div className="flex items-center gap-3">
                    <Button 
                        variant="secondary" 
                        onClick={handleGenerateStory} 
                        icon={<Sparkles size={16} className={isGeneratingStory ? "animate-spin text-yellow-500" : "text-yellow-500"} />}
                        disabled={isGeneratingStory}
                    >
                        {isGeneratingStory ? "Magien jobber..." : "Fortell Historie"}
                    </Button>
                    <Button variant="secondary" onClick={handlePrint} icon={<Printer size={16} />}>
                        Utskrift
                    </Button>
                </div>
            </nav>

            {/* Main Canvas */}
            <main className="flex-1 overflow-auto bg-grid relative">
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#74a878_1px,transparent_1px)] [background-size:20px_20px] opacity-10"></div>
                
                <TreeVisualization 
                    tree={activeTree} 
                    onUpdate={handleUpdateTree} 
                    focusedNodeId={focusedNodeId}
                    setFocusedNodeId={setFocusedNodeId}
                />
            </main>

            {/* AI Story Modal / Overlay */}
            {aiStory && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 animate-in fade-in duration-300 backdrop-blur-sm no-print">
                    <div className="bg-[#fcfbf7] rounded-2xl max-w-2xl w-full p-8 shadow-2xl border-4 border-double border-ghibli-green/30 relative max-h-[80vh] overflow-y-auto">
                        <button 
                            onClick={() => setAiStory(null)}
                            className="absolute top-4 right-4 text-ghibli-wood hover:text-red-500"
                        >
                            <LogOut size={20} className="rotate-180" /> {/* Using logout icon as close for now */}
                        </button>
                        <div className="flex flex-col items-center mb-6">
                            <Sparkles className="text-yellow-500 mb-2" size={32} />
                            <h3 className="text-2xl font-serif text-ghibli-darkGreen">Familiekrøniken</h3>
                        </div>
                        <div className="prose prose-stone font-serif text-lg leading-relaxed text-ghibli-wood">
                            {aiStory.split('\n').map((paragraph, i) => (
                                <p key={i} className="mb-4">{paragraph}</p>
                            ))}
                        </div>
                        <div className="mt-8 pt-4 border-t border-ghibli-earth/10 text-center text-sm text-ghibli-earth/60 italic">
                            Generert av magisk stjernestøv (Gemini AI)
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
  };

  return (
    <>
        {currentView === 'LOGIN' && <LoginView />}
        {currentView === 'GARDEN' && <GardenView />}
        {currentView === 'EDITOR' && <EditorView />}
    </>
  );
};

const PlusIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
);

export default App;