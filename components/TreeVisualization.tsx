import React from 'react';
import { Person, TreeData } from '../types';
import { Plus, User, Trash2, Heart } from 'lucide-react';

// Helper component extracted to prevent re-creation on every render (fixes input focus bug)
const NodeCard: React.FC<{
  personId: string;
  tree: TreeData;
  onUpdate: (updatedTree: TreeData) => void;
  setFocusedNodeId: (id: string) => void;
  removeNode: (id: string) => void;
  addSpouse: (id: string) => void;
  isMain?: boolean;
}> = ({ personId, tree, onUpdate, setFocusedNodeId, removeNode, addSpouse, isMain = false }) => {
  const person = tree.nodes[personId];
  if (!person) return null;

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated = { ...tree };
    updated.nodes[personId] = { ...updated.nodes[personId], name: e.target.value };
    onUpdate(updated);
  };

  const handleBirthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated = { ...tree };
    updated.nodes[personId] = { ...updated.nodes[personId], birthDate: e.target.value };
    onUpdate(updated);
  };

  const handleDeathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const updated = { ...tree };
    updated.nodes[personId] = { ...updated.nodes[personId], deathDate: e.target.value };
    onUpdate(updated);
  };

  const handleGenderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const updated = { ...tree };
    updated.nodes[personId] = { 
        ...updated.nodes[personId], 
        gender: e.target.value as 'male' | 'female' | 'other' 
    };
    onUpdate(updated);
  };

  return (
    <div 
      className={`
        relative group flex flex-col items-center p-4 rounded-xl border-2 transition-all duration-300
        ${isMain 
          ? 'bg-ghibli-cream border-ghibli-green shadow-xl scale-110 z-10 w-64' 
          : 'bg-white/80 border-ghibli-earth/20 hover:border-ghibli-green hover:shadow-lg w-48 opacity-90 hover:opacity-100'
        }
      `}
    >
      {/* Actions Overlay (Only visible on hover or if main) */}
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

      {/* Photo Placeholder */}
      <div className="relative mb-3">
        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-ghibli-earth/30 bg-gray-100">
           {person.photoUrl ? (
              <img src={person.photoUrl} alt={person.name} className="w-full h-full object-cover" />
           ) : (
              <div className="w-full h-full flex items-center justify-center text-ghibli-wood/40">
                 <User size={24} />
              </div>
           )}
        </div>
        {/* Add Spouse Button */}
        {isMain && (
           <button 
             onClick={() => addSpouse(personId)}
             className="absolute -bottom-1 -right-1 bg-pink-400 text-white p-1 rounded-full hover:bg-pink-500 shadow-sm"
             title="Legg til partner"
           >
              <Heart size={12} />
           </button>
        )}
      </div>

      {/* Inputs */}
      <input 
        value={person.name}
        onChange={handleNameChange}
        className="w-full text-center font-serif font-bold text-ghibli-wood bg-transparent border-b border-transparent hover:border-ghibli-green focus:border-ghibli-green focus:outline-none mb-1"
        placeholder="Navn"
      />
      
      {/* Gender Selection */}
      <select
        value={person.gender || 'other'}
        onChange={handleGenderChange}
        className="w-full text-center text-xs text-ghibli-wood/70 bg-transparent border-b border-transparent hover:border-ghibli-green focus:outline-none mb-2 cursor-pointer appearance-none py-1"
        style={{ textAlignLast: 'center' }}
        title="Velg kjønn"
      >
        <option value="male">Mann</option>
        <option value="female">Kvinne</option>
        <option value="other">Annet / Ukjent</option>
      </select>

      <div className="flex gap-2 w-full">
          <input 
          value={person.birthDate}
          onChange={handleBirthChange}
          className="w-1/2 text-center text-xs text-ghibli-wood/70 bg-transparent border-b border-transparent hover:border-ghibli-green focus:outline-none"
          placeholder="Født (År)"
          />
           <input 
          value={person.deathDate || ''}
          onChange={handleDeathChange}
          className="w-1/2 text-center text-xs text-ghibli-wood/70 bg-transparent border-b border-transparent hover:border-ghibli-green focus:outline-none"
          placeholder="Død (År)"
          />
      </div>
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
    if (child.parents.length >= 2) return; // Limit to 2 biological parents for simplicity

    const newParent = { 
      id: Math.random().toString(36).substr(2, 9),
      name: "Ny Forelder",
      parents: [],
      children: [childId],
      spouses: [],
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

  // Logic to add spouse
  const addSpouse = (personId: string) => {
    const person = tree.nodes[personId];
    const newSpouse = {
      id: Math.random().toString(36).substr(2, 9),
      name: "Ektefelle",
      parents: [],
      children: [], // Could share children logic later
      spouses: [personId],
      birthDate: ""
    };

    const updatedTree = { ...tree };
    updatedTree.nodes[newSpouse.id] = newSpouse;
    updatedTree.nodes[personId] = {
      ...person,
      spouses: [...person.spouses, newSpouse.id]
    };
    onUpdate(updatedTree);
  };
  
  const removeNode = (nodeId: string) => {
    if (Object.keys(tree.nodes).length <= 1) return; // Don't delete last node
    const updatedTree = { ...tree };
    const nodeToRemove = updatedTree.nodes[nodeId];

    // Cleanup references
    nodeToRemove.parents.forEach(pId => {
       if (updatedTree.nodes[pId]) {
         updatedTree.nodes[pId].children = updatedTree.nodes[pId].children.filter(id => id !== nodeId);
       }
    });
    nodeToRemove.children.forEach(cId => {
      if (updatedTree.nodes[cId]) {
        updatedTree.nodes[cId].parents = updatedTree.nodes[cId].parents.filter(id => id !== nodeId);
      }
   });
   nodeToRemove.spouses.forEach(sId => {
      if (updatedTree.nodes[sId]) {
        updatedTree.nodes[sId].spouses = updatedTree.nodes[sId].spouses.filter(id => id !== nodeId);
      }
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
             {focusedNode.parents.length < 2 && (
                <button 
                  onClick={() => addParent(focusedNodeId)}
                  className="w-12 h-12 rounded-full border-2 border-dashed border-ghibli-green/50 flex items-center justify-center text-ghibli-green hover:bg-ghibli-green/10 transition-colors"
                >
                    <Plus size={20} />
                </button>
            )}
        </div>
        {/* Connector Line Vertical */}
        <div className="w-0.5 h-8 bg-ghibli-green/30"></div>
      </div>

      {/* Current Generation (Focused Node + Spouses) */}
      <div className="relative">
         <div className="absolute top-1/2 left-0 w-full h-0.5 bg-ghibli-green/20 -z-10 transform -translate-y-1/2"></div>
         <div className="flex gap-8 items-center">
             
             <NodeCard 
               personId={focusedNodeId} 
               isMain={true}
               tree={tree}
               onUpdate={onUpdate}
               setFocusedNodeId={setFocusedNodeId}
               removeNode={removeNode}
               addSpouse={addSpouse}
             />
             
             {focusedNode.spouses.map(spouseId => (
                 <div key={spouseId} className="relative">
                    <div className="absolute top-1/2 -left-4 w-4 h-0.5 bg-ghibli-green/50"></div>
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
