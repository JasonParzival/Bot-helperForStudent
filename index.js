const TelegramBot = require('node-telegram-bot-api');

const db = require('./database');

const token = require('./data.js');

const { setIntervalAsync } = require('set-interval-async/dynamic');

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

const optionsTasks = {
    reply_markup: {
        inline_keyboard: [
            [{ text: 'Задачи', callback_data: 'tasks_student_printall' }],
            [{ text: 'Добавить задачу', callback_data: 'tasks_student_addtask' }]
        ]
    }
};

const optionsAdmin = {
    reply_markup: {
        inline_keyboard: [
            [{ text: 'Выбрать группу пользователя', callback_data: 'admin_search_group' }],
            [{ text: 'Выдать роль через его id', callback_data: 'admin_give_role_by_id' }],
            [{ text: 'Запросы на добавление предмета', callback_data: 'manager_or_admin_add_sub' }],
            [{ text: 'Запросы на добавление группы', callback_data: 'admin_add_group' }]
        ]
    }
};

const optionsGroupManager = {
    reply_markup: {
        inline_keyboard: [
            [{ text: 'Добавить задачу', callback_data: 'group_manager_addtask' }],
            [{ text: 'Отправить уведомление всей группе', callback_data: 'group_manager_sendnotification' }],
            [{ text: 'Редактирование предметов группы', callback_data: 'group_manager_editsubjects' }]
        ]
    }
};

const cancelKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [{ text: 'Отмена', callback_data: 'cancel_action' }]
        ]
    }
};

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
    } else if (existsUser[0].role === 'Admin') {
        bot.sendMessage(
            chatId, 
            `Здравствуйте, администратор!
Вы можете только выдавать роли(
Либо вы просто находите человека через первую кнопку
Либо же через вторую кнопку вы указываете id пользователя и его роль 
Выберите из ниже предложенных:`, 
            optionsAdmin
        );
    } else if (existsUser[0].role === 'GroupManager') {
        const [groups] = await db.query('SELECT name FROM groups WHERE id = ?', [existsUser[0].group_id]);

        bot.sendMessage(
            chatId, 
            `Здравствуйте, куратор группы ${groups[0].name}!
Для Вас доступны следующие функции:`, optionsGroupManager
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

// Объект под состояния администратора/куратора
const waitingForAnswerAdmin = {};

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

    console.log(getUserPage(userId));
    console.log(data);

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
                bot.sendMessage(message.chat.id, 'Введите, пожалуйста, название группы.', cancelKeyboard);

                //waitingForAnswer[message.chat.id] = 'start_add_group';
                waitingForAnswer[userId] = {
                    act: 'start_add_group',
                    obj: 0
                };
                
            // Нажатие на "Выбрать группу"
            } else if (data === 'start_select_group') {
                const [existsUser] = await db.query('SELECT * FROM users WHERE tg_id = ?', [userId]);

                console.log(getUserPage(userId));
                if (existsUser.length === 0) {
                    if (getUserPage(userId) == -1) {
                        bot.sendMessage(message.chat.id, `Вы не выбрали группу
Какая вам группа нужна?
Выберите из ниже предложенных`, optionsStart
                        );
                    } else {
                        await db.query('INSERT INTO users (username, role, group_id, tg_id) VALUES (?, ?, ?, ?)', 
                            [
                                user.username,
                                'none',
                                array[getUserPage(userId)].id,
                                userId
                            ]
                        );
                    }
                } else {
                    if (getUserPage(userId) == -1) {
                        bot.sendMessage(message.chat.id, `Вы не выбрали группу, вы остались в той же.
Доступные функции: `, optionsTasks
                        );
                    } else {
                        await db.query('UPDATE users SET group_id = ? WHERE tg_id = ?', 
                            [
                                array[getUserPage(userId)].id,
                                userId
                            ]
                        );
                        bot.sendMessage(message.chat.id, `Отлично, вы выбрали группу.
Доступные функции: `, optionsTasks
                        );
                    }
                }
            } else if (data === 'start_choose_option_yes') {
                bot.sendMessage(
                    message.chat.id, 
                    `Какая вам группа нужна?
Выберите из ниже предложенных:`, 
                    optionsStart
                );
            } else if (data === 'start_choose_option_no') {
                const [users] = await db.query('SELECT * FROM users WHERE tg_id = ?', [userId]);

                const [group] = await db.query('SELECT * FROM groups WHERE id = ?', [users[0].group_id]);

                bot.sendMessage(
                    message.chat.id,
                    `Вы остались в своей группе: ` + group[0].name + `
Доступные функции: `,
                    optionsTasks
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

                //const [subs] = await db.query('SELECT * FROM subjects WHERE tg_id = ? LIMIT 1', [userId]);

                let messageOfTasks = '';
                let k = 0;
                for (let i = 0; i < tasks.length; i++) {
                    const task = tasks[i];
                    const dateStr = task.deadline.toISOString().slice(0, 10);

                    k++;

                    let nameSub = '';
                    if (task.sub_id == 0) {
                        const [ncsub] = await db.query('SELECT * FROM notconfsubj WHERE id = ?', [task.ncsub_id]);
                        nameSub = ncsub[0].name;
                    } else {
                        const [sub] = await db.query('SELECT * FROM subjects WHERE id = ?', [task.sub_id]);
                        nameSub = sub[0].name;
                    }
                    
                    messageOfTasks += `${k}. Задача: ${task.description}, Предмет: ${nameSub}, Дедлайн: ${dateStr}\n`;
                }

                const inline_keyboard = tasks.map((btn, index) => [
                    { text: index + 1, callback_data: `perform_task_${index + 1}` }
                ]);

                const options = {
                    reply_markup: {
                        inline_keyboard
                    }
                };

                try {
                    await bot.sendMessage(message.chat.id, messageOfTasks, options);
                } catch (e) {
                    await bot.sendMessage(message.chat.id, 'Похоже, у вас нет задач!');
                }
            } else if (data === 'tasks_student_addtask') {
                try {
                    const [students] = await db.query('SELECT * FROM users WHERE tg_id = ? LIMIT 1', [userId]);
                    const student = students[0];

                    const [subjects] = await db.query('SELECT sub_id FROM groupsubjects WHERE group_id = ?', [student.group_id]);

                    const subIds = subjects.map(s => s.sub_id);
                    const placeHolders = subIds.map(() => '?').join(',');

                    const [namesOfSubjects] = await db.query(
                        `SELECT * FROM subjects WHERE id IN (${placeHolders})`,
                        subIds
                    );

                    const inline_keyboard = namesOfSubjects.map((btn, index) => [
                        { text: btn.name, callback_data: `subject_${index + 1}` }
                    ]);

                    const [subjectsDop] = await db.query('SELECT id, name FROM notconfsubj WHERE confirmed = false AND user_id = ?', [student.id]);

                    inline_keyboard.push(...subjectsDop.map((btn, index) => [
                        { text: btn.name, callback_data: `subject_dop_${index + 1}` }
                    ]));

                    inline_keyboard.push([{ text: 'Добавить новый предмет для группы', callback_data: 'subject_add_new' }]);

                    const options = {
                        reply_markup: {
                            inline_keyboard
                        }
                    };

                    bot.sendMessage(message.chat.id, 'Выберите предмет, по которому будет ваша задача', options);
                } catch (e) {
                    bot.sendMessage(message.chat.id, 'Видимо в вашей группе нет предметов, обратитесь к Куратору группы или же к Администратору');
                }
            }
        } else if (data.startsWith('subject_')) {
            if (data === 'subject_add_new') {
                // Добавляем запрос к куратору, то есть добавляем новый предмет в таблицу с предметами ожидающих подтверждения.
                // А если пользователи будут вводить уже существующие предметы, значит должен быть инструмент у админов, 
                // чтобы присваивать сущ. предмет к суш. группе

                bot.sendMessage(message.chat.id, `Вы решили добавить новый предмет)
Напишите название: `, cancelKeyboard);
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

                const [subjectsDop] = await db.query('SELECT id, name FROM notconfsubj WHERE confirmed = false AND user_id = ?', [student.id]);

                if (subjectIndex < 1 || subjectIndex > subjectsDop.length) {
                    return bot.answerCallbackQuery(callbackQuery.id, { text: 'Предмет вне диапазона' });
                }

                const subjectDop = subjectsDop[subjectIndex - 1];

                bot.sendMessage(message.chat.id, `Вы выбрали предмет: ${subjectDop.name}. 
Введите описание задачи:`, cancelKeyboard);

                waitingForAnswer[userId] = {
                    act: 'add_task_for_subject_dop',
                    obj: subjectDop
                };

                bot.sendMessage(message.chat.id, `Шаблоны:`);
                bot.sendMessage(message.chat.id, `1) Закрыть долги
2) Сдать лабораторную работу
3) Сдать курсовую работу
4) Подготовиться к экзамену
5) Подготовиться к защите лаб. работы`);
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
Введите описание задачи:`, cancelKeyboard);

                waitingForAnswer[userId] = {
                    act: 'add_task_for_subject',
                    obj: subject[0]
                };

                bot.sendMessage(message.chat.id, `Шаблоны:`);
                bot.sendMessage(message.chat.id, `1) Закрыть долги
2) Сдать лабораторную работу
3) Сдать курсовую работу
4) Подготовиться к экзамену
5) Подготовиться к защите лаб. работы`);
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

                bot.sendMessage( message.chat.id, `Заявка куратору отправлена!`);

                bot.sendMessage(
                    message.chat.id,
                    `Доступные функции: `,
                    optionsTasks
                );
                
            } else if (data === 'add_task_for_subject_option_no') {
                bot.sendMessage(
                    message.chat.id,
                    `Доступные функции: `,
                    optionsTasks
                );
            }
        } else if (data.startsWith('perform_task_')) {
            const taskIndex = parseInt(data.split('_task_')[1], 10);

            if (isNaN(taskIndex)) {
                return bot.answerCallbackQuery(callbackQuery.id, { text: 'Некорректный выбор предмета' });
            }

            const [students] = await db.query('SELECT * FROM users WHERE tg_id = ? LIMIT 1', [userId]);
            const student = students[0];

            const [tasks] = await db.query('SELECT * FROM tasks WHERE performed = ? AND student_id = ? ORDER BY deadline ASC', [false, student.id]);

            if (taskIndex < 1 || taskIndex > tasks.length) {
                return bot.answerCallbackQuery(callbackQuery.id, { text: 'Предмет вне диапазона' });
            }

            const currentTask = tasks[taskIndex - 1];

            await db.query('UPDATE tasks SET performed = ? WHERE id = ?', [true, currentTask.id]);

            bot.sendMessage(message.chat.id, `Задача: ${currentTask.description} - выполнена!`);

            bot.sendMessage(
                message.chat.id,
                `Доступные функции: `,
                optionsTasks
            );
        } else if (data.startsWith('admin_')) {
            if (data === 'admin_search_group') {
                const [groups] = await db.query('SELECT * FROM groups');

                const inline_keyboard = groups.map((btn, index) => [
                    { text: btn.name, callback_data: `group_admin_${index + 1}` }
                ]);

                const options = {
                    reply_markup: {
                        inline_keyboard
                    }
                }
                bot.sendMessage(message.chat.id, 'Выберите группу', options);
            } else if (data === 'admin_give_role_by_id') {
                bot.sendMessage(message.chat.id, 'Укажите его/её телеграмм ID', cancelKeyboard);

                waitingForAnswerAdmin[message.chat.id] = {
                    act: 'write_tgid_of_user'
                };
            } else if (data === 'admin_add_group') {
                const [groups] = await db.query('SELECT * FROM notconfgr WHERE confirmed = ?', [false]);

                const inline_keyboard = groups.map((btn, index) => [
                    { text: btn.name, callback_data: `ncgroup_admin_${index + 1}` }
                ]);

                const options = {
                    reply_markup: {
                        inline_keyboard
                    }
                }
                bot.sendMessage(message.chat.id, 'Выберите группу, предложенную студентом', options);
            }
        } else if (data.startsWith('group_admin_')) {
            const groupIndex = parseInt(data.split('_admin_')[1], 10);

            const [groups] = await db.query('SELECT * FROM groups');

            const [students] = await db.query('SELECT * FROM users WHERE group_id = ?', [groups[groupIndex - 1].id]);

            if (students.length === 0) {
                bot.sendMessage(message.chat.id, 'Ни одного студента в этой группе');
            } else {
                const inline_keyboard = students.map((btn) => [
                    { text: btn.username, callback_data: `student_admin_${btn.id}` }
                ]);

                const options = {
                    reply_markup: {
                        inline_keyboard
                    }
                }

                bot.sendMessage(message.chat.id, 'Выберите студента', options);
            }
        } else if (data.startsWith('student_admin_')) {
            const studentID = parseInt(data.split('_admin_')[1], 10);

            const options = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: 'Участник', callback_data: `role_admin_student_id_${studentID}` },
                            { text: 'Куратор', callback_data: `role_admin_groupmanager_id_${studentID}` }
                        ]
                    ]
                }
            }

            bot.sendMessage(message.chat.id, 'Выберите роль', options);
        } else if (data.startsWith('role_admin_')) {
            if (data.startsWith('role_admin_student_')) {
                if (data.startsWith('role_admin_student_id_')) {
                    const studentID = parseInt(data.split('_id_')[1], 10);

                    const role = 'Student';

                    try {
                        await db.query('UPDATE users SET role = ? WHERE id = ?', [role, studentID])

                        bot.sendMessage(message.chat.id, 'Вы успешно поставили ему роль Ученика');
                    } catch(e) {
                        console.log(e);
                    }
                } else if (data.startsWith('role_admin_student_tgid_')) {
                    const studentTGID = parseInt(data.split('_tgid_')[1], 10);

                    const role = 'Student';

                    try {
                        await db.query('UPDATE users SET role = ? WHERE tg_id = ?', [role, studentTGID])

                        bot.sendMessage(message.chat.id, 'Вы успешно поставили ему роль Ученика');
                    } catch(e) {
                        console.log(e);
                    }
                }
            } else if (data.startsWith('role_admin_groupmanager_')) {
                if (data.startsWith('role_admin_groupmanager_id_')) {
                    const studentID = parseInt(data.split('_id_')[1], 10);

                    const role = 'GroupManager';

                    try {
                        await db.query('UPDATE users SET role = ? WHERE id = ?', [role, studentID])

                        bot.sendMessage(message.chat.id, 'Вы успешно поставили ему роль Куратора');
                    } catch(e) {
                        console.log(e);
                    }
                } else if (data.startsWith('role_admin_groupmanager_tgid_')) {
                    const studentTGID = parseInt(data.split('_id_')[1], 10);

                    const role = 'GroupManager';

                    try {
                        await db.query('UPDATE users SET role = ? WHERE tg_id = ?', [role, studentTGID])

                        bot.sendMessage(message.chat.id, 'Вы успешно поставили ему роль Куратора');
                    } catch(e) {
                        console.log(e);
                    }
                }
            }
        } else if (data.startsWith('group_manager_')) {
            if (data === 'group_manager_addtask') {
                const options = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Для группы', callback_data: 'manager_addtask_for_group' },
                                { text: 'Себе', callback_data: 'manager_addtask_for_myself' }
                            ],
                            [ { text: 'Запросы на задачи от студентов', callback_data: 'manager_addtask_of_student' } ]
                        ]
                    }
                }

                bot.sendMessage(message.chat.id, 'Для кого вы хотите добавить задачу?', options);
            } else if (data === 'group_manager_sendnotification') {
                bot.sendMessage(message.chat.id, `Напишите ваше сообщения для группы!`, cancelKeyboard);

                waitingForAnswerAdmin[userId] = {
                    act: 'notification_for_all_of_group'
                };
            } else if (data === 'group_manager_editsubjects') {
                const options = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Добавить предмет', callback_data: 'Gmanager_add_subject' },
                                { text: 'Удалить предмет', callback_data: 'Gmanager_delete_subject' }
                            ],
                            [{ text: 'Запросы на добавление предмета', callback_data: 'manager_or_admin_add_sub' }]
                        ]
                    }
                }

                bot.sendMessage(message.chat.id, 'Что вы хотите сделать? Добавить или удалить предмет группы', options);
            }
        } else if (data.startsWith('manager_addtask_')) {
            if (data.startsWith('manager_addtask_for_')) {
                const forWho = data.split('_for_')[1];

                bot.sendMessage(message.chat.id, 'Введите описание задачи', cancelKeyboard);

                waitingForAnswerAdmin[userId] = {
                    act: 'add_task_for_everyone_or_myself',
                    obj: forWho
                };
            } else if (data === 'manager_addtask_of_student') {
                try {
                    const [group] = await db.query('SELECT group_id FROM users WHERE tg_id = ?', [userId]);
                    const [tasks] = await db.query('SELECT * FROM tasksofgroups WHERE group_id = ? AND confirmed = ?', [group[0].group_id, false]);

                    const subIds = tasks.map(s => s.sub_id);
                    const placeHolders = subIds.map(() => '?').join(',');

                    const [namesOfSubjects] = await db.query(
                        `SELECT * FROM subjects WHERE id IN (${placeHolders})`,
                        subIds
                    );

                    let messageManager = '';
                    for (let i = 0; i < tasks.length; i++) {
                        messageManager += '' + (i + 1) + '. Задача: ' + tasks[i].description + '\n' +
                        'Предмет: ' + namesOfSubjects[i].name + '\n' +
                        'Срок до: ' + tasks[i].deadline + '\n'
                    }

                    const inline_keyboard = namesOfSubjects.map((btn, index) => [
                        { text: index + 1, callback_data: `task_of_student_${index + 1}` }
                    ]);

                    const options = {
                        reply_markup: {
                            inline_keyboard
                        }
                    };

                    bot.sendMessage(message.chat.id, messageManager + 'Выберите задачу для добавления к группе', options);
                } catch(e) {
                    bot.sendMessage(message.chat.id, 'Похоже, запросов на задач нет(');
                }
            }
        } else if (data.startsWith('groupManager_subject_')) {
            const subjectIndex = parseInt(data.split('_subject_')[1], 10);

            const [userGroup] = await db.query('SELECT group_id FROM users WHERE tg_id = ?', [userId]);
            const [subjects] = await db.query('SELECT sub_id FROM groupsubjects WHERE group_id = ?', [userGroup[0].group_id]);

            const subIds = subjects.map(s => s.sub_id);
            const placeHolders = subIds.map(() => '?').join(',');

            const [namesOfSubjects] = await db.query(
                `SELECT * FROM subjects WHERE id IN (${placeHolders})`,
                subIds
            );

            const subject = namesOfSubjects[subjectIndex - 1];

            const [student] = await db.query('SELECT id, group_id FROM users WHERE tg_id = ?', [userId]);
            const [studentsOfGroup] = await db.query('SELECT * FROM users WHERE group_id = ?', [student[0].group_id])

            if (waitingForAnswerAdmin[userId]) {
                if (waitingForAnswerAdmin[userId].obj === 'group') {
                    try {
                        for (let i = 0; i < studentsOfGroup.length; i++) {
                            await db.query(`INSERT INTO tasks (description, deadline, student_id, performed, sub_id)
