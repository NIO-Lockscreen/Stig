import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { TreeData, ViewMode, Person } from './types';
import { createEmptyTree, generateId } from './constants';
import { Button } from './components/Button';
import { TreeVisualization } from './components/TreeVisualization';
import { generateFamilyStory } from './services/geminiService';
import { Leaf, LogOut, Printer, Sparkles, Sprout, Share2, ArrowLeft, Download, Upload, X, Trash2, Search, GitMerge, User } from 'lucide-react';

const App = () => {
  // State
  const [currentView, setCurrentView] = useState<'LOGIN' | 'GARDEN' | 'EDITOR'>('LOGIN');
  const [trees, setTrees] = useState<TreeData[]>([]);
  const [currentTreeId, setCurrentTreeId] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [aiStory, setAiStory] = useState<string | null>(null);
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);
  
  // Modals
  const [isCreatingTree, setIsCreatingTree] = useState(false);
  const [isMergingTree, setIsMergingTree] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [newTreeName, setNewTreeName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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
    } else {
        localStorage.removeItem('family_trees');
    }
  }, [trees]);

  const activeTree = trees.find(t => t.id === currentTreeId);

  const startCreateTree = () => {
    setNewTreeName("Familien Min");
    setIsCreatingTree(true);
  };

  const confirmCreateTree = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTreeName.trim()) return;

    const newTree = createEmptyTree(newTreeName);
    setTrees(prev => [...prev, newTree]);
    setCurrentTreeId(newTree.id);
    setFocusedNodeId(newTree.rootId);
    setCurrentView('EDITOR');
    setIsCreatingTree(false);
  };

  const handleDeleteTree = (treeId: string) => {
    if (window.confirm("Er du helt sikker på at du vil hugge ned (slette) dette familietreet? Dette kan ikke angres.")) {
        setTrees(prev => prev.filter(t => t.id !== treeId));
        if (currentTreeId === treeId) {
            setCurrentTreeId(null);
            setFocusedNodeId(null);
        }
    }
  };

  const handleMergeTree = (targetTreeId: string) => {
    if (!activeTree) return;
    const targetTree = trees.find(t => t.id === targetTreeId);
    if (!targetTree) return;

    if (!window.confirm(`Vil du flette "${targetTree.name}" inn i "${activeTree.name}"? Dette vil legge alle personer til i denne hagen. Du må koble dem sammen manuelt etterpå.`)) {
        return;
    }

    // Merge nodes
    const mergedNodes = { ...activeTree.nodes, ...targetTree.nodes };
    const updatedTree = { ...activeTree, nodes: mergedNodes };
    
    setTrees(prev => prev.map(t => t.id === activeTree.id ? updatedTree : t));
    setIsMergingTree(false);
    alert(`Hagen "${targetTree.name}" er nå en del av denne hagen! Bruk søkefunksjonen for å finne de nye personene.`);
  };

  const handleOpenTree = (tree: TreeData) => {
    setCurrentTreeId(tree.id);
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
        if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };


  // --- VIEWS ---

  const LoginView = () => (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden">
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
            <button 
                onClick={startCreateTree}
                className="h-64 rounded-2xl border-4 border-dashed border-ghibli-green/30 flex flex-col items-center justify-center text-ghibli-green hover:bg-white/50 hover:border-ghibli-green transition-all group"
            >
                <div className="w-16 h-16 rounded-full bg-ghibli-green/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <PlusIcon />
                </div>
                <span className="font-serif text-lg">Plant et nytt tre</span>
            </button>

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
                         <Button onClick={() => handleDeleteTree(tree.id)} variant="danger" icon={<Trash2 size={16} />} title="Slett tre" />
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
            <nav className="h-16 bg-white/90 backdrop-blur shadow-sm border-b border-ghibli-earth/10 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-50 no-print">
                <div className="flex items-center gap-2 lg:gap-4 overflow-hidden">
                    <button 
                        onClick={() => setCurrentView('GARDEN')}
                        className="p-2 hover:bg-gray-100 rounded-full text-ghibli-wood transition-colors flex-shrink-0"
                    >
                        <ArrowLeft />
                    </button>
                    <h2 className="text-lg lg:text-xl font-serif text-ghibli-darkGreen truncate">{activeTree.name}</h2>
                </div>
                
                <div className="flex items-center gap-2">
                    <Button 
                        variant="secondary" 
                        onClick={() => setIsSearching(true)} 
                        icon={<Search size={16} />} 
                        className="hidden md:flex"
                    >
                        Finn person
                    </Button>
                    <button 
                        onClick={() => setIsSearching(true)} 
                        className="md:hidden p-2 text-ghibli-wood hover:bg-black/5 rounded-full"
                    >
                        <Search size={20} />
                    </button>
                    
                    <Button 
                        variant="secondary" 
                        onClick={() => setIsMergingTree(true)} 
                        icon={<GitMerge size={16} />}
                        title="Flett inn en annen hage"
                        className="hidden md:flex"
                    >
                        Flett Hage
                    </Button>

                    <Button 
                        variant="secondary" 
                        onClick={handleGenerateStory} 
                        icon={<Sparkles size={16} className={isGeneratingStory ? "animate-spin text-yellow-500" : "text-yellow-500"} />}
                        disabled={isGeneratingStory}
                        className="hidden md:flex"
                    >
                        {isGeneratingStory ? "Magien jobber..." : "Historie"}
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

            {/* AI Story Modal */}
            {aiStory && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 animate-in fade-in duration-300 backdrop-blur-sm no-print">
                    <div className="bg-[#fcfbf7] rounded-2xl max-w-2xl w-full p-8 shadow-2xl border-4 border-double border-ghibli-green/30 relative max-h-[80vh] overflow-y-auto">
                        <button 
                            onClick={() => setAiStory(null)}
                            className="absolute top-4 right-4 text-ghibli-wood hover:text-red-500"
                        >
                            <LogOut size={20} className="rotate-180" /> 
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
                    </div>
                </div>
            )}

            {/* Search/Find Person Modal */}
            {isSearching && (
                 <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-[#fcfbf7] rounded-2xl max-w-md w-full p-6 shadow-2xl h-[500px] flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-serif text-ghibli-darkGreen">Finn Person</h3>
                            <button onClick={() => setIsSearching(false)}><X size={20} /></button>
                        </div>
                        <input 
                            type="text" 
                            placeholder="Søk etter navn..." 
                            className="w-full p-3 rounded-lg border border-ghibli-earth/20 mb-4 focus:outline-none focus:border-ghibli-green"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            autoFocus
                        />
                        <div className="flex-1 overflow-y-auto space-y-2">
                            {Object.values(activeTree.nodes)
                                .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                .map(p => (
                                    <button 
                                        key={p.id}
                                        onClick={() => { setFocusedNodeId(p.id); setIsSearching(false); }}
                                        className="w-full text-left p-3 hover:bg-ghibli-green/10 rounded-lg flex items-center gap-3 transition-colors"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
                                            {p.photoUrl ? <img src={p.photoUrl} className="w-full h-full object-cover" /> : <User size={20} className="m-1.5 opacity-50"/>}
                                        </div>
                                        <div>
                                            <div className="font-bold text-ghibli-darkGreen">{p.name}</div>
                                            <div className="text-xs text-ghibli-earth">{p.birthDate || 'Ingen dato'}</div>
                                        </div>
                                    </button>
                                ))
                            }
                        </div>
                    </div>
                 </div>
            )}

             {/* Merge Tree Modal */}
             {isMergingTree && (
                 <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-[#fcfbf7] rounded-2xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-serif text-ghibli-darkGreen">Flett inn Hage</h3>
                            <button onClick={() => setIsMergingTree(false)}><X size={20} /></button>
                        </div>
                        <p className="text-sm text-ghibli-earth mb-4">Velg en hage du vil hente personer fra. Dette vil legge alle personene inn i din nåværende hage, men de vil ikke være koblet sammen automatisk.</p>
                        
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {trees.filter(t => t.id !== activeTree.id).length === 0 ? (
                                <p className="text-center italic text-gray-400 py-4">Ingen andre hager funnet.</p>
                            ) : (
                                trees.filter(t => t.id !== activeTree.id).map(t => (
                                    <button 
                                        key={t.id}
                                        onClick={() => handleMergeTree(t.id)}
                                        className="w-full text-left p-4 border border-ghibli-earth/20 rounded-xl hover:bg-ghibli-green/10 transition-colors group"
                                    >
                                        <div className="font-bold text-ghibli-darkGreen group-hover:text-ghibli-green">{t.name}</div>
                                        <div className="text-xs text-ghibli-earth">{Object.keys(t.nodes).length} personer</div>
                                    </button>
                                ))
                            )}
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

        {/* Create Tree Modal */}
        {isCreatingTree && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                <form 
                    onSubmit={confirmCreateTree}
                    className="bg-[#fcfbf7] rounded-2xl max-w-md w-full p-8 shadow-2xl border-2 border-ghibli-green relative"
                >
                    <button 
                        type="button"
                        onClick={() => setIsCreatingTree(false)}
                        className="absolute top-4 right-4 text-ghibli-wood/50 hover:text-ghibli-wood"
                    >
                        <X size={20} />
                    </button>
                    
                    <h3 className="text-2xl font-serif text-ghibli-darkGreen mb-6 text-center">Gi navn til treet ditt</h3>
                    
                    <input 
                        autoFocus
                        type="text" 
                        value={newTreeName}
                        onChange={(e) => setNewTreeName(e.target.value)}
                        className="w-full text-center text-xl font-serif p-2 bg-transparent border-b-2 border-ghibli-green/30 focus:border-ghibli-green focus:outline-none mb-8 placeholder-ghibli-earth/30"
                        placeholder="F.eks. Familien Hansen"
                    />

                    <div className="flex justify-center gap-4">
                        <Button type="button" variant="secondary" onClick={() => setIsCreatingTree(false)}>
                            Avbryt
                        </Button>
                        <Button type="submit" variant="primary">
                            Plant Treet
                        </Button>
                    </div>
                </form>
            </div>
        )}
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