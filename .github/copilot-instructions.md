# Progress Notebook - AI Coding Agent Instructions

## Architecture Overview

**Progress Notebook** is a collaborative task tracking application built with React, Vite, TypeScript, and Supabase. The architecture separates UI components from business logic through custom hooks and context providers.

### Core Components

- **Frontend**: React 18 (with TypeScript) + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL with Row Level Security)
- **State Management**: React Context (auth) + TanStack React Query + local useState
- **Drag & Drop**: @dnd-kit library for notebook/note/task reordering
- **Form Handling**: React Hook Form + Zod validation
- **Routing**: React Router v6

### Data Model & Hierarchy

```
Notebook (owner_id, is_shared, share_code, order_index)
├── Note (notebook_id, order_index)
│   ├── Task (note_id, folder_id, completed, completedBy[], order_index)
│   └── TaskFolder (note_id, is_collapsed, order_index)
├── NotebookMember (user_id, role: owner|admin|reader)
└── Profile (user_id, name, email, avatar_url)
```

Key insight: Tasks track `completedBy[]` array of user IDs, enabling **per-user progress tracking** alongside global completion status.

## Critical Developer Workflows

### Setup & Local Development

```bash
# Install dependencies (uses Bun by default)
npm install

# Configure environment (add to .env):
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_key

# Apply database migrations to your Supabase project
# (migrations are in supabase/migrations/)

# Start dev server on port 8080
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### Database Migrations

Supabase migrations in `supabase/migrations/` are applied sequentially. Key points:
- All table operations use UUID primary keys
- Row Level Security (RLS) is enabled with policies based on `notebook_members` table
- Helper functions `is_notebook_member()` and `get_notebook_role()` are used in RLS policies
- When adding schema changes, create new SQL files and update RLS policies accordingly

## Project-Specific Patterns

### 1. **useNotebooks Hook** - Main Business Logic (`src/hooks/useNotebooks.ts`)

The `useNotebooks()` hook centralizes all notebook/note/task operations. It:
- Fetches notebooks where user is owner OR member
- Manages nested data structure (notebooks → notes → tasks/folders)
- Provides mutations for all CRUD operations
- Uses TanStack React Query for query invalidation
- Implements optimistic UI updates

Key pattern: All mutations accept `notebookId`, `noteId`, `taskId` in sequence matching the data hierarchy.

**Example usage in components:**
```tsx
const { notebooks, addNote, renameNote, deleteNote, toggleTask, refetch } = useNotebooks();
```

### 2. **AuthContext** - Authentication & Profile (`src/context/AuthContext.tsx`)

Manages Supabase auth state and user profiles:
- Subscribes to `auth.onAuthStateChange()` for real-time session updates
- Fetches user profile from `profiles` table
- Uses `localStorage` for session persistence
- Important: Profile fetch is deferred with `setTimeout` to prevent deadlocks

Access via:
```tsx
const { user, session, profile, loading, signUp, signIn, signOut } = useAuth();
```

### 3. **Drag & Drop with @dnd-kit** (`src/components/NotebookView.tsx`, `NoteCard.tsx`)

Notes and tasks use @dnd-kit for reordering:
- **Notes** reorder within a notebook using `rectSortingStrategy`
- **Tasks** reorder within a note using vertical sorting
- All reordering uses `arrayMove()` then calls mutation with new `order_index` values
- `SortableNoteCard` and `SortableTaskItem` provide drag handles
- Sensors: `PointerSensor` + `KeyboardSensor` for accessibility

After drag ends, call the reorder mutation:
```tsx
const newOrder = arrayMove(items, oldIndex, newIndex).map((item, idx) => ({
  id: item.id,
  order_index: idx
}));
onReorderNotes(notebookId, newOrder);
```

### 4. **Progress Calculations** (`src/types/notebook.ts` + `NotebookView.tsx`)

Two progress tracking modes:

1. **Per-user progress**: Filter tasks by `task.completedBy.includes(userId)`
2. **Group average**: Calculate average completion % across all members

```tsx
function calculateProgress(notebook: Notebook, userId: string) {
  const allTasks = notebook.notes.flatMap(note => note.tasks);
  const completed = allTasks.filter(task => task.completedBy.includes(userId)).length;
  return { completed, total: allTasks.length, percentage: Math.round((completed / total) * 100) };
}
```

### 5. **Supabase Client** (`src/integrations/supabase/client.ts`)

Single instance exported as `supabase` client. Configuration:
- Uses `localStorage` for session persistence
- Auto-refresh tokens enabled
- Load from: `import { supabase } from '@/integrations/supabase/client'`

## Component Structure Conventions

### Layout Components
- **NotebookSidebar**: Left sidebar with notebook list, create/delete/join UI
- **NotebookView**: Main content area; contains progress bars, notes grid, members panel
- **MembersPanel**: Right panel showing notebook members and sharing controls

### Feature Components
- **NoteCard**: Single note with task list, folder organization, and inline editing
- **SortableNoteCard/SortableTaskItem/SortableFolderItem**: Wraps draggable content with drag handle
- **TaskItem**: Individual task with checkbox, completion indicators, inline rename
- **TaskFolder**: Collapsible folder for organizing tasks within a note

### Shared UI
- All UI components in `src/components/ui/` from shadcn/ui
- Use Tailwind classes directly; avoid inline styles
- Icons from lucide-react

## Integration Patterns

### Adding a Notebook Feature

1. **Add database schema** in `supabase/migrations/TIMESTAMP_*.sql`
2. **Update RLS policies** to use `is_notebook_member()` or `get_notebook_role()`
3. **Add hook mutation** in `useNotebooks.ts` following existing mutation patterns
4. **Add component** in `src/components/` using the hook
5. **Call from NotebookView** by passing action handlers as props

### Cross-Component Communication

Use unidirectional data flow:
- Parent (`Index.tsx` → `NotebookView.tsx`) holds selected notebook state
- Parent calls hook functions and passes them as `onAction` props to children
- Children call props; parent updates via mutations
- **No direct child-to-child communication** - always flow through parent

### External Dependencies

- **@supabase/supabase-js**: Database, auth, real-time subscriptions
- **@tanstack/react-query**: Server state caching (currently minimal usage)
- **@dnd-kit**: Drag-drop library with Sortable adapters
- **react-hook-form + zod**: Form validation (imported from ui components)
- **sonner**: Toast notifications

## TypeScript & Type Conventions

- Types in `src/types/notebook.ts` for domain models
- Component-specific types defined inline
- Use `interface` for object shapes, `type` for unions/utility types
- Enable `strictNullChecks: false` in tsconfig.json (relaxed typing)
- No-implicit-any disabled (allows `any` type)

## Path Aliases

Use `@/` for src-relative imports:
```tsx
import { useNotebooks } from '@/hooks/useNotebooks';
import { NotebookView } from '@/components/NotebookView';
import { supabase } from '@/integrations/supabase/client';
```

## Common Gotchas & Best Practices

1. **Session persistence**: Supabase handles this via localStorage; don't manually manage
2. **Profile updates**: After auth changes, use `refetchProfile()` to sync user data
3. **Order indices**: Always use `order_index` field for sorting, not database insertion order
4. **Folder cascades**: Deleting a TaskFolder triggers `ON DELETE CASCADE` on tasks
5. **Toast notifications**: Use `toast.success()`, `toast.error()` from sonner (not built-in toaster)
6. **Drag handle events**: Stop propagation with `e.stopPropagation()` in drag listeners
7. **RLS debugging**: Check Supabase Dashboard → Authentication → RLS for policy violations