VALUES (?, ?, ?, ?, ?)`, 
    [waitingForAnswerAdmin[userId].text, waitingForAnswerAdmin[userId].deadline, studentsOfGroup[i].id, false, subject.id]);
                        }

                        await bot.sendMessage(userId, `Отлично, задача для группы добавлена)`);

                    } catch (e) {
                        console.error(e);
                    }
                } else if (waitingForAnswerAdmin[userId].obj === 'myself') {
                    try {
                        await db.query(`INSERT INTO tasks (description, deadline, student_id, performed, sub_id)
VALUES (?, ?, ?, ?, ?)`, 
    [waitingForAnswerAdmin[userId].text, waitingForAnswerAdmin[userId].deadline, student[0].id, false, subject.id]);

                        await bot.sendMessage(userId, `Отлично, задача для Вас добавлена)`);

                    } catch (e) {
                        console.error(e);
                    }
                }
            }
            delete waitingForAnswerAdmin[userId];
        } else if (data.startsWith('Gmanager_')) {
            if (data === 'Gmanager_add_subject') {
                bot.sendMessage(message.chat.id, 'Введите название предмета', cancelKeyboard);

                waitingForAnswerAdmin[userId] = {
                    act: 'add_subject_for_group'
                };
            } else if (data === 'Gmanager_delete_subject') {
                const [group] = await db.query('SELECT group_id FROM users WHERE tg_id = ?', [userId]);
                const [subjects] = await db.query('SELECT sub_id FROM groupsubjects WHERE group_id = ?', [group[0].group_id]);

                const subIds = subjects.map(s => s.sub_id);
                const placeHolders = subIds.map(() => '?').join(',');

                const [namesOfSubjects] = await db.query(
                    `SELECT * FROM subjects WHERE id IN (${placeHolders})`,
                    subIds
                );

                const inline_keyboard = namesOfSubjects.map((btn, index) => [
                    { text: btn.name, callback_data: `delete_subject_${index + 1}` }
                ]);

                const options = {
                    reply_markup: {
                        inline_keyboard
                    }
                };

                bot.sendMessage(message.chat.id, 'Выберите предмет для удаления', options);
            }
        } else if (data.startsWith('delete_subject_')) {
            const subId = parseInt(data.split('_subject_')[1], 10);

            const [group] = await db.query('SELECT group_id FROM users WHERE tg_id = ?', [userId]);
            const [subjects] = await db.query('SELECT sub_id FROM groupsubjects WHERE group_id = ?', [group[0].group_id]);

            const subIds = subjects.map(s => s.sub_id);
            const placeHolders = subIds.map(() => '?').join(',');

            const [namesOfSubjects] = await db.query(
                `SELECT * FROM subjects WHERE id IN (${placeHolders})`,
                subIds
            );

            const subject = namesOfSubjects[subId - 1];

            try {
                await db.query('DELETE FROM groupsubjects WHERE group_id = ? AND sub_id = ?', [group[0].group_id, subject.id]);

                bot.sendMessage(message.chat.id, `Предмет "${subject.name}" успешно удалён из вашей группы)`);
            } catch(e) {
                console.error(e);
                bot.sendMessage(message.chat.id, `Что-то пошло не так`);
            }
        } else if (data.startsWith('task_of_student_')) {
            const taskStudent = parseInt(data.split('_student_')[1], 10);

            const [group] = await db.query('SELECT group_id FROM users WHERE tg_id = ?', [userId]);
            const [tasks] = await db.query('SELECT * FROM tasksofgroups WHERE group_id = ? AND confirmed = ?', [group[0].group_id, false]);

            const [students] = await db.query('SELECT id FROM users WHERE group_id = ?', [group[0].group_id]);
            const subject = tasks[taskStudent - 1];

            await db.query('UPDATE tasksofgroups SET confirmed = ? WHERE id = ?', [true, tasks[taskStudent - 1].id]);

            for (let i = 0; i < students.length; i++) {
                await db.query('INSERT INTO tasks (description, student_id, deadline, performed, sub_id, ncsub_id) VALUES (?, ?, ?, ?, ?, ?)',
                    [subject.description, students[i].id, subject.deadline, false, subject.sub_id, subject.ncsub_id]
                );
            }
            
            bot.sendMessage(message.chat.id, 'Задача от студенты успешно принята');
        } else if (data.startsWith('manager_or_admin_add_sub')) {
            const [existsUser] = await db.query('SELECT * FROM users WHERE tg_id = ?', [userId]);

            if (existsUser[0].role === 'Admin') {
                const [ncsubjects] = await db.query('SELECT * FROM notconfsubj WHERE confirmed = ?', [false]);

                const userIds = ncsubjects.map(s => s.user_id);
                const placeHoldersF = userIds.map(() => '?').join(',');

                const [groupsOfStudents] = await db.query(
                    `SELECT group_id FROM users WHERE id IN (${placeHoldersF})`,
                    userIds
                ); 

                const groupIds = groupsOfStudents.map(s => s.group_id);
                const placeHoldersS = groupIds.map(() => '?').join(',');

                const [namesOfGroups] = await db.query(
                    `SELECT name FROM groups WHERE id IN (${placeHoldersS})`,
                    groupIds
                );

                let messageAdmin = '';
                for (let i = 0; i < namesOfGroups.length; i++) {
                    messageAdmin += '' + (i + 1) + '. Название: ' + ncsubjects[i].name + '\n' +
                    'Для группы: ' + namesOfGroups[i].name + '\n'
                }

                const inline_keyboard = ncsubjects.map((index) => [
                    { text: index + 1, callback_data: `add_subject_${index + 1}` }
                ]);

                const options = {
                    reply_markup: {
                        inline_keyboard
                    }
                };

                bot.sendMessage(message.chat.id, messageAdmin + 'Выберите предмет для одобрения', options);
            } else if (existsUser[0].role === 'GroupManager') {
                const [students] = await db.query('SELECT * FROM users WHERE group_id = ?', [existsUser[0].group_id]);

                const studentsIds = students.map(s => s.id);
                const placeHoldersZ = studentsIds.map(() => '?').join(',');

                const [ncsubjects] = await db.query(`SELECT * FROM notconfsubj WHERE confirmed = ? AND user_id IN (${placeHoldersZ})`, 
                    [false, ...studentsIds]
                );

                const inline_keyboard = ncsubjects.map((btn, index) => [
                    { text: btn.name, callback_data: `add_subject_${index + 1}` }
                ]);

                const options = {
                    reply_markup: {
                        inline_keyboard
                    }
                };

                bot.sendMessage(message.chat.id, 'Выберите предмет для одобрения', options);
            }
        } else if (data.startsWith('add_subject_')) {
            const subId = parseInt(data.split('_subject_')[1], 10); 
            const [existsUser] = await db.query('SELECT * FROM users WHERE tg_id = ?', [userId]);

            if (existsUser[0].role === 'Admin') {
                const [ncsubjects] = await db.query('SELECT * FROM notconfsubj WHERE confirmed = ?', [false]);

                const userIds = ncsubjects.map(s => s.user_id);
                const placeHoldersF = userIds.map(() => '?').join(',');

                const [groupsOfStudents] = await db.query(
                    `SELECT group_id FROM users WHERE id IN (${placeHoldersF})`,
                    userIds
                ); 

                const groupIds = groupsOfStudents.map(s => s.group_id);
                const placeHoldersS = groupIds.map(() => '?').join(',');

                const [namesOfGroups] = await db.query(
                    `SELECT id, name FROM groups WHERE id IN (${placeHoldersS})`,
                    groupIds
                );

                const groups = namesOfGroups[subId - 1];

                const [insert] = await db.query('INSERT INTO subjects (name) VALUES (?)', [ncsubjects[subId - 1].name]);
                
                await db.query('INSERT INTO groupsubjects (group_id, sub_id) VALUES (?, ?)', [groups.id, insert.insertId]);

                bot.sendMessage(message.chat.id, 'Предмет успешно добавлен');
            } else if (existsUser[0].role === 'GroupManager') {
                const [students] = await db.query('SELECT * FROM users WHERE group_id = ?', [existsUser[0].group_id]);

                const studentsIds = students.map(s => s.id);
                const placeHoldersZ = studentsIds.map(() => '?').join(',');

                const [ncsubjects] = await db.query(`SELECT * FROM notconfsubj WHERE confirmed = ? AND user_id IN (${placeHoldersZ})`, 
                    [false, ...studentsIds]
                );

                const [insert] = await db.query('INSERT INTO subjects (name) VALUES (?)', [ncsubjects[subId - 1].name]);
                
                await db.query('INSERT INTO groupsubjects (group_id, sub_id) VALUES (?, ?)', [existsUser[0].group_id, insert.insertId]);

                await db.query('UPDATE notconfsubj SET confirmed = ? WHERE id = ?', [true, ncsubjects[0].id]);

                bot.sendMessage(message.chat.id, 'Предмет успешно добавлен для вашей группы');
            }
        }     // изменить запросы под LEFT JOIN!!! 
        else if (data.startsWith('ncgroup_admin_')) {
            const grId = parseInt(data.split('_subject_')[1], 10); 

            const [groups] = await db.query('SELECT * FROM notconfgr WHERE confirmed = ?', [false]);

            const confirmedGroup = groups[grId - 1];

            await db.query('UPDATE notconfgr SET confirmed = ? WHERE id = ?', [true, confirmedGroup.id]);

            await db.query('INSERT INTO groups (name) VALUES (?)', [confirmedGroup.name]);

            bot.sendMessage(message.chat.id, 'Группа успешно добавлена)');
        } else if (data === 'cancel_action') {
            if (waitingForAnswer[userId]) {
                delete waitingForAnswer[userId]; 
                bot.sendMessage(message.chat.id, 'Действие отменено.');
            }
            if (waitingForAnswerAdmin[userId]) {
                delete waitingForAnswerAdmin[userId];
                bot.sendMessage(message.chat.id, 'Действие отменено.');
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
        } else if (waitingForAnswer[chatId].act === 'add_task_for_subject_dop') {
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
    } else if (waitingForAnswerAdmin[chatId]) {
        if (waitingForAnswerAdmin[chatId].act === 'write_tgid_of_user') {
            let tgid = 0;
            try {
                tgid = parseInt(msg.text, 10);
            } catch (e) {
                console.log(e);
                await bot.sendMessage(chatId, 'Вы неверно ввели айди');
            }

            if (tgid != 0) {
                const options = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Участник', callback_data: `role_admin_student_tgid_${tgid}` },
                                { text: 'Куратор', callback_data: `role_admin_groupmanager_tgid_${tgid}` }
                            ]
                        ]
                    }
                }

                delete waitingForAnswerAdmin[chatId];

                bot.sendMessage(chatId, 'Выберите роль', options);
            }
            else {
                await bot.sendMessage(chatId, 'Введите только цифры: ');

                waitingForAnswerAdmin[chatId] = {
                    act: 'write_tgid_of_user'
                };
            }
        } else if (waitingForAnswerAdmin[chatId].act === 'add_task_for_everyone_or_myself') {
            const forWho = waitingForAnswerAdmin[chatId].obj;

            delete waitingForAnswerAdmin[chatId];

            bot.sendMessage(chatId, 'Укажите срок его выполнения в формате ГГГГ-ММ-ДД!');

            waitingForAnswerAdmin[chatId] = {
                act: 'add_task_for_everyone_or_myself_deadline',
                obj: forWho,
                text: msg.text
            };
        } else if (waitingForAnswerAdmin[chatId].act === 'add_task_for_everyone_or_myself_deadline') {
            const forWho = waitingForAnswerAdmin[chatId].obj;
            const textTask = waitingForAnswerAdmin[chatId].text;
            const deadline = msg.text.trim();

            delete waitingForAnswerAdmin[chatId];

            try {
                const dateObj = new Date(deadline);
                const dateCheck = new Date();
                const deadlineForDb = dateObj.toISOString().slice(0,10);

                if (dateObj > dateCheck) {
                    const [userGroup] = await db.query('SELECT group_id FROM users WHERE tg_id = ?', [chatId]);
                    const [subjects] = await db.query('SELECT sub_id FROM groupsubjects WHERE group_id = ?', [userGroup[0].group_id]);

                    const subIds = subjects.map(s => s.sub_id);
                    const placeHolders = subIds.map(() => '?').join(',');

                    const [namesOfSubjects] = await db.query(
                        `SELECT * FROM subjects WHERE id IN (${placeHolders})`,
                        subIds
                    );

                    const inline_keyboard = namesOfSubjects.map((btn, index) => [
                        { text: btn.name, callback_data: `groupManager_subject_${index + 1}` }
                    ]);

                    const options = {
                        reply_markup: {
                            inline_keyboard
                        }
                    }

                    waitingForAnswerAdmin[chatId] = {
                        act: 'add_task_for_everyone_or_myself_subject',
                        obj: forWho,
                        deadline: deadlineForDb,
                        text: textTask
                    };

                    bot.sendMessage(chatId, 'Выберите предмет', options);
                } else {
                    bot.sendMessage(chatId, 'Дедлайн не может быть в прошлом');

                    waitingForAnswerAdmin[chatId] = {
                        act: 'add_task_for_everyone_or_myself_deadline',
                        obj: forWho,
                        text: textTask
                    };
                }
            } catch (e) {
                bot.sendMessage(chatId, 'Вы неправильно ввели время, вводите в формате ГГГГ-ММ-ДД');
                waitingForAnswerAdmin[chatId] = {
                    act: 'add_task_for_everyone_or_myself_deadline',
                    obj: forWho,
                    text: textTask
                };
            }
        } else if (waitingForAnswerAdmin[chatId].act === 'notification_for_all_of_group') {
            const message = msg.text;

            const [groupManager] = await db.query('SELECT username, group_id FROM users WHERE tg_id = ?', [chatId]);
            const [students] = await db.query('SELECT * FROM users WHERE group_id = ? AND tg_id != ?', 
                [groupManager[0].group_id, chatId]
            );

            if (students.length > 1) {
                for (let i = 0; i < students.length; i++) {
                    bot.sendMessage(students[i].tg_id, `Сообщение от куратора ${groupManager[0].username}:\n` + message);
                } 
            } else {
                bot.sendMessage(chatId, `Видимо в вашей группе никого нет`);
            }
        } else if (waitingForAnswerAdmin[chatId].act === 'add_subject_for_group') {
            const nameSub = msg.text;

            const [insertResult] = await db.query('INSERT INTO subjects (name) VALUES (?)', [nameSub]);
            const insertedId = insertResult.insertId;
            const [group] = await db.query('SELECT group_id FROM users WHERE tg_id = ?', [chatId]);
            await db.query('INSERT INTO groupsubjects (group_id, sub_id) VALUES (?, ?)', [group[0].group_id, insertedId]);

            bot.sendMessage(chatId, `Предмет "${nameSub}" для вашей группы создан`);
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

// Команды для уведомлений о дедлайнах
setTimeout(() => {
    setIntervalAsync(async () => {
        try {
            await checkDeadlineOfUsers();
        } catch (e) {
            console.error('Ошибка в таймере:', e);
        }
    }, 24 * 60 * 60 * 1000);
    checkDeadlineOfUsers();
}, msUntilNext12IRK());

function msUntilNext12IRK() {
  const now = new Date();

  const next = new Date(now);

  next.setUTCHours(4, 0, 0, 0);

  if (now >= next) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next - now;
}

async function checkDeadlineOfUsers() {
    const weakAfter = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const weakDateStr = weakAfter.toISOString().slice(0, 10);

    const dateNow = new Date(Date.now());
    const nowDateStr = dateNow.toISOString().slice(0, 10);

    const [tasks] = await db.query('SELECT * FROM tasks WHERE performed = ? AND deadline <= ? AND deadline >= ?',
        [false, weakDateStr, nowDateStr]
    );

    const userIds = tasks.map(s => s.student_id);

    if (userIds.length === 0) {
        return;
    }

    const placeHolders = userIds.map(() => '?').join(',');

    const [users] = await db.query(
        `SELECT * FROM users WHERE id IN (${placeHolders})`,
        userIds
    );

    for (const user of users) {
        await sendNotification(user.tg_id, user.id, weakDateStr, nowDateStr);
    }
}

async function sendNotification(chatId, studentId, weakDateStr, nowDateStr) {
    try {
        const [tasks] = await db.query(`SELECT tasks.*, subjects.name AS subject_name, notconfsubj.name AS notconfsubj_name
            FROM tasks  
            LEFT JOIN subjects ON tasks.sub_id = subjects.id
            LEFT JOIN notconfsubj ON tasks.ncsub_id = notconfsubj.id
            WHERE performed = ?
            AND student_id = ? 
            AND deadline <= ? 
            AND deadline >= ?`,
            [false, studentId, weakDateStr, nowDateStr]
        );
        if (tasks.length !== 0) {
            let message = 'Ежедневное уведомление\n';
            const now = new Date();

            for (let i = 0; i < tasks.length; i++) {
                const task = tasks[i];

                let nameSub = '';

                if (task.sub_id != 0) {
                    nameSub = task.subject_name;
                } else {
                    nameSub = task.notconfsubj_name;
                }

                const deadlineDate = new Date(task.deadline)

                const diffMs = deadlineDate - now;

                const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

                message += '' + (i + 1) + '. Задача - ' + task.description + '\nПо предмету: ' + nameSub + '\nОсталось: ' + diffDays + ' д.\n';
            }
            await bot.sendMessage(chatId, message);
        }
    } catch (e) {
        console.log(e);
    }
}

/*bot.onText(/\/checking/, (msg) => {
    checkDeadlineOfUsers();
});*/