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

                //waitingForAnswer[message.chat.id] = 'start_add_group';
                waitingForAnswer[userId] = {
                    act: 'start_add_group',
                    obj: 0
                };
                
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
                            [{ text: 'Задачи', callback_data: 'tasks_student_printall' }],
                            [{ text: 'Добавить задачу', callback_data: 'tasks_student_addtask' }],
                            [{ text: 'Отметить как выполненное', callback_data: 'tasks_student_performtask' }]
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
                    `Вы остались в своей группе: ` + group[0].name + `
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

                let messageOfTasks = '';
                for (let i = 0; i < tasks.length; i++) {
                    const task = tasks[i];
                    const dateStr = task.deadline.toISOString().slice(0, 10);

                    messageOfTasks += `Задача: ${task.description}, Дедлайн: ${dateStr}\n`;
                }

                try {
                    await bot.sendMessage(message.chat.id, messageOfTasks);
                } catch (e) {
                    await bot.sendMessage(message.chat.id, 'Похоже, у вас нет задач!');
                }
                
            } else if (data === 'tasks_student_addtask') {
                const [students] = await db.query('SELECT * FROM users WHERE tg_id = ? LIMIT 1', [userId]);
                const student = students[0];

                const [subjects] = await db.query('SELECT sub_id FROM groupsubjects WHERE group_id = ?', [student.group_id]);

                const subIds = subjects.map(s => s.sub_id);
                const placeHolders = subIds.map(() => '?').join(',');

                const [namesOfSubjects] = await db.query(
                    `SELECT * FROM subjects WHERE id IN (${placeHolders})`,
                    subIds
                );

                console.log(namesOfSubjects);

                const inline_keyboard = namesOfSubjects.map((btn, index) => [
                    { text: btn.name, callback_data: `subject_${index + 1}` }
                ]);

                const [subjectsDop] = await db.query('SELECT id, name FROM notconfsubj WHERE confirmed = false AND user_id = ?', [student.id]);

                inline_keyboard.push(...subjectsDop.map((btn, index) => [
                    { text: btn.name, callback_data: `subject_dop_${index + 1}` }
                ]));

                console.log(inline_keyboard);

                inline_keyboard.push([{ text: 'Добавить новый предмет для группы', callback_data: 'subject_add_new' }]);

                const options = {
                    reply_markup: {
                        inline_keyboard
                    }
                };

                bot.sendMessage(message.chat.id, 'Выберите предмет, по которому будет ваша задача', options);
            } else if (data === 'tasks_student_performtask') {
                bot.sendMessage(message.chat.id, 'Ты нажал на выполнение задачи' + message.chat.id);
            }
        } else if (data.startsWith('subject_')) {
            if (data === 'subject_add_new') {
                // Добавляем запрос к куратору, то есть добавляем новый предмет в таблицу с предметами ожидающих подтверждения.
                // А если пользователи будут вводить уже существующие предметы, значит должен быть инструмент у админов, 
                // чтобы присваивать сущ. предмет к суш. группе

                bot.sendMessage(message.chat.id, `Вы решили добавить новый предмет)
Напишите название: `);
                waitingForAnswer[userId] = {
                    act: 'subject_add_new',
                    obj: 0
                };
            } else if (data.startsWith('subject_dop_')) {
                const subjectIndex = parseInt(data.split('_dop_')[1], 10);

                if (isNaN(subjectIndex)) {
                    return bot.answerCallbackQuery(callbackQuery.id, { text: 'Некорректный выбор предмета' });
                }

                const [students] = await db.query('SELECT * FROM users WHERE tg_id = ? LIMIT 1', [userId]);
                const student = students[0];

                const [subjects] = await db.query('SELECT sub_id FROM groupsubjects WHERE group_id = ?', [student.group_id]);
                const [subjectsDop] = await db.query('SELECT id, name FROM notconfsubj WHERE confirmed = false AND user_id = ?', [student.id]);

                if (subjectIndex < 1 || subjectIndex > subjects.length) {
                    return bot.answerCallbackQuery(callbackQuery.id, { text: 'Предмет вне диапазона' });
                }

                const subjectDop = subjectsDop[subjectIndex - 1];

                bot.sendMessage(message.chat.id, `Вы выбрали предмет: ${subjectDop.name}. 
