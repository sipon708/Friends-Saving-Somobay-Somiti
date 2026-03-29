import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const analyzeFinancials = async (data: any) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following cooperative society financial data and provide insights in Bengali:
      ${JSON.stringify(data)}
      
      Focus on:
      1. Yearly profit trends.
      2. Loan risk assessment.
      3. Expense growth alerts.
      4. Suggestions for improvement.`,
      config: {
        systemInstruction: "You are a professional financial analyst for cooperative societies in Bangladesh. Respond in clear, professional Bengali.",
      },
    });

    return response.text;
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return "দুঃখিত, এই মুহূর্তে এআই বিশ্লেষণ করা সম্ভব হচ্ছে না।";
  }
};
