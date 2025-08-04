/**
 * @fileoverview Фабрика для создания агента-географа с логикой Human-in-the-Loop (HITL).
 */

import { tool } from "@langchain/core/tools";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { SystemMessage } from "@langchain/core/messages";
import {
  coordinatesToolWithRetry,
  populationToolWithRetry,
  trafficToolWithRetry,
} from "../tools/index.js"; // Предполагается, что будет index-файл

/**
 * Имитирует расчет уверенности в ответе.
 * @param {string} _result - Результат для анализа (не используется в моке).
 * @returns {number} Случайное число от 0 до 1.
 */
const calculateConfidence = (_result) => {
    const confidence = Math.random();
    console.log(`  [HITL Confidence Check] 🎲 Расчетная уверенность: ${confidence.toFixed(2)}`);
    return confidence;
};


/**
 * Оборачивает populationTool, добавляя проверку уверенности.
 * Возвращает JSON-строку, чтобы передать структурированные данные через ReAct агента.
 */
const populationToolWithCheck = tool(async (input) => {
  console.log(`[Tool Call] 📞 Вызван инструмент 'populationToolWithCheck' с запросом: "${input.query}"`);
  const result = await populationToolWithRetry.func(input);
  const confidence = calculateConfidence(result);

  // Всегда возвращаем структурированный JSON
  return JSON.stringify({
    tool: "get_population",
    content: result,
    confidence: confidence,
  });
}, {
    name: "get_population",
    description: populationToolWithRetry.description,
    schema: populationToolWithRetry.schema,
});

/**
 * Создает и конфигурирует агента-географа с HITL-логикой.
 * @param {import("@langchain/openai").ChatOpenAI} llm - Экземпляр языковой модели.
 * @returns {import("@langchain/langgraph/prebuilt").ReactAgentExecutor} Скомпилированный агент.
 */
export const createGeographyAgentWithHITL = (llm) => {
  // Заменяем оригинальный инструмент на нашу обертку
  const tools = [
    coordinatesToolWithRetry,
    populationToolWithCheck, // <-- Наш новый инструмент
    trafficToolWithRetry,
  ];

  console.log("  [Agent Factory] 🛠️  Создание GeographyAgent с HITL-инструментом: populationToolWithCheck");

  return createReactAgent({
    llm,
    tools,
    stateModifier: new SystemMessage(
      "Ты специалист по географии. Твои ответы по населению будут проверяться. " +
      "Используй инструменты для получения координат, населения и информации о трафике."
    ),
  });
};
