import { END, Annotation, StateGraph } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { z } from "zod";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";

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

async function runAgentNode(params) {
  const { state, agent, name } = params;
  console.log(`\n▶️  Вход в ноду '${name}'...`);
  const result = await agent.invoke(state);
  console.log(`◀️  Выход из ноды '${name}'.`);
  return {
    messages: [new HumanMessage({ content: result.messages.slice(-1)[0].content, name })],
  };
}

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

  const supervisorChain = supervisorPrompt.pipe(llm.bindTools([
    {
      name: "route",
      description: "Выбрать следующего специалиста или завершить задачу.",
      schema: z.object({
        next: z.enum(options),
      }),
    }
  ], { tool_choice: "route", parallel_tool_calls: false })).pipe(msg => msg.tool_calls[0].args);

  const weatherAgentNode = (state) => runAgentNode({ state, agent: weatherAgent, name: "WeatherAgent" });
  const geographyAgentNode = (state) => runAgentNode({ state, agent: geographyAgent, name: "GeographyAgent" });
  
  const supervisorNode = async (state) => {
      console.log("\n▶️  Вход в ноду 'supervisor'...");
      const result = await supervisorChain.invoke({ ...state, members: members.join(", "), options: options.join(", ") });
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

  return workflow.compile();
} 