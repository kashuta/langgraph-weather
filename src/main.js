/**
 * @fileoverview Точка входа в приложение.
 */

import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { askQuestion } from "./console.js";
import readline from "readline";

// Импорт фабрик агентов
import { createWeatherAgent } from "./agents/weather.js";
import { createGeographyAgent } from "./agents/geography.js";
import { createGeographyAgentWithHITL } from "./agents/geography-with-hitl.js";

// Импорт построителей графов
import { buildGraph as buildSupervisorGraph } from "./graph/supervisor.js";
import { buildGraph as buildFallbackGraph } from "./graph/fallback_supervisor.js";
import { buildHITLGraph } from "./graph/supervisor-with-hitl.js";


/**
 * Основная асинхронная функция приложения.
 */
async function main() {
  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
  });
  
  const checkpointer = new MemorySaver();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  const supervisorType = await askQuestion(rl, "Какой сценарий запустить? (1: Реактивный, 2: Отказоустойчивый, 3: HITL) ");

  let graph;

  if (supervisorType.trim() === "3") {
    console.log("🔵 Инициализация HITL-сценария...");
    const weatherAgent = createWeatherAgent(llm);
    const geographyAgentWithHITL = createGeographyAgentWithHITL(llm);
    // Для этого графа мы передаем супервизора как узел
    graph = await buildHITLGraph(llm, weatherAgent, geographyAgentWithHITL);
  } else if (supervisorType.trim() === "2") {
    console.log("🔵 Инициализация Отказоустойчивого сценария...");
    const weatherAgent = createWeatherAgent(llm);
    const geographyAgent = createGeographyAgent(llm);
    graph = await buildFallbackGraph(weatherAgent, geographyAgent);
  } else {
    console.log("🔵 Инициализация Реактивного сценария...");
    const weatherAgent = createWeatherAgent(llm);
    const geographyAgent = createGeographyAgent(llm);
    graph = (await buildSupervisorGraph(llm, weatherAgent, geographyAgent)).compile();
  }

  const threadId = Date.now().toString();
  const config = { "configurable": { "thread_id": threadId }};
  
  console.log(`\n✅ Сценарий готов. ID диалога: ${threadId}`);
  console.log("   Введите 'exit' для завершения.");

  let userQuery;
  while ((userQuery = await askQuestion(rl, "\n> ")) !== "exit") {
    const inputs = { messages: [new HumanMessage(userQuery)] };
    
    let currentState = await graph.invoke(inputs, { ...config, checkpoint: checkpointer });
    
    while(currentState.__interrupt__) {
        console.log("\n⏸️  ГРАФ ПРЕРВАН ДЛЯ ВМЕШАТЕЛЬСТВА");
        const lastMessageContent = currentState.messages[currentState.messages.length - 1].content;
        const { confidence, content } = JSON.parse(lastMessageContent);

        console.log(`   Агент предложил ответ: "${content}"`);
        console.log(`   Уверенность: ${Math.round(confidence * 100)}%`);

        const action = await askQuestion(rl, "   Ваше действие? (a: approve, e: edit, r: reject) ");

        if(action === 'a') {
            currentState = await graph.continue({ messages: [] }, { ...config, checkpoint: checkpointer });
        } else if (action === 'e') {
            const newAnswer = await askQuestion(rl, "   Введите новый ответ: ");
            currentState = await graph.continue({ messages: [new AIMessage(newAnswer)] }, { ...config, checkpoint: checkpointer });
        } else {
             currentState = await graph.continue({ messages: [new AIMessage("Задача отклонена человеком.")] }, { ...config, checkpoint: checkpointer });
        }
    }
    
    console.log("\n✅ Финальный ответ:", currentState.messages.slice(-1)[0].content);
  }

  rl.close();
}

main().catch(console.error);
