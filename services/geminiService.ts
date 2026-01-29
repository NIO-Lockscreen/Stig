import { GoogleGenAI } from "@google/genai";
import { TreeData } from '../types';

// Helper to format the tree for the AI
const formatTreeForPrompt = (tree: TreeData): string => {
  const nodes = Object.values(tree.nodes);
  if (nodes.length === 0) return "Empty tree.";

  let description = `Family Tree Name: ${tree.name}\nMembers:\n`;
  
  nodes.forEach(p => {
    description += `- Name: ${p.name} (ID: ${p.id})\n`;
    if (p.birthDate) description += `  Born: ${p.birthDate}\n`;
    if (p.deathDate) description += `  Died: ${p.deathDate}\n`;
    
    // Resolve names for relationships
    const parentNames = p.parents.map(id => tree.nodes[id]?.name).filter(Boolean).join(", ");
    if (parentNames) description += `  Parents: ${parentNames}\n`;
    
    const spouseNames = p.spouses.map(id => tree.nodes[id]?.name).filter(Boolean).join(", ");
    if (spouseNames) description += `  Spouse: ${spouseNames}\n`;
    
    const childrenNames = p.children.map(id => tree.nodes[id]?.name).filter(Boolean).join(", ");
    if (childrenNames) description += `  Children: ${childrenNames}\n`;
    
    description += "\n";
  });

  return description;
};

export const generateFamilyStory = async (tree: TreeData): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const treeContext = formatTreeForPrompt(tree);

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        You are a magical, Studio Ghibli-inspired storyteller. 
        Read the following family tree structure and weave a short, heartwarming, and slightly whimsical story about this family's history.
        Focus on the connections, the passage of time, and the "roots" of the family.
        Write the story in Norwegian (Norsk).
        Keep it under 300 words.
        
        Family Tree Data:
        ${treeContext}
      `,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Fast response
      }
    });

    return response.text || "Kunne ikke generere historie akkurat nå.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "En feil oppstod med magien (API Error). Vennligst prøv igjen senere.";
  }
};
