/**
 * @fileoverview Мокированный инструмент для получения информации о дорожном трафике в городе.
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { extractCityFromQuery } from '../utils.js';

export const trafficTool = tool(
  async ({ query }) => {
    console.log(`[Tool Call] 📞 Вызван инструмент 'get_traffic_info' с запросом: "${query}"`);
    const city = extractCityFromQuery(query);
    const mockTraffic = {
      'москва': '8 баллов, затруднения в центре',
      'париж': '6 баллов, движение затруднено на кольцевой',
      'лондон': '7 баллов, плотный траффик в Сити',
      'токио': '5 баллов, движение в норме',
    };
    const result = `Информация о пробках в городе ${city}: ${mockTraffic[city.toLowerCase()] || 'нет данных'}`;
    console.log(`  [Traffic Tool] 🚗 Результат: ${result}`);
    return result;
  },
  {
    name: "get_traffic_info",
    description: "Получить актуальную информацию о дорожном трафике в указанном городе.",
    schema: z.object({
      query: z.string().describe("Запрос пользователя, содержащий название города."),
    }),
  }
); 