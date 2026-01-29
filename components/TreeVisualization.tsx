import React, { useState, useEffect, useRef } from 'react';
import { Person, TreeData } from '../types';
import { Plus, User, Trash2, Heart, HeartCrack, Upload } from 'lucide-react';

// Helper component extracted to prevent re-creation on every render
const NodeCard: React.FC<{
  personId: string;
  tree: TreeData;
  onUpdate: (updatedTree: TreeData) => void;
  setFocusedNodeId: (id: string) => void;
  removeNode: (id: string) => void;
  addSpouse: (id: string, isEx?: boolean) => void;
  isMain?: boolean;
  isEx?: boolean;
}> = ({ personId, tree, onUpdate, setFocusedNodeId, removeNode, addSpouse, isMain = false, isEx = false }) => {
  const person = tree.nodes[personId];
  if (!person) return null;

  // Local state to fix focus loss issues
  const [localName, setLocalName] = useState(person.name);
  const [localBirth, setLocalBirth] = useState(person.birthDate);
  const [localDeath, setLocalDeath] = useState(person.deathDate || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local state if person changes (e.g. navigation)
  useEffect(() => {
    setLocalName(person.name);
    setLocalBirth(person.birthDate);
    setLocalDeath(person.deathDate || '');
  }, [personId, person.name, person.birthDate, person.deathDate]);

  // Commit changes on blur
  const handleBlur = () => {
    if (
        localName !== person.name || 
        localBirth !== person.birthDate || 
        localDeath !== (person.deathDate || '')
    ) {
        const updated = { ...tree };
        updated.nodes[personId] = { 
            ...updated.nodes[personId], 
            name: localName,
            birthDate: localBirth,
            deathDate: localDeath
        };
        onUpdate(updated);
    }
  };

  const handleGenderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const updated = { ...tree };
    updated.nodes[personId] = { 
        ...updated.nodes[personId], 
        gender: e.target.value as 'male' | 'female' | 'other' 
    };
    onUpdate(updated);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const updated = { ...tree };
            updated.nodes[personId] = {
                ...updated.nodes[personId],
                photoUrl: reader.result as string
            };
            onUpdate(updated);
        };
        reader.readAsDataURL(file);
    }
  };

  // Determine styling based on gender and status
  const getGenderStyles = () => {
    if (person.gender === 'male') return 'bg-blue-50 border-blue-200 hover:border-blue-400 text-blue-900';
    if (person.gender === 'female') return 'bg-pink-50 border-pink-200 hover:border-pink-400 text-pink-900';
    return 'bg-ghibli-cream border-ghibli-green hover:border-ghibli-green text-ghibli-wood';
  };

  const borderStyle = isEx ? 'border-dashed border-4' : 'border-2';

  return (
    <div 
      className={`
        relative group flex flex-col items-center p-4 rounded-xl transition-all duration-300
        ${borderStyle}
        ${getGenderStyles()}
        ${isMain 
          ? 'shadow-xl scale-110 z-10 w-64' 
          : 'shadow-sm hover:shadow-lg w-48 opacity-95 hover:opacity-100'
        }
      `}
    >
      {/* Actions Overlay */}
      <div className={`absolute -top-3 -right-3 flex gap-1 ${isMain ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity z-20`}>
         {!isMain && (
           <button 
              onClick={() => setFocusedNodeId(personId)}
              className="p-2 bg-ghibli-sky text-white rounded-full shadow-md hover:bg-blue-400"
              title="Fokuser på denne personen"
           >
             <User size={14} />
           </button>
         )}
         <button 
           onClick={() => removeNode(personId)}
           className="p-2 bg-red-400 text-white rounded-full shadow-md hover:bg-red-500"
           title="Slett"
         >
           <Trash2 size={14} />
         </button>
      </div>

      {/* Photo Placeholder / Upload */}
      <div className="relative mb-3 group/photo cursor-pointer" onClick={() => fileInputRef.current?.click()}>
        <div className={`w-16 h-16 rounded-full overflow-hidden border-2 ${isEx ? 'border-gray-400 grayscale' : 'border-ghibli-earth/30'} bg-gray-100 shadow-inner`}>
           {person.photoUrl ? (
              <img src={person.photoUrl} alt={person.name} className="w-full h-full object-cover" />
           ) : (
              <div className="w-full h-full flex items-center justify-center text-black/20">
                 <User size={24} />
              </div>
           )}
           {/* Upload Overlay */}
           <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover/photo:opacity-100 transition-opacity rounded-full">
                <Upload size={20} className="text-white" />
           </div>
        </div>
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            className="hidden" 
        />
        
        {/* Add Spouse Buttons (Only on Main) */}
        {isMain && (
           <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 flex gap-1 z-30">
               <button 
                onClick={(e) => { e.stopPropagation(); addSpouse(personId, false); }}
                className="bg-pink-400 text-white p-1.5 rounded-full hover:bg-pink-500 shadow-sm border-2 border-white"
                title="Legg til partner"
                >
                    <Heart size={14} fill="currentColor" />
                </button>
                <button 
                onClick={(e) => { e.stopPropagation(); addSpouse(personId, true); }}
                className="bg-gray-400 text-white p-1.5 rounded-full hover:bg-gray-500 shadow-sm border-2 border-white"
                title="Legg til eks-partner"
                >
                    <HeartCrack size={14} />
                </button>
           </div>
        )}
      </div>

      {/* Inputs */}
      <input 
        value={localName}
        onChange={(e) => setLocalName(e.target.value)}
        onBlur={handleBlur}
        className="w-full text-center font-serif font-bold bg-transparent border-b border-transparent hover:border-black/20 focus:border-black/40 focus:outline-none mb-1"
        placeholder="Navn"
      />
      
      {/* Gender Selection */}
      <select
        value={person.gender || 'other'}
        onChange={handleGenderChange}
        className="w-full text-center text-xs opacity-70 bg-transparent border-b border-transparent hover:border-black/20 focus:outline-none mb-2 cursor-pointer appearance-none py-1"
        style={{ textAlignLast: 'center' }}
        title="Velg kjønn"
      >
        <option value="male">Mann</option>
        <option value="female">Kvinne</option>
        <option value="other">Annet / Ukjent</option>
      </select>

      <div className="flex gap-2 w-full">
          <input 
          value={localBirth}
          onChange={(e) => setLocalBirth(e.target.value)}
          onBlur={handleBlur}
          className="w-1/2 text-center text-xs opacity-70 bg-transparent border-b border-transparent hover:border-black/20 focus:outline-none"
          placeholder="Født"
          />
           <input 
          value={localDeath}
          onChange={(e) => setLocalDeath(e.target.value)}
          onBlur={handleBlur}
          className="w-1/2 text-center text-xs opacity-70 bg-transparent border-b border-transparent hover:border-black/20 focus:outline-none"
          placeholder="Død"
          />
      </div>
      {isEx && <span className="absolute bottom-1 right-2 text-[10px] uppercase tracking-widest opacity-50 font-bold">Eks</span>}
    </div>
  );
};

