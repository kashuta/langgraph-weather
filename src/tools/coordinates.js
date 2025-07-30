import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { extractCityFromQuery } from '../utils.js';

export const coordinatesTool = tool(
  async ({ query }) => {
    console.log(`[Tool Call] 📞 Вызван инструмент 'get_coordinates' с запросом: "${query}"`);
    const city = extractCityFromQuery(query);
    const mockCoordinates = {
      'москва': '55.7558° N, 37.6173° E',
      'париж': '48.8566° N, 2.3522° E',
      'лондон': '51.5074° N, 0.1278° W',
      'токио': '35.6895° N, 139.6917° E',
    };
    const result = `Координаты города ${city}: ${mockCoordinates[city.toLowerCase()] || 'не найдены'}`;
    console.log(`  [Coordinates Tool] 🗺️  Результат: ${result}`);
    return result;
  },
  {
    name: "get_coordinates",
    description: "Получить географические координаты для указанного города.",
    schema: z.object({
      query: z.string().describe("Запрос пользователя, содержащий название города."),
    }),
  }
); 