Введите описание задачи:`);

                waitingForAnswer[userId] = {
                    act: 'add_task_for_subject_dop',
                    obj: subjectDop
                };
            } else {
                const subjectIndex = parseInt(data.split('_')[1], 10);

                if (isNaN(subjectIndex)) {
                    return bot.answerCallbackQuery(callbackQuery.id, { text: 'Некорректный выбор предмета' });
                }

                const [students] = await db.query('SELECT * FROM users WHERE tg_id = ? LIMIT 1', [userId]);
                const student = students[0];

                const [subjects] = await db.query('SELECT sub_id FROM groupsubjects WHERE group_id = ?', [student.group_id]);

                if (subjectIndex < 1 || subjectIndex > subjects.length) {
                    return bot.answerCallbackQuery(callbackQuery.id, { text: 'Предмет вне диапазона' });
                }

                const selectedSubId = subjects[subjectIndex - 1].sub_id;

                const [subject] = await db.query('SELECT * FROM subjects WHERE id = ?', [selectedSubId]);
                const subjectName = subject.length > 0 ? subject[0].name : 'Неизвестный';

                bot.sendMessage(message.chat.id, `Вы выбрали предмет: ${subjectName}. 
Введите описание задачи:`);

                waitingForAnswer[userId] = {
                    act: 'add_task_for_subject',
                    obj: subject[0]
                };

                //bot.answerCallbackQuery(callbackQuery.id);
            }
        } else if (data.startsWith('add_task_')) {
            if (data === 'add_task_for_subject_option_yes') {
                let idTask = 0;

                if (waitingForAnswer[userId].act === 'add_task_for_subject_options') {
                    idTask = waitingForAnswer[userId].obj;
                }
                delete waitingForAnswer[userId]; 

                const [tasks] = await db.query('SELECT * FROM tasks WHERE id = ?', [idTask]);
                const task = tasks[0];

                const [userGroup] = await db.query('SELECT group_id FROM users WHERE tg_id = ?', [userId]);

                await db.query('INSERT INTO tasksOfGroups (description, group_id, deadline, confirmed, sub_id, ncsub_id) VALUES (?, ?, ?, ?, ?, ?)',
                    [task.description, userGroup[0].group_id, task.deadline, false, task.sub_id, task.ncsub_id]
                );

                const options = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Задачи', callback_data: 'tasks_student_printall' }],
                            [{ text: 'Добавить задачу', callback_data: 'tasks_student_addtask' }],
                            [{ text: 'Отметить как выполненное', callback_data: 'tasks_student_performtask' }]
                        ]
                    }
                };

                bot.sendMessage( message.chat.id, `Заявка куратору отправлена!`);

                bot.sendMessage(
                    message.chat.id,
                    `Доступные функции: `,
                    options
                );
                
            } else if (data === 'add_task_for_subject_option_no') {
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
                    `Доступные функции: `,
                    options
                );
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

    if (waitingForAnswer[chatId]) {
        if (waitingForAnswer[chatId].act === 'start_add_group') {
            const groupName = msg.text;

            try {
                await db.query('INSERT INTO NotConfGr (name, confirmed) VALUES (?, ?)', [groupName, false]);
                await bot.sendMessage(chatId, `Заявка на подтверждение группы "${groupName}" успешно отправлена!
