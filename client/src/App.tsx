import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Members from "./pages/Members";
import Events from "./pages/Events";
import Primaries from "./pages/Primaries";
import Admin from "./pages/Admin";
import AuditLog from "./pages/AuditLog";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/chat"} component={Chat} />
      <Route path={"/members"} component={Members} />
      <Route path={"/events"} component={Events} />
      <Route path={"/primaries"} component={Primaries} />
      <Route path={"/admin"} component={Admin} />
      <Route path={"/audit"} component={AuditLog} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-center" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
