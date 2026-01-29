export interface Person {
  id: string;
  name: string;
  birthDate: string;
  deathDate?: string;
  photoUrl?: string;
  bio?: string;
  gender?: 'male' | 'female' | 'other';
  // Relationships
  parents: string[];
  children: string[];
  spouses: string[];
}

export interface TreeData {
  id: string;
  name: string; // The "Garden" name
  description?: string;
  nodes: Record<string, Person>;
  rootId: string; // The central node ID for initial view
  createdAt: number;
}

// For the Gemini Storyteller
export interface FamilyStory {
  title: string;
  content: string;
  mood: 'nostalgic' | 'joyful' | 'epic';
}

export enum ViewMode {
  EDIT = 'EDIT',
  VIEW = 'VIEW',
  PRINT = 'PRINT'
}