Вам придёт уведомление`);
            } catch (e) {
                console.error(e);
                await bot.sendMessage(chatId, 'Произошла ошибка при добавлении группы.');
            }

            delete waitingForAnswer[chatId];
        } else if (waitingForAnswer[chatId].act === 'subject_add_new') {
            const subjectName = msg.text;

            try {
                const [user] = await db.query('SELECT id FROM users WHERE tg_id = ?', [chatId]);

                await db.query('INSERT INTO notconfsubj (name, confirmed, user_id) VALUES (?, ?, ?)', [subjectName, false, user[0].id]);
                await bot.sendMessage(chatId, `Заявка на подтверждение предмета "${subjectName}" для группы успешно отправлена!
А пока можете его использовать для себя`);
            } catch (e) { 
                console.error(e);
                await bot.sendMessage(chatId, 'Произошла ошибка при добавлении предмета.');
            }

            delete waitingForAnswer[chatId];
        } else if (waitingForAnswer[chatId].act === 'add_task_for_subject') {
            const descText = msg.text;
            const subject = waitingForAnswer[chatId].obj;

            delete waitingForAnswer[chatId];

            try {
                const [user] = await db.query('SELECT id FROM users WHERE tg_id = ?', [chatId]);

                const [result] = await db.query(`INSERT INTO tasks (description, student_id, performed, sub_id, ncsub_id)
VALUES (?, ?, ?, ?, ?)`, [descText, user[0].id, false, subject.id, 0]);

                await bot.sendMessage(chatId, `А теперь укажи срок его выполнения в формате ГГГГ-ММ-ДД!`);

                waitingForAnswer[chatId] = {
                    act: 'add_task_for_subject_deadline',
                    obj: result.insertId
                };
            } catch (e) {
                console.error(e);
                await bot.sendMessage(chatId, 'Произошла ошибка при добавлении задачи.');
            }
        } else if (waitingForAnswer[chatId].act === 'add_task_for_subject_deadline') {
            const deadline = msg.text.trim();
            const idTask = waitingForAnswer[chatId].obj;

            delete waitingForAnswer[chatId]; 

            try {
                const dateObj = new Date(deadline);
                console.error(dateObj);
                const deadlineForDb = dateObj.toISOString().slice(0,10);
                console.error(deadlineForDb);

                await db.query('UPDATE tasks SET deadline = ? WHERE id = ?', 
                    [
                        deadlineForDb,
                        idTask
                    ]
                );

                const options = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Да', callback_data: 'add_task_for_subject_option_yes' },
                                { text: 'Нет', callback_data: 'add_task_for_subject_option_no' }
                            ]
                        ]
                    }
                } 

                waitingForAnswer[chatId] = {
                    act: 'add_task_for_subject_options',
                    obj: idTask
                };

                await bot.sendMessage(chatId, `Отлично, задача добавлена)
Отправить запрос на добавление этой задачи куратору?`, options);

            } catch (e) {
                console.error(e);
                await bot.sendMessage(chatId, 'Пожалуйста, напишите правильно дату: ');

                waitingForAnswer[chatId] = {
                    act: 'add_task_for_subject_deadline',
                    obj: idTask
                };
            }
        } else if (waitingForAnswer[chatId].act === 'add_task_for_subject_dop') { //////////////////
            const descText = msg.text;
            const subject = waitingForAnswer[chatId].obj;

            delete waitingForAnswer[chatId];

            try {
                const [user] = await db.query('SELECT id FROM users WHERE tg_id = ?', [chatId]);

                const [result] = await db.query(`INSERT INTO tasks (description, student_id, performed, sub_id, ncsub_id)
VALUES (?, ?, ?, ?, ?)`, [descText, user[0].id, false, 0, subject.id]);

                await bot.sendMessage(chatId, `А теперь укажи срок его выполнения в формате ГГГГ-ММ-ДД!`);

                waitingForAnswer[chatId] = {
                    act: 'add_task_for_subject_deadline',
                    obj: result.insertId
                };
            } catch (e) {
                console.error(e);
                await bot.sendMessage(chatId, 'Произошла ошибка при добавлении задачи.');
            }
        } 
    }
});

// Команда для вывода доступных команд
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpText = `Доступные команды:
/help — список команд и их описание`;
    bot.sendMessage(chatId, helpText);
});