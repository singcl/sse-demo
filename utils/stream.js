const stream = require('stream');
const fetch = require('node-fetch');

/**
 *  // 判断是否为纯对象
 * @param v
 * @returns
 */
function isPureObject(v) {
    // 判断是否为纯对象
    return (
        typeof v === 'object' &&
        Object.prototype.toString.call(v) === '[object Object]'
    );
}

/**
 *
 * @param data
 * @param delList
 * @returns
 */
function secureResData(data, delList) {
    if (!data) return data;
    if (!delList || delList.length <= 0) return data;
    const newData = { ...data };
    delList.forEach((item) => {
        delete newData[item];
    });
    return newData;
}

/**
 *
 * @param res
 * @param delList
 * @returns
 */
function serverRes(res, delList) {
    if (!res)
        return {
            code: 101001,
            message: 'failed',
            data: null
        };
    if (!isPureObject(res)) {
        return {
            code: 0,
            message: 'SUCCESS'
        };
    }
    const { code, message, data, errMsg, status } = res;
    if (
        ['string', 'number'].includes(typeof code) &&
        typeof message === 'string'
    ) {
        return {
            code,
            message,
            data: secureResData(data, delList)
        };
    }

    if (status === 'SUCCESS') {
        return {
            code: 0,
            message: 'SUCCESS',
            data: secureResData(res, delList)
        };
    }
    if (errMsg) {
        return {
            code: 101001,
            message: errMsg,
            data: secureResData(res, delList)
        };
    }
    return res;
}

/**
 *
 * @param obj
 * @returns
 */
function encodeImgUrls(obj) {
    const { data: { imgUrls = '[]' } = {} } = obj;
    const imgUrlsParsed = JSON.parse(imgUrls);
    const encodeImgUrls = imgUrlsParsed.map((item) =>
        Buffer.from(item).toString('base64')
    );
    return { ...obj, data: { ...obj.data, imgUrls: encodeImgUrls } };
}

module.exports = class SSEReadable extends stream.Readable {
    #event = 'message';
    #data = 'message';
    #fetchParams = {
        url: '',
        method: 'GET',
        data: ''
    };

    #error = false;
    #stop = false;
    #startTime = 0;
    #holderTime = 4000;
    #timer;

    constructor(options) {
        super();
        this.#event = options?.event ?? 'message';
        this.#data = options?.data ?? 'message';
        this.#fetchParams = options?.fetchParams ?? this.#fetchParams;
    }

    // 子类需要实现该方法
    // 这是生产数据的逻辑, // 数据源已枯竭，调用`push(null)`通知流
    _read() {
        console.log('----this.#error', this.#error);
        //
        if (this.#error || this.#stop) {
            clearTimeout(this.#timer);
            this.push(null);
            return;
        }
        //
        if (this.#event === 'stop') {
            this.push(`event: stop\ndata: ${this.#data}\n\n`);
            this.#stop = true;
            return;
        }

        if (this.#fetchParams) {
            // TODO: 现在只处理了POST
            const { url, method, data } = this.#fetchParams;
            this.#startTime = Date.now();
            fetch(url, {
                method,
                body: data,
                headers: {
                    'Content-Type': 'application/json'
                }
            })
                .then((response) => {
                    response.json().then((res) => {
                        console.log('---res', new Date().toLocaleString(), res);
                        // 通过`push`方法将数据添加到流中
                        let message = `event: message\ndata: message\n\n`;
                        if (Number(res.code) !== 0 || !res.data) {
                            this.push(
                                `event: stop\ndata: ${JSON.stringify(
                                    serverRes(res, ['userId', 'departmentId'])
                                )}\n\n`
                            );
                            this.#error = true;
                            return;
                        }

                        const { resCallback, trainCallback } = res.data;
                        if (resCallback && Number(resCallback.code) !== 0) {
                            this.push(
                                `event: stop\ndata: ${JSON.stringify(
                                    serverRes(resCallback, [
                                        'userId',
                                        'departmentId'
                                    ])
                                )}\n\n`
                            );
                            this.#error = true;
                            return;
                        }

                        if (
                            resCallback &&
                            resCallback.data &&
                            (!trainCallback ||
                                (isPureObject(trainCallback) &&
                                    Object.keys(trainCallback).length === 0))
                        ) {
                            message = `event: message\ndata: ${JSON.stringify(
                                serverRes(resCallback, [
                                    'userId',
                                    'departmentId'
                                ])
                            )}\n\n`;
                        } else if (
                            trainCallback &&
                            String(trainCallback.status).toUpperCase() !==
                                'SUCCESS'
                        ) {
                            this.push(
                                `event: stop\ndata: ${JSON.stringify(
                                    serverRes(trainCallback, [
                                        'userId',
                                        'departmentId'
                                    ])
                                )}\n\n`
                            );
                            this.#error = true;
                            return;
                        } else {
                            message = `event: complete\ndata: ${JSON.stringify(
                                encodeImgUrls(
                                    serverRes(trainCallback, [
                                        'userId',
                                        'departmentId'
                                    ])
                                )
                            )}\n\n`;
                            this.#stop = true;
                        }

                        const timeGap = Date.now() - this.#startTime;
                        if (timeGap > this.#holderTime) {
                            this.push(message);
                            this.#startTime = Date.now();
                        } else {
                            this.#timer = setTimeout(() => {
                                this.push(message);
                                this.#startTime = Date.now();
                            }, this.#holderTime - timeGap);
                        }
                    });
                })
                .catch((e) => {
                    this.push(`event: stop\ndata: ${JSON.stringify(e)}\n\n`);
                    this.#error = true;
                });
        }
    }

    _destroy(err, callback) {
        console.log('destroy');
        clearTimeout(this.#timer);
        callback(err);
        this.#error = true;
    }
};
