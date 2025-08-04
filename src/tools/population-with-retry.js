import { populationTool } from "./population.js";
import { tool } from "@langchain/core/tools";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function withRetry(
  toolToWrap,
  { maxAttempts, initialDelay, backoffMultiplier }
) {
  const originalToolFunc = toolToWrap.func.bind(toolToWrap);

  const retryingFunc = async (input) => {
    let lastError = null;
    let delay = initialDelay;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(
          `[RetryWrapper] 🚀 Попытка #${attempt} для инструмента '${toolToWrap.name}'...`
        );
        // Добавим искусственный сбой для демонстрации
        if (Math.random() < 0.5) {
          throw new Error("Искусственный сбой в population tool!");
        }
        const result = await originalToolFunc(input);
        console.log(`[RetryWrapper] ✅ Успех на попытке #${attempt}!`);
        return result;
      } catch (error) {
        lastError = error;
        console.log(
          `[RetryWrapper] ❌ Провал на попытке #${attempt}: ${error.message}`
        );

        if (attempt < maxAttempts) {
          const waitTime = Math.round(delay);
          console.log(
            `[RetryWrapper] ⏳ Ожидание ${waitTime}ms перед следующей попыткой...`
          );
          await wait(waitTime);
          delay *= backoffMultiplier;
        }
      }
    }

    console.error(
      `[RetryWrapper] 💀 Все ${maxAttempts} попыток для '${toolToWrap.name}' провалились. Возврат последней ошибки.`
    );
    throw lastError;
  };

  return tool(retryingFunc, {
    name: toolToWrap.name,
    description: toolToWrap.description,
    schema: toolToWrap.schema,
  });
}

export const populationToolWithRetry = withRetry(populationTool, {
  maxAttempts: 3,
  initialDelay: 1000,
  backoffMultiplier: 2,
});
