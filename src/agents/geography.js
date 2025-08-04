/**
 * @fileoverview Фабрика для создания агента-географа (GeographyAgent).
 * Этот агент отвечает на вопросы о координатах, населении и трафике.
 */

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { SystemMessage } from "@langchain/core/messages";
import { coordinatesToolWithRetry } from '../tools/coordinates-with-retry.js';
import { populationToolWithRetry } from '../tools/population-with-retry.js';
import { trafficToolWithRetry } from '../tools/traffic-with-retry.js';

/**
 * Создает и конфигурирует агента, специализирующегося на географии.
 * @param {import("@langchain/openai").ChatOpenAI} llm - Экземпляр языковой модели.
 * @returns {import("@langchain/langgraph/prebuilt").ReactAgentExecutor} Скомпилированный агент.
 */
export const createGeographyAgent = (llm) => {
  const tools = [coordinatesToolWithRetry, populationToolWithRetry, trafficToolWithRetry];
  console.log("  [Agent Factory] 🛠️  Создание GeographyAgent с инструментами: get_coordinates, get_population, get_traffic_info");
  return createReactAgent({
    llm,
    tools,
    stateModifier: new SystemMessage("Ты специалист по географии и демографии. Используй инструменты для получения координат, населения и информации о трафике."),
  });
}; 