# Implementation Plan - Dietary Menu Advisor

Building a premium, AI-powered menu advisor for users with strict dietary needs.

## 1. Project Setup

- [x] Initialize Vite/React/TS project.
- [ ] Install dependencies (`@google/genai`, `tailwindcss`, `lucide-react`, `framer-motion`).
- [ ] Configure Tailwind for premium aesthetics.

## 2. Global Styling & Design System

- [ ] **Color Palette**: "Nourish" (Sage greens, soft creams, healthy accents).
- [ ] **Typography**: "Outfit" or "Inter" for clarity and premium feel.
- [ ] **Glassmorphism**: Soft, organic blur panels.
- [ ] **Transitions**: Smooth state changes using Framer Motion.

## 3. Core Logic (Services)

- [ ] `geminiService.ts`: Implement `findRestaurantAndGetMenu` and `getRecommendations` with Google Search tool and thinking budget.
- [ ] `types.ts`: Define strict TypeScript interfaces for Menu, Restaurant, and State.
- [ ] `constants.ts`: Store dietary restriction data and AI prompts.

## 4. Components

- [ ] `CombinedStartScreen`: Hero section + 2-step animated form.
- [ ] `LoadingSpinner`: Engagement messages with premium circular animations.
- [ ] `RestaurantConfirmation`: High-confidence card display.
- [ ] `ResultsDisplay`: Organized safe/caution cards with ingredient verification status.

## 5. Deployment

- [ ] Initialize Git.
- [ ] Push to `dietary-menu-advisor` repo.
- [ ] Connect to Vercel.
