import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Notebook, ArrowRight, Sparkles } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 flex flex-col y2k-pattern relative overflow-hidden">
      {/* Y2K Decorative Elements */}
      <div className="absolute top-20 left-10 text-4xl opacity-20 animate-sparkle" style={{ animationDelay: '0s' }}>✨</div>
      <div className="absolute top-40 right-20 text-3xl opacity-20 animate-sparkle" style={{ animationDelay: '0.5s' }}>💚</div>
      <div className="absolute bottom-40 left-20 text-3xl opacity-20 animate-sparkle" style={{ animationDelay: '1s' }}>📝</div>
      <div className="absolute top-60 left-1/4 text-2xl opacity-20 animate-sparkle" style={{ animationDelay: '1.5s' }}>⭐</div>
      
      {/* Header */}
      <header className="container mx-auto px-4 py-6 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center shadow-sm">
              <Notebook className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold text-foreground">Progress Notebook </span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/auth')} className="rounded-full">
              Log In
            </Button>
            <Button onClick={() => navigate('/auth')} className="rounded-full shadow-sm">
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center flex-1 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 border border-primary/20 shadow-sm">
            <Sparkles className="w-4 h-4" />
            Track your goals, achieve more 
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Organize, Track, and
            <span className="text-primary"> Achieve</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-4 max-w-2xl mx-auto">
            A collaborative task tracking application where you can create notebooks, 
            add notes with tasks, and track progress both individually and as a group.
          </p>
          <div className="mt-4">
            <span className="text-3xl">(ﾉ◕ヮ◕)ﾉ*:･ﾟ✧</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-border mt-auto relative z-10">
        <div className="text-center">
          <span className="text-sm text-muted-foreground">
            © 2024 Progress Notebook. All rights reserved. 
          </span>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

