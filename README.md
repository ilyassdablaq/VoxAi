# VoxAI – Conversational AI Voice Platform

A modern, production-ready landing page for VoxAI, a conversational AI platform that enables businesses to build intelligent voice bots for customer support, automation, and productivity.

## 📋 Overview

VoxAI is a comprehensive platform that combines advanced speech-to-text, natural language understanding, and text-to-speech technologies to deliver real-time, human-like conversational experiences. This repository contains the marketing website and documentation portal built with modern web technologies.

### What VoxAI Does

- **Real-Time Voice Processing**: Sub-second latency speech-to-text and text-to-speech
- **Natural Language Understanding**: Context-aware intent detection and sentiment analysis
- **Multi-Language Support**: 30+ languages with automatic detection
- **Enterprise Security**: SOC 2 compliant, end-to-end encryption, GDPR ready
- **Easy Integration**: RESTful API and WebSocket support for seamless implementation
- **Analytics Dashboard**: Real-time insights into conversations and performance metrics

## ✨ Features

### Platform Features
- ✅ Real-Time Speech-to-Text with 30+ language support
- ✅ Natural text-to-speech with customizable voice profiles
- ✅ Advanced NLU powered by large language models
- ✅ Multi-channel deployment (web, mobile, phone, smart speakers)
- ✅ Workflow automation and CRM integration
- ✅ Analytics dashboard with real-time metrics
- ✅ Enterprise-grade security and compliance

### Website Features
- 🎨 Modern, responsive UI built with Tailwind CSS
- ⚡ Fast performance with Vite and React 18
- 🎬 Smooth animations with Framer Motion
- 📱 Mobile-first design
- ♿ Accessible component library (shadcn/ui)
- 🔄 Interactive voice demo widget
- 📊 Beautiful pricing and feature comparisons

## 🛠 Tech Stack

### Frontend
- **React** 18.3 – UI library
- **TypeScript** 5.8 – Type-safe JavaScript
- **Vite** 5.4 – Lightning-fast build tool
- **React Router** 6.30 – Client-side routing
- **Tailwind CSS** 3.4 – Utility-first CSS framework

### UI & Components
- **shadcn/ui** – High-quality React components
- **Radix UI** – Headless component library
- **Framer Motion** 12.38 – Animation library
- **Lucide React** – Beautiful icon library
- **Recharts** 2.15 – Chart visualization library

### Forms & Utilities
- **React Hook Form** 7.61 – Efficient form management
- **Zod** 3.25 – Schema validation
- **Sonner** 1.7 – Toast notifications
- **Embla Carousel** 8.6 – Touch carousel
- **Date-fns** 3.6 – Date utilities

### Development Tools
- **ESLint** – Code linting
- **TypeScript ESLint** – TypeScript linting
- **Playwright** – E2E testing
- **Vitest** 3.2 – Unit testing
- **PostCSS & Autoprefixer** – CSS processing

## 📦 Installation

### Prerequisites
- **Node.js** 18+ or **Bun** 1.0+
- npm, yarn, pnpm, or bun package manager

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/ilyassdablaq/voxflow-ai-site.git
   cd voxai-website
   ```

2. **Install dependencies**
   ```bash
   # Using npm
   npm install
   
   # Or using bun
   bun install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:8081/`

## 🚀 Running the Project

### Development Mode
```bash
npm run dev
```
Starts Vite dev server with hot module replacement (HMR). Open http://localhost:8081 in your browser.

### Production Build
```bash
npm run build
```
Creates an optimized production build in the `dist` directory.

### Preview Production Build
```bash
npm run preview
```
Locally preview the production build.

### Linting
```bash
npm run lint
```
Run ESLint to check code quality.

### Testing
```bash
# Run tests once
npm run test

