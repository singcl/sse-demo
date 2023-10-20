const { Readable } = require('node:stream');
exports.counter = async function* counter(num = 10000) {
    for (let i = 0; i < num; i++) {
        await sleep(1000);
        yield `event: message\ndata: ${i}\n\id: ${i}\n\n`;
    }
    return 'success';
};

function sleep(time = 1000) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

exports.SSECaseReadable = class SSECaseReadable extends Readable {
    // constructor(iterator) {
    //   super()
    //   this.iterator = iterator
    // }

    // 子类需要实现该方法
    // 这是生产数据的逻辑
    _count = 0;
    _read() {
        // const res = this.iterator.next()
        if (this._count >= 10) {
            // 数据源已枯竭，调用`push(null)`通知流
            this.push(`event: complete\ndata: complete\n\n`);
            return this.push(null);
        }
        setTimeout(() => {
            // 通过`push`方法将数据添加到流中
            const message = `event: message\ndata: 服务器时间: ${new Date().toLocaleString()}\n\n`;
            this.push(message);
            this._count++;
        }, 1000);
    }
};
