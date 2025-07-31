/**
 * @fileoverview Утилита для взаимодействия с пользователем через консоль.
 */

import readline from 'readline';

/**
 * Создает интерфейс для чтения данных из консоли.
 * @returns {readline.Interface} Настроенный интерфейс readline.
 */
const createReadlineInterface = () => {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
};

/**
 * Запрашивает у пользователя ввод в консоли.
 * @param {readline.Interface} rl - Интерфейс readline.
 * @param {string} question - Вопрос, который будет показан пользователю.
 * @returns {Promise<string>} Введенная пользователем строка.
 */
export const askQuestion = (rl, question) => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

/**
 * Запускает цикл для непрерывного получения запросов от пользователя.
 * @param {Function} callback - Функция, которая будет вызываться с каждым новым запросом.
 */
export const startConversation = async (callback) => {
  const rl = createReadlineInterface();
  console.log('🔵 Введите ваш запрос. Для выхода введите "exit".');

  let keepRunning = true;
  while (keepRunning) {
    const userInput = await askQuestion(rl, '> ');
    if (userInput.toLowerCase() === 'exit') {
      keepRunning = false;
    } else {
      await callback(userInput);
    }
  }

  rl.close();
  console.log('🔵 Разговор завершен.');
};
