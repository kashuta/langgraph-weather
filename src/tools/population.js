import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { extractCityFromQuery } from '../utils.js';

export const populationTool = tool(
  async ({ query }) => {
    console.log(`[Tool Call] 📞 Вызван инструмент 'get_population' с запросом: "${query}"`);
    const city = extractCityFromQuery(query);
    const mockPopulation = {
      'москва': '12.6 млн',
      'париж': '2.1 млн',
      'лондон': '8.9 млн',
      'токио': '14.0 млн',
    };
    const result = `Население города ${city}: ~${mockPopulation[city.toLowerCase()] || 'неизвестно'}`;
    console.log(`  [Population Tool] 👨‍👩‍👧‍👦 Результат: ${result}`);
    return result;
  },
  {
    name: "get_population",
    description: "Получить примерное количество населения в указанном городе.",
    schema: z.object({
      query: z.string().describe("Запрос пользователя, содержащий название города."),
    }),
  }
); 