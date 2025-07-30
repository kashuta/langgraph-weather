/**
 * @fileoverview Вспомогательная функция для извлечения названия города из строки запроса.
 */

/**
 * Извлекает название города из строки запроса пользователя.
 * Функция ищет известные сокращения (например, "msk" -> "Moscow") или первое подходящее слово.
 * @param {string} query - Строка запроса от пользователя (например, "какая погода в Москве").
 * @returns {string|null} Название города с заглавной буквы или null, если город не найден.
 */
export const extractCityFromQuery = (query) => {
  const words = query.toLowerCase().split(/\s+/);
  const commonWords = ['weather', 'in', 'the', 'what', 'is', 'погода', 'в', 'какая', 'координаты', 'у', 'население', 'сколько', 'людей', 'живет', 'пробки', 'траффик'];
  const cityAbbreviations = {
    'sf': 'San Francisco', 'spb': 'Saint Petersburg', 'msk': 'Moscow', 'ny': 'New York', 'la': 'Los Angeles'
  };

  for (const word of words) {
    if (cityAbbreviations[word]) return cityAbbreviations[word];
  }

  for (const word of words) {
    if (word.length > 2 && !commonWords.includes(word)) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
  }

  return null; // Возвращаем null если город не найден
}; 