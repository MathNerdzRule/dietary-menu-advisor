export interface Restaurant {
  name: string;
  address: string;
  website?: string;
}

export interface MenuItem {
  name: string;
  description: string;
}

export interface MenuCategory {
  category: string;
  items: MenuItem[];
}

export interface RecommendationItem extends MenuItem {
  reason: string;
  url?: string;
}

export interface Recommendations {
  safe: RecommendationItem[];
  caution: RecommendationItem[];
  avoid: RecommendationItem[];
  ingredientsFound: boolean;
}

export type AppState = 
  | 'INITIAL_SEARCH'
  | 'LOADING_MENU'
  | 'CONFIRMING_RESTAURANT'
  | 'ANALYZING_MENU'
  | 'SHOWING_RESULTS';

export interface UserRestrictions {
  glutenFree: boolean;
  dairyFree: boolean;
  gastroparesis: boolean;
  allergies: string[];
  other: string;
}
