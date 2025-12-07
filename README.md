# EchoTasks

A collaborative task tracking application where users can create notebooks, add notes with tasks, and track progress both individually and as a group.

## Features

- 📓 **Notebooks**: Organize your work into multiple notebooks
- 📝 **Notes**: Create notes within notebooks
- ✅ **Tasks**: Add tasks to notes and track completion
- 👥 **Collaboration**: Share notebooks with others via share codes
- 📊 **Progress Tracking**: Visualize individual and group progress
- 🔐 **Authentication**: Secure user authentication with Supabase
- 🎨 **Modern UI**: Built with shadcn/ui and Tailwind CSS

## Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn
- Supabase account (or local Supabase setup)

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

Get your Supabase credentials from your project dashboard (Settings → API).

### 3. Run Database Migrations

Apply the database migrations from the `supabase/migrations` folder to your Supabase project.

### 4. Start Development Server

```bash
npm run dev
```

The app will be available at http://localhost:8080

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **Backend**: Supabase (PostgreSQL with Row Level Security)
- **State Management**: React Context API + TanStack Query
- **Routing**: React Router v6
- **Form Handling**: React Hook Form + Zod

## Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # shadcn/ui component library
│   └── ...             # Feature components
├── pages/              # Route pages
├── context/            # React Context providers
├── hooks/              # Custom React hooks
├── integrations/       # Third-party integrations (Supabase)
├── types/              # TypeScript type definitions
└── lib/                # Utility functions
```

## Deployment

Build the project for production:

```bash
npm run build
```

The `dist` folder will contain the production-ready files that can be deployed to any static hosting service (Vercel, Netlify, etc.).

## License

This project is private and proprietary.
