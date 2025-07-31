/**
 * @fileoverview Точка входа в приложение.
 * Инициализирует модель, агентов, строит граф и запускает демонстрационные запросы.
 */

import 'dotenv/config';
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { createWeatherAgent } from './agents/weather.js';
import { createGeographyAgent } from './agents/geography.js';
import { buildGraph as buildSupervisorGraph } from './graph/supervisor.js';
import { buildPlannerGraph } from './graph/planner_supervisor.js';

import { startConversation, askQuestion } from './console.js';
import readline from 'readline';

/**
 * Основная асинхронная функция приложения.
 */
async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const supervisorType = await askQuestion(rl, "Какой супервизор использовать? (1: Реактивный, 2: Планировщик) ");

  console.log("🔵 Инициализация LLM...");
  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log("🔵 Создание агентов-специалистов...");
  const weatherAgent = createWeatherAgent(llm);
  const geographyAgent = createGeographyAgent(llm);
  
  let graph;
  let runGraph;

  if (supervisorType.trim() === '2') {
    console.log("🔵 Построение графа с супервизором-планировщиком...");
    graph = await buildPlannerGraph(llm, weatherAgent, geographyAgent);
    runGraph = async (query) => {
      const finalState = await graph.invoke(
        { messages: [new HumanMessage({ content: query })] },
        { recursionLimit: 100 }
      );
      console.log("\n✅ Финальный ответ:", finalState.response);
    };
  } else {
    console.log("🔵 Построение графа с реактивным супервизором...");
    graph = await buildSupervisorGraph(llm, weatherAgent, geographyAgent);
    runGraph = async (query) => {
      const finalState = await graph.invoke(
        { messages: [new HumanMessage({ content: query })] },
        { recursionLimit: 100 }
      );
      console.log("\n✅ Финальный ответ:", finalState.messages.slice(-1)[0].content);
    };
  }
  
  rl.close();

  await startConversation(async (query) => {
    console.log(`\n\n💬 Запрос пользователя: "${query}"`);
    console.log("--------------------------------------------------");
    await runGraph(query);
  });
}

main().catch(console.error);
