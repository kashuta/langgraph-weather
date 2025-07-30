import 'dotenv/config';
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fetch from "node-fetch";
import { extractCityFromQuery } from '../utils.js';

const getWeatherData = async (city) => {
  console.log(`  [Weather Tool] 🌤️ Получение реальных данных о погоде для города: ${city}`);
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    console.log("  [Weather Tool] ⚠️  API ключ OpenWeather не найден, возвращаем мокированные данные.");
    return `Мокированные данные: В городе ${city} сейчас 22°C, переменная облачность.`;
  }
  
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=ru`;
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      return `Не удалось получить данные о погоде для города ${city}.`;
    }
    
    return `Погода в городе ${data.name}: ${Math.round(data.main.temp)}°C, ${data.weather[0].description}.`;
    
  } catch (error) {
    return `Произошла ошибка при получении данных о погоде для города ${city}.`;
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