/**
 * @fileoverview Инструмент для получения информации о погоде.
 * Использует реальные данные от WeatherAPI.com, если доступен ключ, или возвращает мокированные данные.
 */

import 'dotenv/config';
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fetch from "node-fetch";
import { extractCityFromQuery } from '../utils.js';

const getWeatherData = async (city) => {
  console.log(`  [Weather Tool] 🌤️ Получение реальных данных о погоде для города: ${city}`);
  // Используем новую переменную окружения
  const apiKey = process.env.WEATHERAPI_COM_KEY;

  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    console.log("  [Weather Tool] ⚠️  API ключ WeatherAPI.com не найден, возвращаем мокированные данные.");
    return `Мокированные данные: В городе ${city} сейчас 22°C, переменная облачность.`;
  }
  
  try {
    // Новый URL и параметры запроса
    const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(city)}&aqi=no&lang=ru`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      // Обработка ошибок для нового API
      const errorMessage = data.error ? data.error.message : 'Неизвестная ошибка API';
      console.error(`  [Weather Tool] ❌ Ошибка от API WeatherAPI.com: ${errorMessage}`);
      return `Не удалось получить данные о погоде для города ${city}. Причина: ${errorMessage}.`;
    }
    
    // Парсинг нового формата ответа
    const { location, current } = data;
    return `Погода в городе ${location.name}: ${current.temp_c}°C, ${current.condition.text}.`;
    
  } catch (error) {
    console.error(`  [Weather Tool] ❌ Критическая ошибка при запросе к API:`, error);
    return `Произошла критическая ошибка при получении данных о погоде для города ${city}.`;
  }
};

export const weatherTool = tool(
  async ({ query }) => {
    console.log(`[Tool Call] 📞 Вызван инструмент 'get_weather' с запросом: "${query}"`);
    const city = extractCityFromQuery(query);
    return await getWeatherData(city);
  },
  {
    name: "get_weather",
    description: "Получить актуальную информацию о погоде в указанном городе.",
    schema: z.object({
      query: z.string().describe("Запрос пользователя, содержащий название города."),
    }),
  }
);
