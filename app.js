const Influx = require('influx');
const moment = require('moment');

// InfluxDB configuration
const influxConfig = {
    host: '192.168.160.55',
    port: 8086,
    database: 'carbonoz',
    username: 'admin',
    password: 'adminadmin',
};
const influx = new Influx.InfluxDB(influxConfig);

// Topics and their specific values
const topicValues = {
    'solar_assistant_DEYE/total/load_power/state': 3000,
    'solar_assistant_DEYE/total/pv_power/state': 5000,
    'solar_assistant_DEYE/total/battery_state_of_charge/state': 75,
    'solar_assistant_DEYE/total/grid_power/state': 2000,
    'solar_assistant_DEYE/total/grid_voltage/state': 212,
    'solar_assistant_DEYE/total/load_energy/state': 20.0,
    'solar_assistant_DEYE/total/pv_energy/state': 22.0,
    'solar_assistant_DEYE/total/battery_energy_in/state': 10.1,
    'solar_assistant_DEYE/total/battery_energy_out/state': 9.4 ,
    'solar_assistant_DEYE/total/grid_energy_in/state': 0.7,
    'solar_assistant_DEYE/total/grid_energy_out/state': 0.6,
    'solar_assistant_DEYE/total/battery_power/state':766,
};

function generateValue(topic) {
    return topicValues[topic];
}

function saveToInfluxDB(topic, value, timestamp) {
    const dataPoint = {
        measurement: 'state',
        tags: { topic: topic },
        fields: { value: value },
        timestamp: timestamp
    };

    return influx.writePoints([dataPoint])
        .then(() => {
            console.log(`Successfully wrote data point for ${topic} at ${moment(timestamp/1000000).format('YYYY-MM-DD HH:mm:ss')}`);
        })
        .catch(err => {
            console.error(`Error saving to InfluxDB! ${err.stack}`);
        });
}

async function generateAndSaveDataForDate(targetDate) {
    const startOfDay = moment(targetDate).startOf('day');
    const endOfDay = moment(targetDate).endOf('day');

    let totalPointsGenerated = 0;
    let successfulWrites = 0;
    let failedWrites = 0;

    console.log(`Starting data generation for ${startOfDay.format('YYYY-MM-DD')}`);

    for (let time = moment(startOfDay); time <= endOfDay; time.add(1, 'minute')) {
        const timestamp = time.valueOf() * 1000000; // nanosecond precision

        const promises = Object.keys(topicValues).map(topic => {
            const value = generateValue(topic);
            totalPointsGenerated++;
            return saveToInfluxDB(topic, value, timestamp)
                .then(() => successfulWrites++)
                .catch(() => failedWrites++);
        });

        await Promise.all(promises);

        if (time.minute() === 0) {
            console.log(`Progress: Generating data for ${time.format('YYYY-MM-DD HH:mm:ss')}`);
            console.log(`Total points generated so far: ${totalPointsGenerated}`);
            console.log(`Successful writes: ${successfulWrites}, Failed writes: ${failedWrites}`);
        }
    }

    console.log(`Data generation completed for ${startOfDay.format('YYYY-MM-DD')}`);
    console.log(`Total data points generated: ${totalPointsGenerated}`);
    console.log(`Total successful writes: ${successfulWrites}`);
    console.log(`Total failed writes: ${failedWrites}`);
}

// Parse command line arguments
const args = process.argv.slice(2);
let targetDate;

if (args[0] === 'today') {
    targetDate = moment();
} else if (args[0]) {
    targetDate = moment(args[0], 'YYYY-MM-DD');
    if (!targetDate.isValid()) {
        console.error('Invalid date format. Please use YYYY-MM-DD');
        process.exit(1);
    }
} else {
    console.error('Please specify a date (YYYY-MM-DD) or "today" as an argument');
    process.exit(1);
}

console.log(`Data generation script started for ${targetDate.format('YYYY-MM-DD')}. This may take a while...`);
generateAndSaveDataForDate(targetDate).then(() => {
    console.log('Script execution completed.');
}).catch(err => {
    console.error('An error occurred during script execution:', err);
});
