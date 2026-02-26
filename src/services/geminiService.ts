import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Restaurant, Recommendations, UserRestrictions } from "../types";
import { GP_CONTEXT, DIABETIC_CONTEXT, DEFAULT_SEARCH_CONTEXT } from "../constants";

// Helper to extract JSON from AI markdown blocks
const extractJSON = (text: string) => {
  const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("JSON Parse Error", e);
      return null;
    }
  }
  return null;
};

export const createGeminiService = (apiKey: string) => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ 
    model: "gemini-flash-latest" 
  });

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    const prompt = `Convert these coordinates to a "City, State" string: ${lat}, ${lng}`;
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  };

  const findRestaurantAndGetMenu = async (query: string, location: string = DEFAULT_SEARCH_CONTEXT) => {
    const prompt = `Use Google Search to find the specific restaurant: "${query}" in "${location}". 
    Return a JSON object with:
    restaurant: { name, address, website }
    menu: Array of categories, each containing an array of items { name, description }.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} } as any],
    });
    
    return extractJSON(result.response.text());
  };

  const searchNearbyRestaurants = async (location: string, radius: number, restrictions: UserRestrictions): Promise<Restaurant[]> => {
    const restrictionStr = [
      restrictions.glutenFree ? "Gluten-Free" : "",
      restrictions.dairyFree ? "Dairy-Free" : "",
      restrictions.vegan ? "Vegan" : "",
      restrictions.vegetarian ? "Vegetarian" : "",
      restrictions.lowSodium ? "Low-Sodium" : "",
      restrictions.keto ? "Keto" : "",
      restrictions.diabetic ? "Diabetic friendly" : "",
      restrictions.gastroparesis ? "Gastroparesis friendly" : "",
      ...restrictions.allergies,
      restrictions.other
    ].filter(Boolean).join(", ");

    const prompt = `Use Google Search to find restaurants within ${radius} miles of "${location}" that are suitable for someone with these dietary needs: ${restrictionStr}.
    Return a JSON array of objects, each with: { name, address, website }.
    Only return highly relevant matches.`;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} } as any],
    });

    return extractJSON(result.response.text()) || [];
  };

  const getRecommendations = async (restaurant: Restaurant, menu: any, restrictions: UserRestrictions): Promise<Recommendations> => {
    const restrictionStr = [
      restrictions.glutenFree ? "Gluten-Free" : "",
      restrictions.dairyFree ? "Dairy-Free" : "",
      restrictions.vegan ? "Vegan" : "",
      restrictions.vegetarian ? "Vegetarian" : "",
      restrictions.lowSodium ? "Low-Sodium" : "",
      restrictions.keto ? "Keto" : "",
      restrictions.diabetic ? "Diabetic" : "",
      restrictions.gastroparesis ? "Gastroparesis" : "",
      ...restrictions.allergies,
      restrictions.other
    ].filter(Boolean).join(", ");

    const gpPrompt = restrictions.gastroparesis ? GP_CONTEXT : "";
    const diabeticPrompt = restrictions.diabetic ? DIABETIC_CONTEXT : "";

    const prompt = `
      Analyze this menu for "${restaurant.name}" against these restrictions: ${restrictionStr}.
      ${gpPrompt}
      ${diabeticPrompt}
      
      Verify ingredients via Google Search.
      IMPORTANT: For the 'url' field, only provide a direct, verified link to the specific menu item or the restaurant's official menu page if found. If a direct item link isn't available, use a reputable third-party menu source (like DoorDash, UberEats, or Yelp). Do not provide placeholder or broken links.
      Return a JSON object with:
      safe: Array of items { name, description, reason, url }.
      caution: Array of items { name, description, reason, url }.
      avoid: Array of items { name, description, reason, url } - These are items that are STRICTLY FORBIDDEN (e.g., if GP, include items with beef, whole grains, nuts, or high fiber skins).
      ingredientsFound: boolean (true if you found ingredient info via search).
      
      Menu JSON: ${JSON.stringify(menu)}
    `;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} } as any],
    });

    return extractJSON(result.response.text());
  };

  const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string, mimeType: string } }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = (reader.result as string).split(',')[1];
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type
          }
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const analyzeImage = async (imageFile: File, restaurant: Restaurant, restrictions: UserRestrictions): Promise<Recommendations> => {
    const restrictionStr = [
      restrictions.glutenFree ? "Gluten-Free" : "",
      restrictions.dairyFree ? "Dairy-Free" : "",
      restrictions.vegan ? "Vegan" : "",
      restrictions.vegetarian ? "Vegetarian" : "",
      restrictions.lowSodium ? "Low-Sodium" : "",
      restrictions.keto ? "Keto" : "",
      restrictions.diabetic ? "Diabetic" : "",
      restrictions.gastroparesis ? "Gastroparesis" : "",
      ...restrictions.allergies,
      restrictions.other
    ].filter(Boolean).join(", ");

    const gpPrompt = restrictions.gastroparesis ? GP_CONTEXT : "";
    const diabeticPrompt = restrictions.diabetic ? DIABETIC_CONTEXT : "";

    const prompt = `
      Analyze the captured menu items in this image for "${restaurant.name}" against these restrictions: ${restrictionStr}.
      ${gpPrompt}
      ${diabeticPrompt}
      
      Identify the items in the image. If more than one item is present, analyze each one.
      Verify ingredients via Google Search if possible to be extra sure.
      IMPORTANT: For the 'url' field, only provide a direct, verified link to the specific menu item or the restaurant's official menu page if found. If a direct item link isn't available, use a reputable third-party menu source (like DoorDash, UberEats, or Yelp). Do not provide placeholder or broken links.
      Return a JSON object with:
      safe: Array of items { name, description, reason, url }.
      caution: Array of items { name, description, reason, url }.
      avoid: Array of items { name, description, reason, url }.
      ingredientsFound: boolean (true if you could identify the items and their ingredients).
    `;

    const imageParts = await fileToGenerativePart(imageFile);

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }, imageParts] }],
      tools: [{ googleSearch: {} } as any],
    });

    return extractJSON(result.response.text());
  };

  return { reverseGeocode, findRestaurantAndGetMenu, searchNearbyRestaurants, getRecommendations, analyzeImage };
};

export const withRetry = async <T>(fn: () => Promise<T>, retries = 3): Promise<T> => {
  try {
    return await fn();
  } catch (e) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 1000));
      return withRetry(fn, retries - 1);
    }
    throw e;
  }
};
