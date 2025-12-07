export type UserRole = 'owner' | 'admin' | 'reader';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  completedBy: string[]; // user IDs who completed this task
  createdAt: Date;
}

export interface Note {
  id: string;
  title: string;
  tasks: Task[];
  createdAt: Date;
}

export interface NotebookMember {
  userId: string;
  role: UserRole;
  joinedAt: Date;
}

export interface Notebook {
  id: string;
  title: string;
  notes: Note[];
  ownerId: string;
  members: NotebookMember[];
  isShared: boolean;
  createdAt: Date;
}

export interface NotebookProgress {
  completed: number;
  total: number;
  percentage: number;
}

export function calculateNoteProgress(note: Note, userId?: string): NotebookProgress {
  const total = note.tasks.length;
  if (total === 0) return { completed: 0, total: 0, percentage: 0 };
  
  const completed = userId 
    ? note.tasks.filter(task => task.completedBy.includes(userId)).length
    : note.tasks.filter(task => task.completed).length;
  
  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
  };
}

export function calculateNotebookProgress(notebook: Notebook, userId?: string): NotebookProgress {
  const allTasks = notebook.notes.flatMap(note => note.tasks);
  const total = allTasks.length;
  if (total === 0) return { completed: 0, total: 0, percentage: 0 };
  
  const completed = userId
    ? allTasks.filter(task => task.completedBy.includes(userId)).length
    : allTasks.filter(task => task.completed).length;
  
  return {
    completed,
    total,
    percentage: Math.round((completed / total) * 100),
  };
}

export function calculateGroupAverageProgress(notebook: Notebook): NotebookProgress {
  if (notebook.members.length === 0) return { completed: 0, total: 0, percentage: 0 };
  
  const memberProgresses = notebook.members.map(member => 
    calculateNotebookProgress(notebook, member.userId)
  );
  
  const avgPercentage = Math.round(
    memberProgresses.reduce((sum, p) => sum + p.percentage, 0) / notebook.members.length
  );
  
  return {
    completed: 0,
    total: 0,
    percentage: avgPercentage,
  };
}
