import { Link } from "react-router-dom";
import { Mic } from "lucide-react";

const Footer = () => (
  <footer className="border-t border-border bg-card/30">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <Link to="/" className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
              <Mic className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="font-heading font-bold text-foreground">
              Vox<span className="text-primary">AI</span>
            </span>
          </Link>
          <p className="text-sm text-muted-foreground">
            AI-powered conversational voice platform for modern businesses.
          </p>
        </div>

        <div>
          <h4 className="font-heading font-semibold text-sm text-foreground mb-3">Product</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <Link to="/features" className="block hover:text-foreground transition-colors">Features</Link>
            <Link to="/pricing" className="block hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/api" className="block hover:text-foreground transition-colors">API Docs</Link>
          </div>
        </div>

        <div>
          <h4 className="font-heading font-semibold text-sm text-foreground mb-3">Company</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <Link to="/how-it-works" className="block hover:text-foreground transition-colors">How It Works</Link>
            <Link to="/contact" className="block hover:text-foreground transition-colors">Contact</Link>
          </div>
        </div>

        <div>
          <h4 className="font-heading font-semibold text-sm text-foreground mb-3">Legal</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <span className="block">Privacy Policy</span>
            <span className="block">Terms of Service</span>
          </div>
        </div>
      </div>

      <div className="mt-10 pt-6 border-t border-border text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} VoxAI. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;
