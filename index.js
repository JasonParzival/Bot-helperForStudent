const TelegramBot = require('node-telegram-bot-api');

const token = require('./data.js');

const bot = new TelegramBot(token, { polling: true });

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
let currentK = 0;

bot.on('callback_query', (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;

  try {
    if (data === 'start_group_prev') {
        if (currentK == 0) {
            currentK = quantityOfGroups;
        }
        else {
            currentK--;
        }

        bot.editMessageText(`Какая вам группа нужна?
    Выберите из ниже предложенных:
        ` + array[currentK], {
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
        if (currentK == quantityOfGroups) {
            currentK = 0;
        }
        else {
            currentK++;
        }

        bot.editMessageText(`Какая вам группа нужна?
    Выберите из ниже предложенных:
        ` + array[currentK], {
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