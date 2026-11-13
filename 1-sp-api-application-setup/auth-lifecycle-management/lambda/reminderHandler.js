const ReminderManager = require('./reminderManager');

exports.handler = async (event, context) => {
    const reminderManager = new ReminderManager(process.env.PARTNERS_TABLE);
    
    try {
        const results = await reminderManager.processReminders();
        return {
            statusCode: 200,
            body: JSON.stringify(results)
        };
    } catch (error) {
        console.error('Error in reminder handler:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Failed to process reminders',
                message: error.message
            })
        };
    }
};