// Main Tree Visualization Component
export const TreeVisualization: React.FC<{
  tree: TreeData;
  onUpdate: (t: TreeData) => void;
  focusedNodeId: string;
  setFocusedNodeId: (id: string) => void;
}> = ({ tree, onUpdate, focusedNodeId, setFocusedNodeId }) => {
  
  const focusedNode = tree.nodes[focusedNodeId];

  // Logic to add a parent
  const addParent = (childId: string) => {
    const child = tree.nodes[childId];
    // Allow more parents in UI logic if needed, but keeping simple for now
    const newParent = { 
      id: Math.random().toString(36).substr(2, 9),
      name: "Ny Forelder",
      parents: [],
      children: [childId],
      spouses: [],
      exSpouses: [],
      birthDate: ""
    };

    const updatedTree = { ...tree };
    updatedTree.nodes[newParent.id] = newParent;
    updatedTree.nodes[childId] = {
      ...child,
      parents: [...child.parents, newParent.id]
    };
    onUpdate(updatedTree);
  };

  // Logic to add a child
  const addChild = (parentId: string) => {
    const parent = tree.nodes[parentId];
    const newChild = {
      id: Math.random().toString(36).substr(2, 9),
      name: "Nytt Barn",
      parents: [parentId],
      children: [],
      spouses: [],
      exSpouses: [],
      birthDate: ""
    };

    const updatedTree = { ...tree };
    updatedTree.nodes[newChild.id] = newChild;
    updatedTree.nodes[parentId] = {
      ...parent,
      children: [...parent.children, newChild.id]
    };
    onUpdate(updatedTree);
  };

  // Logic to add spouse or ex-spouse
  const addSpouse = (personId: string, isEx: boolean = false) => {
    const person = tree.nodes[personId];
    const newSpouse = {
      id: Math.random().toString(36).substr(2, 9),
      name: isEx ? "Eks-partner" : "Partner",
      parents: [],
      children: [], 
      spouses: isEx ? [] : [personId],
      exSpouses: isEx ? [personId] : [],
      birthDate: ""
    };

    const updatedTree = { ...tree };
    updatedTree.nodes[newSpouse.id] = newSpouse;
    
    if (isEx) {
        updatedTree.nodes[personId] = {
            ...person,
            exSpouses: [...(person.exSpouses || []), newSpouse.id]
        };
    } else {
        updatedTree.nodes[personId] = {
            ...person,
            spouses: [...person.spouses, newSpouse.id]
        };
    }
    onUpdate(updatedTree);
  };
  
  const removeNode = (nodeId: string) => {
    if (Object.keys(tree.nodes).length <= 1) return; // Don't delete last node
    const updatedTree = { ...tree };
    const nodeToRemove = updatedTree.nodes[nodeId];

    // Cleanup references
    const cleanList = (list: string[]) => list?.filter(id => id !== nodeId) || [];

    nodeToRemove.parents.forEach(pId => {
       if (updatedTree.nodes[pId]) updatedTree.nodes[pId].children = cleanList(updatedTree.nodes[pId].children);
    });
    nodeToRemove.children.forEach(cId => {
      if (updatedTree.nodes[cId]) updatedTree.nodes[cId].parents = cleanList(updatedTree.nodes[cId].parents);
   });
   nodeToRemove.spouses.forEach(sId => {
      if (updatedTree.nodes[sId]) updatedTree.nodes[sId].spouses = cleanList(updatedTree.nodes[sId].spouses);
   });
   nodeToRemove.exSpouses?.forEach(sId => {
      if (updatedTree.nodes[sId]) updatedTree.nodes[sId].exSpouses = cleanList(updatedTree.nodes[sId].exSpouses);
   });

    delete updatedTree.nodes[nodeId];
    // If we deleted the focused node, reset to root or random
    if (focusedNodeId === nodeId) {
        setFocusedNodeId(tree.rootId === nodeId ? Object.keys(updatedTree.nodes)[0] : tree.rootId);
    }
    onUpdate(updatedTree);
  }

  // Recursive-ish Rendering for visualization
  if (!focusedNode) return <div>Laster...</div>;

  return (
    <div className="flex flex-col items-center gap-12 py-10 print-canvas">
      
      {/* Parents Generation */}
      <div className="flex flex-col items-center gap-4 animate-float" style={{ animationDuration: '8s' }}>
        <div className="text-ghibli-green font-serif text-sm italic opacity-60">Foreldre</div>
        <div className="flex gap-8 items-end">
            {focusedNode.parents.length > 0 ? (
                focusedNode.parents.map(pid => (
                    <NodeCard 
                      key={pid} 
                      personId={pid} 
                      tree={tree}
                      onUpdate={onUpdate}
                      setFocusedNodeId={setFocusedNodeId}
                      removeNode={removeNode}
                      addSpouse={addSpouse}
                    />
                ))
            ) : (
                <div className="p-4 border-2 border-dashed border-ghibli-green/30 rounded-xl text-ghibli-green/50 text-sm">
                    Ingen foreldre lagt til
                </div>
            )}
             
            <button 
              onClick={() => addParent(focusedNodeId)}
              className="w-12 h-12 rounded-full border-2 border-dashed border-ghibli-green/50 flex items-center justify-center text-ghibli-green hover:bg-ghibli-green/10 transition-colors"
            >
                <Plus size={20} />
            </button>
        </div>
        {/* Connector Line Vertical */}
        <div className="w-0.5 h-8 bg-ghibli-green/30"></div>
      </div>

      {/* Current Generation (Focused Node + Spouses + Exes) */}
      <div className="relative">
         <div className="flex gap-12 items-center">
             
             {/* Ex Partners (Left side) */}
             {focusedNode.exSpouses && focusedNode.exSpouses.length > 0 && (
                 <div className="flex gap-4 opacity-80">
                    {focusedNode.exSpouses.map(exId => (
                        <div key={exId} className="relative group/ex">
                             <div className="absolute top-1/2 -right-6 w-6 h-0.5 border-t-2 border-dashed border-gray-400"></div>
                             <NodeCard 
                                personId={exId}
                                tree={tree}
                                onUpdate={onUpdate}
                                setFocusedNodeId={setFocusedNodeId}
                                removeNode={removeNode}
                                addSpouse={addSpouse}
                                isEx={true}
                             />
                        </div>
                    ))}
                 </div>
             )}

             {/* Main Focus */}
             <div className="relative z-10">
                 <NodeCard 
                    personId={focusedNodeId} 
                    isMain={true}
                    tree={tree}
                    onUpdate={onUpdate}
                    setFocusedNodeId={setFocusedNodeId}
                    removeNode={removeNode}
                    addSpouse={addSpouse}
                 />
             </div>
             
             {/* Current Partners (Right side) */}
             {focusedNode.spouses.map(spouseId => (
                 <div key={spouseId} className="relative">
                    <div className="absolute top-1/2 -left-6 w-6 h-0.5 bg-ghibli-green/50"></div>
                    <NodeCard 
                      personId={spouseId}
                      tree={tree}
                      onUpdate={onUpdate}
                      setFocusedNodeId={setFocusedNodeId}
                      removeNode={removeNode}
                      addSpouse={addSpouse}
                    />
                 </div>
             ))}
         </div>
      </div>

      {/* Connector Line Vertical */}
      <div className="w-0.5 h-8 bg-ghibli-green/30"></div>

      {/* Children Generation */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-8 items-start flex-wrap justify-center">
             {focusedNode.children.length > 0 ? (
                 focusedNode.children.map(cid => (
                     <div key={cid} className="flex flex-col items-center">
                        <div className="w-0.5 h-4 bg-ghibli-green/30 mb-2"></div>
                        <NodeCard 
                          personId={cid}
                          tree={tree}
                          onUpdate={onUpdate}
                          setFocusedNodeId={setFocusedNodeId}
                          removeNode={removeNode}
                          addSpouse={addSpouse}
                        />
                     </div>
                 ))
             ) : (
                <div className="p-4 border-2 border-dashed border-ghibli-green/30 rounded-xl text-ghibli-green/50 text-sm">
                   Ingen barn
                </div>
             )}
             
             <button 
               onClick={() => addChild(focusedNodeId)}
               className="mt-6 w-12 h-12 rounded-full border-2 border-dashed border-ghibli-green/50 flex items-center justify-center text-ghibli-green hover:bg-ghibli-green/10 transition-colors"
             >
                 <Plus size={20} />
             </button>
        </div>
        <div className="text-ghibli-green font-serif text-sm italic opacity-60 mt-2">Barn</div>
      </div>

    </div>
  );
};