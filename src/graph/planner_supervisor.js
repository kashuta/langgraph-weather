/**
 * @fileoverview Cупервизор, который строит план выполнения (execution plan).
 * В отличие от циклического супервизора, этот сначала декомпозирует задачу,
 * а затем последовательно выполняет шаги.
 */

import { StateGraph, END, Annotation } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * @typedef {Object} PlanStep
 * @property {string} agent - Имя агента для вызова.
 * @property {string} query - Запрос для этого агента.
 */

/**
 * @typedef {Object} PlannerAgentState
 * @property {HumanMessage[]} messages - Входящие сообщения.
 * @property {PlanStep[]} plan - План выполнения, сгенерированный планировщиком.
 * @property {any[]} past_steps - Результаты уже выполненных шагов.
 * @property {string} response - Финальный ответ для пользователя.
 */
export const PlannerAgentState = Annotation.Root({
  messages: Annotation({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  plan: Annotation({
    reducer: (_x, y) => y,
    default: () => [],
  }),
  past_steps: Annotation({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  response: Annotation({
    reducer: (_x, y) => y,
    default: () => null,
  }),
});

/**
 * Определяет схему для плана, чтобы LLM возвращал структурированный результат.
 */
const planSchema = z.object({
  steps: z.array(z.object({
    agent: z.string().describe("Агент для выполнения шага (WeatherAgent или GeographyAgent)"),
    query: z.string().describe("Конкретный и самодостаточный запрос для этого агента"),
  })).describe("Разные шаги для выполнения, должны быть в отсортированном порядке"),
});

/**
 * Создает узел-планировщик.
 * @param {ChatOpenAI} llm 
 * @returns 
 */
const createPlannerNode = (llm) => {
  const plannerPrompt = ChatPromptTemplate.fromTemplate(
    "Для данной задачи составь пошаговый план. " +
    "Этот план должен включать в себя отдельные задачи, которые, будучи выполнены правильно, дадут верный ответ. " +
    "Не добавляй лишних шагов. " +
    "Результат последнего шага должен быть финальным ответом. " +
    "Убедись, что каждый шаг содержит всю необходимую информацию - не пропускай шаги.\n\n" +
    "Запрос пользователя: {objective}"
  );
  
  const planner = plannerPrompt.pipe(llm.withStructuredOutput(planSchema, { name: "plan" }));

  return async (state) => {
    console.log("\n▶️  Вход в ноду 'planner'...");
    const plan = await planner.invoke({ objective: state.messages.slice(-1)[0].content });
    console.log("  [Planner] 📝 Сгенерирован план:");
    plan.steps.forEach((step, i) => {
      console.log(`    [Шаг ${i+1}] Агент: ${step.agent}, Запрос: "${step.query}"`);
    });
    console.log("◀️  Выход из ноды 'planner'.");
    return { plan: plan.steps };
  };
};

/**
 * Создает узел-исполнитель.
 * @param {Record<string, import("@langchain/langgraph/prebuilt").ReactAgentExecutor>} agentMap 
 * @returns 
 */
const createExecutionNode = (agentMap) => {
  return async (state) => {
    const step = state.plan[0];
    const agent = agentMap[step.agent];
    if (!agent) {
      throw new Error(`Агент '${step.agent}' не найден.`);
    }

    console.log(`\n▶️  Выполнение шага: вызов '${step.agent}' с запросом "${step.query}"...`);
    const result = await agent.invoke({ messages: [new HumanMessage(step.query)] });
    const resultMessage = result.messages.slice(-1)[0].content;
    console.log(`◀️  Шаг выполнен. Результат: ${resultMessage}`);
    
    return { 
      // Обновляем состояние: добавляем результат и УДАЛЯЕМ выполненный шаг из плана
      past_steps: [{
        agent: step.agent,
        query: step.query,
        result: resultMessage
      }],
      plan: state.plan.slice(1),
    };
  };
};

/**
 * Узел, который объединяет результаты и генерирует финальный ответ.
 * @param {ChatOpenAI} llm 
 */
const createResponseNode = (llm) => {
    const responsePrompt = ChatPromptTemplate.fromMessages([
        ["system", "Ты - полезный ассистент. Твоя задача - взять результаты работы команды специалистов и сформулировать из них единый, красивый и понятный ответ для пользователя. Вот история нашего диалога и результаты работы:"],
        ["human", "Изначальный запрос пользователя был: {objective}"],
        ["human", "Вот результаты, которые собрали агенты: {results}"],
        ["human", "Скомбинируй все это в один финальный ответ."],
    ]);

    const responseChain = responsePrompt.pipe(llm);

    return async (state) => {
        console.log("\n▶️  Генерация финального ответа...");
        const objective = state.messages[0].content;
        const results = JSON.stringify(state.past_steps, null, 2);
        const response = await responseChain.invoke({ objective, results });
        console.log(`◀️  Финальный ответ: ${response.content}`);
        return { response: response.content };
    }
}


/**
 * Логика маршрутизации после выполнения шага.
 * @param {PlannerAgentState} state 
 * @returns {"executor" | "responder"}
 */
const shouldContinue = (state) => {
  if (state.plan && state.plan.length > 0) {
    console.log("  [Graph Logic] 🚦 В плане остались шаги. Продолжаем выполнение.");
    return "executor";
  } else {
    console.log("  [Graph Logic] 🏁 План выполнен. Переход к генерации финального ответа.");
    return "responder";
  }
};


export const buildPlannerGraph = async (llm, weatherAgent, geographyAgent) => {
  const agentMap = {
    "WeatherAgent": weatherAgent,
    "GeographyAgent": geographyAgent,
  };

  const plannerNode = createPlannerNode(llm);
  const executionNode = createExecutionNode(agentMap);
  const responseNode = createResponseNode(llm);

  const workflow = new StateGraph(PlannerAgentState)
    .addNode("planner", plannerNode)
    .addNode("executor", executionNode)
    .addNode("responder", responseNode);

  workflow.setEntryPoint("planner");
  
  workflow.addConditionalEdges(
    "planner",
     // После планирования решаем, нужно ли вообще выполнять что-то
    (state) => {
      if (state.plan && state.plan.length > 0) {
        return "executor";
      } else {
        return "responder";
      }
    },
    {
      "executor": "executor",
      "responder": "responder",
    }
  );
  
  workflow.addConditionalEdges(
    "executor",
    shouldContinue,
    {
      "executor": "executor",
      "responder": "responder",
    }
  );
  
  workflow.addEdge("responder", END);

  return workflow.compile();
};

