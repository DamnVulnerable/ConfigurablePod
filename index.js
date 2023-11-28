const { MyOperator } = require('./operator');

async function main() {

    const operator = new MyOperator();
    await operator.start();

    const exit = (reason) => {
        operator.stop();
        process.exit(0);
    };

    process.on('SIGTERM', () => exit('SIGTERM'))
        .on('SIGINT', () => exit('SIGINT'));
}

main();
