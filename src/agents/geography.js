import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { SystemMessage } from "@langchain/core/messages";
import { coordinatesTool } from '../tools/coordinates.js';
import { populationTool } from '../tools/population.js';
import { trafficTool } from '../tools/traffic.js';

export const createGeographyAgent = (llm) => {
  const tools = [coordinatesTool, populationTool, trafficTool];
  console.log("  [Agent Factory] 🛠️  Создание GeographyAgent с инструментами: get_coordinates, get_population, get_traffic_info");
  return createReactAgent({
    llm,
    tools,
    stateModifier: new SystemMessage("Ты специалист по географии и демографии. Используй инструменты для получения координат, населения и информации о трафике."),
  });
}; 