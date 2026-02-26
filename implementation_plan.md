# Implementation Plan - Dietary Menu Advisor

Building a premium, AI-powered menu advisor for users with strict dietary needs.

## 1. Project Setup & Deployment

- [x] Initialize Vite/React/TS project.
- [x] Install dependencies (`@google/genai`, `tailwindcss`, `lucide-react`, `framer-motion`).
- [x] Configure Tailwind v4 for premium aesthetics with "Nourish" color theme.
- [x] Initialize Git and push to GitHub.
- [x] Deploy to Vercel with environment variable configuration for Gemini API.

## 2. Global Styling & Design System

- [x] **Color Palette**: "Nourish" (Sage greens, soft creams, healthy accents).
- [x] **Typography**: "Outfit" (Google Font) for clarity and premium feel.
- [x] **Glassmorphism**: Soft, organic blur panels for a high-end medical/wellness aesthetic.
- [x] **Transitions**: Smooth state changes using Framer Motion (Slide-and-fade).

## 3. Core Logic (Services)

- [x] `geminiService.ts`: Implement `findRestaurantAndGetMenu` and `getRecommendations` using `gemini-3-flash-latest` with Google Search tool.
- [x] `types.ts`: Defined strict TypeScript interfaces for Restaurants, MenuItems, and AppState.
- [x] `constants.ts`: Contextual prompts for dietary restrictions (including detailed Gastroparesis logic).

## 4. Features & UI Flow

- [x] **Streamlined 2-Step Search**:
  - 1. Search for restaurant & location.
  - 2. Confirm location & set dietary restrictions (Core + Allergies + Custom "Other").
- [x] **Location Services**: Integrated GPS detection with manual city/state/zip override.
- [x] **Loading Indicators**: Targeted messaging for discovery vs. menu analysis phases.
- [x] **Results Display**:
  - **Best Choices**: Green-themed safe items.
  - **Eat with Caution**: Amber-themed restricted items.
  - **Strictly Avoid**: Red-themed exclusion list for high-risk items (e.g., beef/fiber for GP).

## 5. Completed & Refined

- [x] Removed hardcoded API keys for security.
- [x] Generic marketing blurbs (removing condition-specific text from landing).
- [x] Static loading/error notes (removed pulsing animations).
