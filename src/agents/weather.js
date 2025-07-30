/**
 * @fileoverview Фабрика для создания агента-синоптика (WeatherAgent).
 * Этот агент специализируется на ответах на вопросы о погоде.
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { SystemMessage } from "@langchain/core/messages";
import { weatherTool } from '../tools/weather.js';

/**
 * Создает и конфигурирует агента, специализирующегося на погоде.
 * @param {import("@langchain/openai").ChatOpenAI} llm - Экземпляр языковой модели.
 * @returns {import("@langchain/langgraph/prebuilt").ReactAgentExecutor} Скомпилированный агент.
 */
export const createWeatherAgent = (llm) => {
  console.log("  [Agent Factory] 🛠️  Создание WeatherAgent с инструментом: get_weather");
  return createReactAgent({
    llm,
    tools: [weatherTool],
    stateModifier: new SystemMessage("Ты специалист по погоде. Используй инструмент get_weather для ответа на вопросы о погоде."),
  });
}; 