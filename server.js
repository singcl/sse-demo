const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
// const SSEReadable = require('./utils/stream.js');
const { Readable } = require('node:stream');
const { counter } = require('./utils/tools.js');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

const PORT = 3001;

function eventsHandler(request, response) {
    const headers = {
        'Content-Type': 'text/event-stream',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache'
    };
    response.writeHead(200, headers);

    const clientId = Date.now();
    const data = `data: ${JSON.stringify(clientId)}\n\n`;

    // response.write(data);

    const sseStream = Readable.from(counter());

    sseStream.pipe(response);

    request.on('close', () => {
        console.log(`${clientId} Connection closed`);
        sseStream.destroy();
        response.end();
    });
}

app.get('/events', eventsHandler);

app.listen(PORT, () => {
    console.log(`Facts Events service listening at http://localhost:${PORT}`);
});
