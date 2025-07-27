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
            [{ text: 'Добавить задачу', callback_data: 'tasks_student_addtask' }],
            [{ text: 'Отметить как выполненное', callback_data: 'tasks_student_performtask' }]
        ]
    }
};

const optionsAdmin = {
    reply_markup: {
        inline_keyboard: [
            [{ text: 'Выбрать группу пользователя', callback_data: 'admin_search_group' }],
            [{ text: 'Выдать роль через его id', callback_data: 'admin_give_role_by_id' }]
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

                bot.sendMessage(message.chat.id, `Отлично, вы выбрали группу.
Доступные функции: `, optionsTasks
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
            } else if (data === 'tasks_student_performtask') {
                const [student] =  await db.query('SELECT * FROM users WHERE tg_id = ?', [userId]);

                const [tasks] = await db.query('SELECT * FROM tasks WHERE performed = ? AND student_id = ?', [false, student[0].id]);

                const subjectIds = {};

                let k = 1;

                tasks.forEach(task => {
                    if (task.sub_id && task.sub_id !== 0) {
                        subjectIds[k] = {
                            name: 'subject',
                            idSub: task.sub_id
                        };
                        k++;
                    }
                      
                    if (task.ncsub_id && task.ncsub_id !== 0) {
                        subjectIds[k] = {
                            name: 'subject_dop',
                            idSub: task.ncsub_id
                        };
                        k++;
                    }
                });

                const subjectNames = {};

                for (let i = 1; i < k; i++) {
                    let name = [];
                    if (subjectIds[i].name === 'subject') {
                        [name] = await db.query('SELECT name FROM subjects WHERE id = ?', [subjectIds[i].idSub]);
                    } else {
                        [name] = await db.query('SELECT name FROM notconfsubj WHERE id = ?', [subjectIds[i].idSub]);
                    }
                    console.log(subjectIds[i].name );
                    subjectNames[i] = {
                        name: name[0].name,
                    };
                }

                const inline_keyboard = tasks.map((btn, index) => [
                    { text: subjectNames[index + 1].name + ':\n' + btn.description, callback_data: `perform_task_${index + 1}` }
                ]);

                console.log(inline_keyboard);

                const options = {
                    reply_markup: {
                        inline_keyboard
                    }
                };

                // Пока что с такой реализацией работаем, возможно нужно будет все названия перетащить в сообщение, а в кнопках 
                // оставить лишь их номера

                bot.sendMessage(message.chat.id, 'Выберите задачу, которую хотите закончить: ', options);
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

                const [subjectsDop] = await db.query('SELECT id, name FROM notconfsubj WHERE confirmed = false AND user_id = ?', [student.id]);

                if (subjectIndex < 1 || subjectIndex > subjectsDop.length) {
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

            const [tasks] = await db.query('SELECT * FROM tasks WHERE performed = ? AND student_id = ?', [false, student.id]);

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
                /*const options = {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: 'Участник', callback_data: `role_admin_student_id_${studentID}` },
                                { text: 'Куратор', callback_data: `role_admin_groupmanager_id_${studentID}` }
                            ]
                        ]
                    }
                }*/
                bot.sendMessage(message.chat.id, 'Укажите его/её телеграмм ID');

                waitingForAnswerAdmin[message.chat.id] = {
                    act: 'write_tgid_of_user'
                };
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
                            ]
                        ]
                    }
                }

                bot.sendMessage(message.chat.id, 'Для кого вы хотите добавить задачу?', options);
            } else if (data === 'group_manager_sendnotification') {

            } else if (data === 'group_manager_editsubjects') {

            }
        } else if (data.startsWith('manager_addtask_for_')) {
            const forWho = data.split('_for_')[1];

            bot.sendMessage(message.chat.id, 'Введите описание задачи');

            waitingForAnswerAdmin[userId] = {
                act: 'add_task_for_everyone_or_myself',
                obj: forWho
            };
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
            const dateObj = new Date(deadline);
            const deadlineForDb = dateObj.toISOString().slice(0,10);

            delete waitingForAnswerAdmin[chatId];

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
            
        } /*else if (waitingForAnswerAdmin[chatId].act === 'add_task_for_everyone_or_myself_subject') {
            const forWho = waitingForAnswerAdmin[chatId].obj;
            const text = waitingForAnswerAdmin[chatId].text;

            
        }*/
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