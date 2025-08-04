/**
 * @fileoverview Отказоустойчивый супервизор с переключением моделей.
 * Реализует граф, который сначала пытается использовать gpt-4o-mini,
 * а при сбое переключается на gpt-4.
 */

import { END, Annotation, StateGraph } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";

/**
 * @typedef {Object} FallbackAgentState
 * @property {import("@langchain/core/messages").BaseMessage[]} messages
 * @property {string | null} next
 * @property {'gpt-4o-mini' | 'gpt-4'} currentModel
 * @property {Error | null} lastError
 */

export const FallbackAgentState = Annotation.Root({
  messages: Annotation({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  next: Annotation({
    reducer: (_x, y) => y,
    default: () => null,
  }),
  currentModel: Annotation({
    reducer: (_x, y) => y,
    default: () => "gpt-4o-mini",
  }),
  lastError: Annotation({
    reducer: (_x, y) => y,
    default: () => null,
  }),
});

async function runAgentNode({ state, agent, name }) {
  console.log(`\n▶️  Вход в ноду '${name}'...`);
  const result = await agent.invoke(state);
  console.log(`◀️  Выход из ноды '${name}'.`);
  return {
    messages: [
      new HumanMessage({ content: result.messages.slice(-1)[0].content, name }),
    ],
  };
}

function createSupervisorChain(modelName) {
  const members = ["WeatherAgent", "GeographyAgent"];
  const options = ["FINISH", ...members];

  const supervisorPrompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "Вы супервизор, управляющий командой специалистов: {members}. " +
        "Ваша задача - направить запрос пользователя к нужному специалисту. " +
        "После того как специалист предоставил ответ, ваша задача завершена. " +
        "Всегда выбирайте FINISH, если в истории уже есть ответ от специалиста.",
    ],
    new MessagesPlaceholder("messages"),
    [
      "human",
      "Проанализируйте диалог. Какой специалист должен ответить следующим, или задача завершена? Выберите из: {options}",
    ],
  ]);

  const llm = new ChatOpenAI({
    model: modelName,
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
  });

  return supervisorPrompt.pipe(
    llm.bindTools(
      [
        {
          name: "route",
          description: "Выбрать следующего специалиста или завершить задачу.",
          schema: z.object({
            next: z.enum(options),
          }),
        },
      ],
      { tool_choice: "route", parallel_tool_calls: false }
    )
  );
}

export async function buildGraph(weatherAgent, geographyAgent) {
  const supervisorMiniChain = createSupervisorChain("gpt-4o-mini");
  const supervisorFullChain = createSupervisorChain("gpt-4");

  const supervisorMini = async (state) => {
    const model = "gpt-4o-mini";
    console.log(`\n▶️  Вход в супервизор (Модель: ${model})...`);
    try {
      const llmResponse = await supervisorMiniChain.invoke({
        ...state,
        members: "WeatherAgent, GeographyAgent",
        options: "FINISH, WeatherAgent, GeographyAgent",
      });
      const nextNode = llmResponse.tool_calls[0].args.next;
      console.log(`  [${model}] 🧠 Решение: направить на '${nextNode}'`);
      return { next: nextNode, lastError: null };
    } catch (error) {
      console.error(`  [${model}] ❌ Ошибка: ${error.message}`);
      console.log(`  [${model}] 🔁 Переключение на gpt-4...`);
      return {
        currentModel: "gpt-4",
        lastError: error,
      };
    } finally {
      console.log(`◀️  Выход из супервизора (${model}).`);
    }
  };

  const supervisorFull = async (state) => {
    const model = "gpt-4";
    console.log(`\n▶️  Вход в fallback-супервизор (Модель: ${model})...`);
    try {
      const llmResponse = await supervisorFullChain.invoke({
        ...state,
        members: "WeatherAgent, GeographyAgent",
        options: "FINISH, WeatherAgent, GeographyAgent",
      });
      const nextNode = llmResponse.tool_calls[0].args.next;
      console.log(`  [${model}] 🧠 Решение: направить на '${nextNode}'`);
      return { next: nextNode, lastError: null };
    } catch (error) {
      console.error(`  [${model}] ❌ Критическая ошибка: ${error.message}`);
      return { next: "FINISH", lastError: error };
    } finally {
      console.log(`◀️  Выход из fallback-супервизора (${model}).`);
    }
  };

  const routeFromSupervisor = (state) => {
    console.log(`\n  [Graph Logic] 🚦 Маршрутизация на основе состояния:`);
    console.log(`    - Последняя ошибка: ${state.lastError ? "Да" : "Нет"}`);
    console.log(`    - Следующий узел: ${state.next}`);

    if (state.lastError) {
      console.log(
        "    - Решение: Переход на fallback супервизор (supervisor_full)."
      );
      return "supervisor_full";
    }

    console.log(`    - Решение: Переход на '${state.next}'.`);
    return state.next;
  };

  const weatherAgentNode = (state) =>
    runAgentNode({ state, agent: weatherAgent, name: "WeatherAgent" });
  const geographyAgentNode = (state) =>
    runAgentNode({ state, agent: geographyAgent, name: "GeographyAgent" });

  const workflow = new StateGraph(FallbackAgentState)
    .addNode("WeatherAgent", weatherAgentNode)
    .addNode("GeographyAgent", geographyAgentNode)
    .addNode("supervisor_mini", supervisorMini)
    .addNode("supervisor_full", supervisorFull);

  workflow.addEdge("WeatherAgent", "supervisor_mini");
  workflow.addEdge("GeographyAgent", "supervisor_mini");

  workflow.addConditionalEdges("supervisor_full", (state) => state.next, {
    WeatherAgent: "WeatherAgent",
    GeographyAgent: "GeographyAgent",
    FINISH: END,
  });

  workflow.addConditionalEdges("supervisor_mini", routeFromSupervisor, {
    supervisor_full: "supervisor_full",
    WeatherAgent: "WeatherAgent",
    GeographyAgent: "GeographyAgent",
    FINISH: END,
  });

  workflow.setEntryPoint("supervisor_mini");

  console.log("\n✅ Граф с fallback-логикой успешно построен.");
  return workflow.compile();
}
