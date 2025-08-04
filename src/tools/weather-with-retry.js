// ЗАДАНИЕ: Реализовать retry механизм для weather tool

import { tool } from "@langchain/core/tools";
import { weatherTool } from "./weather.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Создает обертку для инструмента с логикой повторных попыток.
 * @param {import("@langchain/core/tools").Tool} toolToWrap - Инструмент для обертывания.
 * @param {object} options - Настройки.
 * @param {number} options.maxAttempts - Максимальное количество попыток.
 * @param {number} options.initialDelay - Начальная задержка в мс.
 * @param {number} options.backoffMultiplier - Множитель для задержки.
 * @returns {import("@langchain/core/tools").Tool} Новый инструмент с retry-логикой.
 */
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

/*
Требования:
1. Создать обёртку для weatherTool с retry логикой
2. Максимум 3 попытки
3. Экспоненциальный backoff: 1s, 2s, 4s
4. Логирование каждой попытки
5. Возврат последней ошибки, если все попытки провалились

Структура:
- Функция withRetry(tool, options)
- options: { maxAttempts, initialDelay, backoffMultiplier }
- Использовать setTimeout для задержек
- Сохранять последнюю ошибку для возврата
*/

export const weatherToolWithRetry = withRetry(weatherTool, {
  maxAttempts: 3,
  initialDelay: 1000,
  backoffMultiplier: 2,
});
