import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Layout from "./components/Layout";

// Pages
import Home from "./pages/Home";
import Article from "./pages/Article";
import Archive from "./pages/Archive";
import Search from "./pages/Search";
import About from "./pages/About";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import AdminArticles from "./pages/admin/Articles";
import AdminArticleEditor from "./pages/admin/ArticleEditor";
import AdminComments from "./pages/admin/Comments";
import AdminTags from "./pages/admin/Tags";
import AdminSeries from "./pages/admin/Series";

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/" component={Home} />
      <Route path="/article/:slug" component={Article} />
      <Route path="/archive" component={Archive} />
      <Route path="/search" component={Search} />
      <Route path="/about" component={About} />
      
      {/* Admin Routes */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/articles" component={AdminArticles} />
      <Route path="/admin/articles/new" component={AdminArticleEditor} />
      <Route path="/admin/articles/:id/edit" component={AdminArticleEditor} />
      <Route path="/admin/comments" component={AdminComments} />
      <Route path="/admin/tags" component={AdminTags} />
      <Route path="/admin/series" component={AdminSeries} />
      
      {/* 404 */}
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
