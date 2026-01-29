import { Person, TreeData } from './types';

export const generateId = (): string => Math.random().toString(36).substr(2, 9);

export const createNewPerson = (name: string = "Nytt Familiemedlem"): Person => ({
  id: generateId(),
  name,
  birthDate: "",
  parents: [],
  children: [],
  spouses: [],
  exSpouses: [],
});

export const createEmptyTree = (treeName: string): TreeData => {
  const rootPerson = createNewPerson("Meg");
  return {
    id: generateId(),
    name: treeName,
    nodes: { [rootPerson.id]: rootPerson },
    rootId: rootPerson.id,
    createdAt: Date.now(),
  };
};

export const MOCK_IMAGES = [
  "https://picsum.photos/200/200?random=1",
  "https://picsum.photos/200/200?random=2",
  "https://picsum.photos/200/200?random=3",
  "https://picsum.photos/200/200?random=4",
];