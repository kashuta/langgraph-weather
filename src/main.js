import 'dotenv/config';
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { createWeatherAgent } from './agents/weather.js';
import { createGeographyAgent } from './agents/geography.js';
import { buildGraph } from './graph/supervisor.js';

async function main() {
  console.log("🔵 Инициализация LLM...");
  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
  });

  console.log("🔵 Создание агентов-специалистов...");
  const weatherAgent = createWeatherAgent(llm);
  const geographyAgent = createGeographyAgent(llm);
  
  console.log("🔵 Построение графа с супервизором...");
  const graph = await buildGraph(llm, weatherAgent, geographyAgent);

  const testQueries = [
    "какая погода в Париже?",
    "какие координаты у Лондона?",
    "сколько людей живет в Токио?",
    "какая погода и население в Москве?",
  ];

  for (const query of testQueries) {
    console.log(`\n\n💬 Запрос пользователя: "${query}"`);
    console.log("--------------------------------------------------");
    
    const finalState = await graph.invoke(
      { messages: [new HumanMessage({ content: query })] },
      { recursionLimit: 100 }
    );
    
    console.log("\n✅ Финальный ответ:", finalState.messages.slice(-1)[0].content);
  }
}

main().catch(console.error); 