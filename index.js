const TelegramBot = require('node-telegram-bot-api');

const db = require('./database');

const token = require('./data.js');

const bot = new TelegramBot(token, { polling: true });

//Меню
bot.setMyCommands([
    {command: '/start', description: 'Начало'},
    {command: '/help', description: 'Помощь'}
]);

//-----------------------------------------------//
// Кнопки
const keyboardStart = {
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

const optionsStart = {
    reply_markup: keyboardStart
};

const optionStartChoose = {
    reply_markup: {
        inline_keyboard: [
            [
                { text: 'Да', callback_data: 'start_choose_option_yes' },
                { text: 'Нет', callback_data: 'start_choose_option_no' }
            ]
        ]
    }
}

//Команда приветствия
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;

    const [existsUser] = await db.query('SELECT * FROM users WHERE tg_id = ?', [chatId]);

    if (existsUser.length === 0) {
        bot.sendMessage(
            chatId, 
            `Какая вам группа нужна?
Выберите из ниже предложенных:`, 
            optionsStart
        );
    } else {
        const [existsUserGroup] = await db.query('SELECT * FROM groups WHERE id = ?', [existsUser[0].group_id]);

        bot.sendMessage(chatId, `Кажется, вы уже существуете в системе.
Здравствуйте, ` + existsUser[0].username + `!
Вы принадлежите группе: ` + existsUserGroup[0].name + `
Желаете поменять свою принадлежность к группе?`, optionStartChoose
        );
    }
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
    const user = callbackQuery.from;

    const userId = user.id;

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
                    reply_markup: keyboardStart
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
                    reply_markup: keyboardStart
                });
            // Нажатие на "Добавить группу"
            } else if (data === 'start_add_group') {
                bot.sendMessage(message.chat.id, 'Введите, пожалуйста, название группы.');

                waitingForAnswer[message.chat.id] = 'start_add_group';
            // Нажатие на "Выбрать группу"
            } else if (data === 'start_select_group') {
                const [existsUser] = await db.query('SELECT * FROM users WHERE tg_id = ?', [userId]);

                console.log(existsUser);

                if (existsUser.length === 0) {
                    await db.query('INSERT INTO users (username, role, group_id, tg_id) VALUES (?, ?, ?, ?)', 
                        [
                            user.username,
                            'none',
                            array[getUserPage(userId)].id,
                            userId
                        ]
                    );
                } else {
                    await db.query('UPDATE users SET group_id = ? WHERE tg_id = ?', 
                        [
                            array[getUserPage(userId)].id,
                            userId
                        ]
                    );
                }

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
            } else if (data === 'start_choose_option_yes') {
                setUserPage(userId, 0);

                bot.sendMessage(
                    message.chat.id, 
                    `Какая вам группа нужна?
Выберите из ниже предложенных:`, 
                    optionsStart
                );
            } else if (data === 'start_choose_option_no') {
                const [users] = await db.query('SELECT * FROM users WHERE tg_id = ?', [userId]);

                const [group] = await db.query('SELECT * FROM groups WHERE id = ?', [users[0].group_id]);

                const options = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Задачи', callback_data: 'tasks_student_printall' }],
                            [{ text: 'Добавить задачу', callback_data: 'tasks_student_addtask' }],
                            [{ text: 'Отметить как выполненное', callback_data: 'tasks_student_performtask' }]
                        ]
                    }
                };

                bot.sendMessage(
                    message.chat.id,
                    `Вы остались в своей группе: ` + group[0].name `
Доступные функции: `,
                    options
                );
            }
        } else if (data.startsWith('tasks_student_')) {
            if (data === 'tasks_student_printall') {
                const [students] = await db.query('SELECT * FROM users WHERE tg_id = ? LIMIT 1', [userId]);
                const student = students[0];

                const [tasks] = await db.query(
                    'SELECT * FROM tasks WHERE student_id = ? AND performed = ? ORDER BY deadline ASC', 
                    [student.id, false]
                );
                console.log(tasks);

                let messageOfTasks = '';
                for (let i = 0; i < tasks.length; i++) {
                    const task = tasks[i];

                    messageOfTasks += `Задача: ${task.description}, Дедлайн: ${task.deadline}\n`;
                }

                try {
                    await bot.sendMessage(message.chat.id, messageOfTasks);
                } catch (e) {
                    await bot.sendMessage(message.chat.id, 'Похоже, у вас нет задач!');
                }
                
            } else if (data === 'tasks_student_addtask') {
                const [subjects] = await db.query('SELECT sub_id FROM groupsubjects WHERE group_id = ?', [array[getUserPage(userId)].id]);

                const subIds = subjects.map(s => s.sub_id);
                const placeHolders = subIds.map(() => '?').join(',');

                const [namesOfSubjects] = await db.query(
                    `SELECT * FROM subjects WHERE id IN (${placeHolders})`,
                    subIds
                );

                const inline_keyboard = namesOfSubjects.map((btn, index) => [
                    { text: btn.name, callback_data: `subject_${index + 1}` }
                ]);

                const options = {
                    reply_markup: {
                        inline_keyboard
                    }
                };

                bot.sendMessage(message.chat.id, 'Выберите предмет, по которому будет ваша задача', options);
            } else if (data === 'tasks_student_performtask') {
                bot.sendMessage(message.chat.id, 'Ты нажал на выполнение задачи' + message.chat.id);
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