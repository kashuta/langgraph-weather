import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { SystemMessage } from "@langchain/core/messages";
import { weatherTool } from '../tools/weather.js';

export const createWeatherAgent = (llm) => {
  console.log("  [Agent Factory] 🛠️  Создание WeatherAgent с инструментом: get_weather");
  return createReactAgent({
    llm,
    tools: [weatherTool],
    stateModifier: new SystemMessage("Ты специалист по погоде. Используй инструмент get_weather для ответа на вопросы о погоде."),
  });
}; 