# Watch mode
npm run test:watch
```

## 📁 Project Structure

```
voxai-website/
├── src/
│   ├── components/          # Reusable React components
│   │   ├── ui/             # shadcn/ui components
│   │   ├── Navbar.tsx      # Navigation bar
│   │   ├── Footer.tsx      # Footer
│   │   ├── VoiceDemoWidget.tsx   # Interactive demo
│   │   ├── SectionHeading.tsx    # Common section header
│   │   └── ...
│   ├── pages/              # Page components
│   │   ├── Index.tsx       # Home page
│   │   ├── Features.tsx    # Features page
│   │   ├── HowItWorks.tsx  # How it works
│   │   ├── Pricing.tsx     # Pricing plans
│   │   ├── ApiDocs.tsx     # API documentation
│   │   ├── Contact.tsx     # Contact form
│   │   └── NotFound.tsx    # 404 page
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities
│   ├── test/               # Tests
│   ├── App.tsx            # Root component
│   ├── main.tsx           # Entry point
│   ├── App.css            # Global styles
│   └── index.css          # Tailwind directives
├── public/                 # Static assets
├── vite.config.ts         # Vite configuration
├── tailwind.config.ts     # Tailwind CSS configuration
├── tsconfig.json          # TypeScript configuration
├── eslint.config.js       # ESLint configuration
└── package.json           # Dependencies and scripts
```

### Key Directories

- **`src/components`** – Reusable UI components (buttons, cards, forms, etc.)
- **`src/pages`** – Full page components that map to routes
- **`src/hooks`** – Custom React hooks for common functionality
- **`src/lib`** – Utility functions and helpers
- **`src/test`** – Test files for components and logic

## 🎨 Styling & Design

### Tailwind CSS
The project uses Tailwind CSS for styling with a custom color scheme:
- **Primary**: Cyan (#00D9FF)
- **Accent**: Purple (#A366FF)
- **Background**: Dark gray (#0D1117)
- **Foreground**: Light gray (#E6EAEF)

### Custom CSS Classes
**`src/App.css`** defines reusable styling utilities:
- `.glass` – Glassmorphism effect
- `.glow-primary` – Glowing shadow effect
- `.text-gradient` – Gradient text effect
- `.section-padding` – Consistent padding
- `.font-heading` – Custom heading font (Space Grotesk)

## 🔗 Available Routes

| Route | Description |
|-------|-------------|
| `/` | Home page with hero, features, and CTA |
| `/features` | Detailed feature list |
| `/how-it-works` | How VoxAI processes voice |
| `/pricing` | Pricing plans (Free, Pro, Enterprise) |
| `/api` | API documentation and code samples |
| `/contact` | Contact form and support info |
| `*` | 404 Not Found page |



## 🧩 Component Examples

### Using shadcn/ui Components

```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Example() {
  return (
    <div>
      <Input placeholder="Enter text..." />
      <Button>Submit</Button>
    </div>
  );
}
```

### Creating a Custom Component

```tsx
import { motion } from "framer-motion";

export default function CustomCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-6"
    >
      <h3>Hello World</h3>
    </motion.div>
  );
}
```

## 🎯 Common Development Tasks

### Adding a New Page

1. Create a new component in `src/pages/`
2. Add a route in `src/App.tsx`
3. Update navigation links in `src/components/Navbar.tsx`

Example:
```tsx
// src/pages/NewPage.tsx
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function NewPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      {/* Your content */}
      <Footer />
    </div>
  );
}
```

### Updating Colors

1. Modify CSS variables in `src/index.css` under `:root`
2. Use Tailwind color utilities (e.g., `bg-primary`, `text-accent`)

### Using Icons

```tsx
import { Mic, Zap, Globe } from "lucide-react";

<Mic className="w-5 h-5 text-primary" />
```

See [Lucide React docs](https://lucide.dev) for available icons.

## 🔍 Build & Deployment

### Build for Production

```bash
npm run build
```

This creates a `dist/` folder with optimized files ready for deployment.

### Deploy to Vercel (Recommended)

1. Push code to GitHub
2. Connect repository to Vercel
3. Vercel automatically detects Vite and deploys on push
4. Configure custom domain in Vercel dashboard



**Docker:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

## 📊 Performance Optimization

- ✅ Code splitting via Vite
- ✅ Lazy-loaded routes with React Router
- ✅ Image optimization with efficient formats
- ✅ CSS purging with Tailwind
- ✅ Minified production builds
- ✅ Caching strategies for assets

## 🐛 Debugging & Troubleshooting

### Dev Server Won't Start
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### TypeScript Errors
```bash
# Rebuild TypeScript
npx tsc --noEmit
```

### Port Already in Use
Edit `vite.config.ts` to change the port:
```typescript
server: { port: 3001 }
```

## 📚 Additional Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Vite Documentation](https://vitejs.dev/)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [Framer Motion](https://www.framer.com/motion/)

## 📄 License

This project is proprietary. All rights reserved.

## 👥 Contributing

For internal contributions, follow these guidelines:
1. Create a feature branch
2. Make your changes
3. Ensure tests pass: `npm run test`
4. Lint code: `npm run lint`
5. Submit a pull request


**Built with ❤️ using React, TypeScript, and Tailwind CSS**


