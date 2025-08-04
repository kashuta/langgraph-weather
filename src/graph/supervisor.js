/**
 * @fileoverview Основной модуль для построения и компиляции графа LangGraph.
 * Определяет состояние, логику узлов и маршрутизацию для многоагентной системы.
 */

import { END, Annotation, StateGraph } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

/**
 * @typedef {Object} AgentState
 * @property {import("@langchain/core/messages").BaseMessage[]} messages - Список сообщений в диалоге.
 * @property {string | null} next - Имя следующего агента для вызова.
 */

/**
 * Определяет структуру состояния, которая передается между узлами графа.
 * @type {import("@langchain/langgraph").StateGraphArgs<AgentState>['channels']}
 */
export const AgentState = Annotation.Root({
  messages: Annotation({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  next: Annotation({
    reducer: (_x, y) => y,
    default: () => null,
  }),
});

/**
 * Выполняет логику одного узла-агента в графе.
 * @param {object} params - Параметры для выполнения.
 * @param {AgentState} params.state - Текущее состояние графа.
 * @param {import("@langchain/langgraph/prebuilt").ReactAgentExecutor} params.agent - Экземпляр агента для вызова.
 * @param {string} params.name - Имя агента (для логирования).
 * @returns {Promise<{messages: import("@langchain/core/messages").HumanMessage[]}>} Обновление для состояния.
 */
async function runAgentNode(params) {
  const { state, agent, name } = params;
  console.log(`\n▶️  Вход в ноду '${name}'...`);
  const result = await agent.invoke(state);
  console.log(`◀️  Выход из ноды '${name}'.`);
  return {
    messages: [new HumanMessage({ content: result.messages.slice(-1)[0].content, name })],
  };
}

/**
 * Строит и компилирует исполняемый граф LangGraph.
 * @param {import("@langchain/openai").ChatOpenAI} llm - Экземпляр языковой модели для супервизора.
 * @param {import("@langchain/langgraph/prebuilt").ReactAgentExecutor} weatherAgent - Экземпляр агента погоды.
 * @param {import("@langchain/langgraph/prebuilt").ReactAgentExecutor} geographyAgent - Экземпляр агента географии.
 * @returns {Promise<import("@langchain/langgraph").CompiledStateGraph>} Скомпилированный граф.
 */
export async function buildGraph(llm, weatherAgent, geographyAgent) {
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

  const weatherAgentNode = (state) => runAgentNode({ state, agent: weatherAgent, name: "WeatherAgent" });
  const geographyAgentNode = (state) => runAgentNode({ state, agent: geographyAgent, name: "GeographyAgent" });
  
  const supervisorNode = async (state) => {
      console.log("\n▶️  Вход в ноду 'supervisor'...");
      console.log("  [Supervisor] 🔎 Анализ сообщений для принятия решения:");
      state.messages.forEach((msg, i) => {
        console.log(`    [Сообщение ${i}]`);
        console.log(`      - Тип: ${msg._getType()}`);
        console.log(`      - Контент: "${msg.content}"`);
        if (msg.name) {
            console.log(`      - Источник: ${msg.name}`);
        }
      });

      const chainInput = { ...state, members: members.join(", "), options: options.join(", ") };
      const formattedPrompt = await supervisorPrompt.formatMessages(chainInput);
      
      console.log("  [Supervisor] ➡️  Отправка запроса в LLM с промптом:");
      formattedPrompt.forEach((msg, i) => {
          console.log(`    [Промпт ${i} ${msg._getType()}]: ${msg.content}`);
      });

      const llmResponse = await supervisorLLMChain.invoke(chainInput);
      
      console.log("  [Supervisor] ⬅️  Получен ответ от LLM:");
      console.log(`      - Контент: ${llmResponse.content}`);
      if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
          console.log(`      - Вызов инструмента: ${llmResponse.tool_calls[0].name}`);
          console.log(`      - Аргументы: ${JSON.stringify(llmResponse.tool_calls[0].args)}`);
      }

      const result = llmResponse.tool_calls[0].args;
      console.log(`  [Supervisor] 🧠 Решение: направить на '${result.next}'`);
      console.log("◀️  Выход из ноды 'supervisor'.");
      return { next: result.next };
  };

  const workflow = new StateGraph(AgentState)
    .addNode("WeatherAgent", weatherAgentNode)
    .addNode("GeographyAgent", geographyAgentNode)
    .addNode("supervisor", supervisorNode);

  members.forEach((member) => workflow.addEdge(member, "supervisor"));

  const conditionalMap = {
    WeatherAgent: "WeatherAgent",
    GeographyAgent: "GeographyAgent",
    FINISH: END,
  };
  
  workflow.addConditionalEdges("supervisor", (state) => {
    console.log(`  [Graph Logic] 🚦 Маршрутизация на основе решения супервизора: '${state.next}'`);
    return state.next;
    }, conditionalMap
  );
  
  workflow.setEntryPoint("supervisor");

  return workflow;
} 