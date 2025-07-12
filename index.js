const TelegramBot = require('node-telegram-bot-api');

const token = require('./data.js');

const bot = new TelegramBot(token, { polling: true });

bot.setMyCommands([
    {command: '/start', description: 'Начало'},
    {command: '/help', description: 'Помощь'}
]);

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

const array = ['ИСТб-23-2', 'ИСТб-23-1', 'ИСТб-23-3', 'ЭВМб-23-1'];
const quantityOfGroups = array.length - 1;
//let currentK = 0;

const usersData = {};

function setUserPage(userId, page) {
  if (!usersData[userId]) {
    usersData[userId] = {};
  }
  usersData[userId].page = page;
}

function getUserPage(userId) {
  return usersData[userId]?.page ?? -1; 
}

bot.on('callback_query', (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;

  const userId = message.chat.id;

  try {
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
        ` + array[getUserPage(userId)], {
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
        ` + array[getUserPage(userId)], {
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
    }
  }
  catch(e) {
    console.log(e);
  }
  
  bot.answerCallbackQuery(callbackQuery.id);
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const helpText = `Доступные команды:
/help — список команд и их описание`;
    bot.sendMessage(chatId, helpText);
});