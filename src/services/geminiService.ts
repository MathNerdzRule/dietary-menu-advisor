import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Restaurant, Recommendations, UserRestrictions } from "../types";
import { GP_CONTEXT, DEFAULT_SEARCH_CONTEXT } from "../constants";

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
    model: "gemini-3-flash" 
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

  const getRecommendations = async (restaurant: Restaurant, menu: any, restrictions: UserRestrictions): Promise<Recommendations> => {
    const restrictionStr = [
      restrictions.glutenFree ? "Gluten-Free" : "",
      restrictions.dairyFree ? "Dairy-Free" : "",
      restrictions.gastroparesis ? "Gastroparesis" : "",
      ...restrictions.allergies,
      restrictions.other
    ].filter(Boolean).join(", ");

    const gpPrompt = restrictions.gastroparesis ? GP_CONTEXT : "";

    const prompt = `
      Analyze this menu for "${restaurant.name}" against these restrictions: ${restrictionStr}.
      ${gpPrompt}
      
      Verify ingredients via Google Search.
      Return a JSON object with:
      safe: Array of items { name, description, reason, url }.
      caution: Array of items { name, description, reason, url }.
      ingredientsFound: boolean (true if you found ingredient info via search).
      
      Menu JSON: ${JSON.stringify(menu)}
    `;

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} } as any],
    });

    return extractJSON(result.response.text());
  };

  return { reverseGeocode, findRestaurantAndGetMenu, getRecommendations };
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
