/**
 * @fileoverview Граф с Human-in-the-Loop (HITL) логикой.
 */

import { END, StateGraph, interrupt } from "@langchain/langgraph";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { AgentState } from "./supervisor.js"; // Используем стандартное состояние
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { z } from "zod";

/**
 * Узел, проверяющий ответ агента и прерывающий граф при низкой уверенности.
 * @param {AgentState} state
 * @returns {AgentState}
 */
const humanInTheLoopNode = (state) => {
  console.log("▶️  Вход в ноду 'human_in_the_loop_check'...");
  const lastMessage = state.messages.slice(-1)[0];
  
  try {
    const data = JSON.parse(lastMessage.content);
    // Проверяем, что это JSON от нашего инструмента
    if (data.tool === "get_population" && data.confidence) {
      console.log(`  [HITL Check] 🔍 Обнаружен ответ от 'get_population' с уверенностью ${data.confidence.toFixed(2)}`);
      if (data.confidence < 0.7) {
        console.log("  [HITL Check] ⏸️  Уверенность ниже порога! Граф прерван для подтверждения человеком.");
        // Прерываем выполнение и ждем ответа
        return interrupt(); 
      }
       console.log("  [HITL Check] ✅ Уверенность достаточная. Продолжаем работу.");
    }
  } catch (e) {
    // Не JSON или не тот формат - просто игнорируем и продолжаем
  }
  
  console.log("◀️  Выход из ноды 'human_in_the_loop_check'.");
  return; // Возвращаем пустое состояние, чтобы продолжить к супервизору
};


/**
 * Строит граф с HITL-логикой.
 * @param {import("@langchain/langgraph/prebuilt").ReactAgentExecutor} supervisor
 * @param {import("@langchain/langgraph/prebuilt").ReactAgentExecutor} weatherAgent
 * @param {import("@langchain/langgraph/prebuilt").ReactAgentExecutor} geographyAgentWithHITL
 * @returns {import("@langchain/langgraph").CompiledStateGraph}
 */
export async function buildHITLGraph(llm, weatherAgent, geographyAgentWithHITL) {
  const members = ["WeatherAgent", "GeographyAgent"];
  const options = ["FINISH", ...members];
  const supervisorPrompt = ChatPromptTemplate.fromMessages([
    ["system", "Вы супервизор, управляющий командой специалистов: {members}. " +
      "Ваша задача - направить запрос пользователя к нужному специалисту. " +
      "После того как специалист предоставил ответ, ваша задача завершена. " +
      "Всегда выбирайте FINISH, если в истории уже есть ответ от специалиста."],
    new MessagesPlaceholder("messages"),
    ["human", "Проанализируйте диалог. Какой специалист должен ответить следующим, или задача завершена? Выберите из: {options}"],
  ]);
  const supervisorLLMChain = supervisorPrompt.pipe(llm.bindTools([
    {
      name: "route",
      description: "Выбрать следующего специалиста или завершить задачу.",
      schema: z.object({
        next: z.enum(options),
      }),
    }
  ], { tool_choice: "route", parallel_tool_calls: false }));
  const supervisor = async (state) => {
    console.log("\n▶️  Вход в ноду 'supervisor'..."); 
    const chainInput = { ...state, members: members.join(", "), options: options.join(", ") };
    const llmResponse = await supervisorLLMChain.invoke(chainInput);
    const result = llmResponse.tool_calls[0].args;
    console.log(`  [Supervisor] 🧠 Решение: направить на '${result.next}'`);
    console.log("◀️  Выход из ноды 'supervisor'.");
    return { next: result.next };
  };
  
  const weatherAgentNode = async (state) => {
    console.log(`\n▶️  Вход в ноду 'WeatherAgent'...`);
    const result = await weatherAgent.invoke(state);
    console.log(`◀️  Выход из ноды 'WeatherAgent'.`);
    return { messages: [new HumanMessage({ content: result.messages.slice(-1)[0].content, name: "WeatherAgent" })] };
  };
  const geographyAgentNode = async (state) => {
    console.log(`\n▶️  Вход в ноду 'GeographyAgent'...`);
    const result = await geographyAgentWithHITL.invoke(state);
    console.log(`◀️  Выход из ноды 'GeographyAgent'.`);
    return { messages: [new HumanMessage({ content: result.messages.slice(-1)[0].content, name: "GeographyAgent" })] };
  };
  
  const workflow = new StateGraph(AgentState)
    .addNode("supervisor", supervisor)
    .addNode("WeatherAgent", weatherAgentNode)
    .addNode("GeographyAgent", geographyAgentNode)
    .addNode("human_in_the_loop_check", humanInTheLoopNode);

  // Маршрутизация
  workflow.addEdge("WeatherAgent", "supervisor");
  workflow.addEdge("GeographyAgent", "human_in_the_loop_check"); // После гео-агента идем на проверку
  workflow.addEdge("human_in_the_loop_check", "supervisor"); // После проверки - к супервизору

  const conditionalMap = {
    WeatherAgent: "WeatherAgent",
    GeographyAgent: "GeographyAgent",
    FINISH: END,
  };

  workflow.addConditionalEdges("supervisor", (state) => state.next, conditionalMap);
  workflow.setEntryPoint("supervisor");

  console.log("\n✅ Граф с HITL-логикой успешно построен.");
  return workflow.compile();
}