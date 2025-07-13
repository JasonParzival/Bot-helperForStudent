const TelegramBot = require('node-telegram-bot-api');

const db = require('./database');

const token = require('./data.js');

const bot = new TelegramBot(token, { polling: true });

//Меню
bot.setMyCommands([
    {command: '/start', description: 'Начало'},
    {command: '/help', description: 'Помощь'}
]);

//Команда приветствия
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    const options = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: 'Выбрать группу', callback_data: 'start_select_group' },
                    { text: 'Добавить группу', callback_data: 'start_add_group' }
                ],
                [
                    { text: '⬅️ Назад', callback_data: 'start_group_prev' },
                    { text: 'Вперед ➡️', callback_data: 'start_group_next' }
                ]
            ]
        }
    };

    bot.sendMessage(
        chatId, 
`Какая вам группа нужна?
Выберите из ниже предложенных:`, 
        options
    );
});

// Объект под состояния пользователей
const waitingForAnswer = {};

// Объект под данные пользователя
const usersData = {};

// Присвоение страницы у пользователя
function setUserPage(userId, page) {
  if (!usersData[userId]) {
    usersData[userId] = {};
  }
  usersData[userId].page = page;
}

// Получение страницы у пользователя
function getUserPage(userId) {
  return usersData[userId]?.page ?? -1; 
}

//Реакция на кнопки
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;

    const userId = message.chat.id;

    // Реализовал запрос к БД, но это плохая реализация, ведь
    // каждый раз когда пользователь будет нажимать на кнопку
    // будет происходить запрос к БД, что не есть хорошо
    // Нужно будет придумать другой способ
    const [array] = await db.query('SELECT * FROM Groups');
    const quantityOfGroups = array.length - 1;

    try {
        if (data.startsWith('start_')) {
            // Нажатие на кнопку назад
            if (data === 'start_group_prev') {
                if (getUserPage(userId) == -1) {
                    setUserPage(userId, 0);
                }
                else if (getUserPage(userId) == 0) {
                    setUserPage(userId, quantityOfGroups);
                }
                else {
                    setUserPage(userId, getUserPage(userId) - 1);
                }

                bot.editMessageText(`Какая вам группа нужна?
Выберите из ниже предложенных:
                ` + array[getUserPage(userId)].name, {
                    chat_id: message.chat.id,
                    message_id: message.message_id,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Выбрать группу', callback_data: 'start_select_group' },
                                { text: 'Добавить группу', callback_data: 'start_add_group' }
                            ],
                            [
                                { text: '⬅️ Назад', callback_data: 'start_group_prev' },
                                { text: 'Вперед ➡️', callback_data: 'start_group_next' }
                            ]
                        ]
                    }
                });
            // Нажатие на кнопку вперёд
            } else if (data === 'start_group_next') {
                if (getUserPage(userId) == -1) {
                    setUserPage(userId, 0);
                }
                else if (getUserPage(userId) == quantityOfGroups) {
                    setUserPage(userId, 0);
                }
                else {
                    setUserPage(userId, getUserPage(userId) + 1);
                }

                bot.editMessageText(`Какая вам группа нужна?
Выберите из ниже предложенных:
                ` + array[getUserPage(userId)].name, {
                    chat_id: message.chat.id,
                    message_id: message.message_id,
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Выбрать группу', callback_data: 'start_select_group' },
                                { text: 'Добавить группу', callback_data: 'start_add_group' }
                            ],
                            [
                                { text: '⬅️ Назад', callback_data: 'start_group_prev' },
                                { text: 'Вперед ➡️', callback_data: 'start_group_next' }
                            ]
                        ]
                    }
                });
            // Нажатие на "Добавить группу"
            } else if (data === 'start_add_group') {
                bot.sendMessage(message.chat.id, 'Введите, пожалуйста, название группы.');

                waitingForAnswer[message.chat.id] = 'start_add_group';
            // Нажатие на "Выбрать группу"
            } else if (data === 'start_select_group') {
                const options = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Задачи', callback_data: 'tasks_student_printall' },
                            ],
                            [
                                { text: 'Добавить задачу', callback_data: 'tasks_student_addtask' }
                            ],
                            [
                                { text: 'Отметить как выполненное', callback_data: 'tasks_student_performtask' },
                            ]
                        ]
                    }
                };

                bot.sendMessage(message.chat.id, `Отлично, вы выбрали группу.
Доступные функции: `, options
                );
            }
        } else if (data.startsWith('tasks_student_')) {
            if (data === 'tasks_student_printall') {
                bot.sendMessage(message.chat.id, 'Ты нажал на задачи');
            } else if (data === 'tasks_student_addtask') {
                bot.sendMessage(message.chat.id, 'Ты нажал на добавление задачи');
            } else if (data === 'tasks_student_performtask') {
                bot.sendMessage(message.chat.id, 'Ты нажал на выполнение задачи');
            }
        }
    }
    catch(e) {
        console.log(e);
    }
    
    bot.answerCallbackQuery(callbackQuery.id);
});

// Реакция на сообщения пользователей
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    if (waitingForAnswer[chatId] === 'start_add_group') {
        const groupName = msg.text;

        try {
            await db.query('INSERT INTO NotConfGr (name, confirmed) VALUES (?, ?)', [groupName, false]);
            await bot.sendMessage(chatId, `Заявка на подтверждение группы "${groupName}" успешно отправлена!`);
        } catch (e) {
            console.error(e);
            await bot.sendMessage(chatId, 'Произошла ошибка при добавлении группы.');
        }

        delete waitingForAnswer[chatId];
    }
});

// Команда для вывода доступных команд
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpText = `Доступные команды:
/help — список команд и их описание`;
    bot.sendMessage(chatId, helpText);
});