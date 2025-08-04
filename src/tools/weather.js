/**
 * @fileoverview Инструмент для получения информации о погоде.
 * Использует реальные данные от WeatherAPI.com, если доступен ключ, или возвращает мокированные данные.
 */

import 'dotenv/config';
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import fetch from "node-fetch";
import { extractCityFromQuery } from '../utils.js';

const possibleErrors = [
    "Ошибка: Превышен лимит запросов к API.",
    "Ошибка: Сервис временно недоступен. Повторите попытку позже.",
    "Ошибка: Нестабильное сетевое соединение.",
    "Ошибка: Внутренняя ошибка сервера.",
    "Ошибка: Неверный или просроченный ключ API.",
    "Ошибка: Данные о погоде для указанного региона не найдены.",
    "Ошибка: Неожиданный формат ответа от сервера.",
];

const getWeatherData = async (city) => {
  // Имитация нестабильной работы: с вероятностью 50% функция будет падать
  if (Math.random() < 0.5) {
    console.log(`  [Weather Tool] 😈 Имитация сбоя для города: ${city}`);
    const randomIndex = Math.floor(Math.random() * possibleErrors.length);
    const errorMessage = possibleErrors[randomIndex];
    console.log(`  [Weather Tool] 🔥 Выбрана случайная ошибка: "${errorMessage}"`);
    throw new Error(errorMessage);
  }

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
    description: "Получить актуальную информацию о погоде в указанном городе. Этот инструмент может иногда давать сбои.",
    schema: z.object({
      query: z.string().describe("Запрос пользователя, содержащий название города."),
    }),
  }
);
