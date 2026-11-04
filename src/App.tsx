import { Dashboard } from "@/routes/index";
import { ThemeProvider } from "@/context/ThemeContext";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  return (
    <ThemeProvider>
      <Dashboard />
      <Toaster position="top-right" richColors />
    </ThemeProvider>
  );
}

