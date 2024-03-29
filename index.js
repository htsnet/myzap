const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fs = require('fs');
const https = require('https');
const express = require("express");
const cors = require('cors');
const Sessions = require("./sessions");
const Utils = require("./utils");
const os = require('os'); // para saber o estado do processador linux
require('dotenv').config();

var app = express();

app.use(cors());
// app.use(timeout(120000));
// app.use(haltOnTimedout);
app.use(express.json({
    limit: '20mb',
    extended: true
}));

var appPort = process.env.PORT ? process.env.PORT : 3333;

if (process.env.HTTPS == 1) { //with ssl
    https.createServer(
        {
            key: fs.readFileSync(process.env.SSL_KEY_PATH),
            cert: fs.readFileSync(process.env.SSL_CERT_PATH)
        },
        app).listen(appPort);
    console.log(Utils.pegaDataHora() + "Https server running on port " + appPort);
} else { //http
    app.listen(appPort, () => {
        console.log(Utils.pegaDataHora() + "Http server running on port " + appPort);
    });
}//http

app.get("/", async (req, res, next) => {
    console.log(Utils.pegaDataHora() + "--> situação do server");
    // script para aguardar cpu estar baixa antes de executar
    if (await waitCpuUsageLower()) {
        var result = { "result": "ok" };
    } else {
        var result = { "error": "Ocupado. Tente novamente em instantes." };
    }
    res.json(result);
});//

app.post('/exec', async (req, res) => {
    const { stdout, stderr } = await exec(req.body.command);
    res.send(stdout);
});

app.get("/start", async (req, res, next) => {
    console.log(Utils.pegaDataHora() + "--> starting..." + req.query.sessionName);
    // script para aguardar cpu estar baixa antes de executar
    if (await waitCpuUsageLower()) {
        var session = process.env.JSONBINIO_SECRET_KEY ?
            await Sessions.start(req.query.sessionName, { jsonbinio_secret_key: process.env.JSONBINIO_SECRET_KEY, jsonbinio_bin_id: process.env.JSONBINIO_BIN_ID }) :
            await Sessions.start(req.query.sessionName);
        if (["CONNECTED", "QRCODE", "STARTING"].includes(session.state)) {
            res.status(200).json({ result: 'success', message: session.state });
        } else {
            res.status(200).json({ result: 'error', message: session.state });
        }
    } else {
        var result = { "error": "Ocupado. Tente novamente em instantes." };
        res.json(result);
    }
});//start

app.get("/status", async (req, res, next) => {
    console.log(Utils.pegaDataHora() + "--> status..." + req.query.sessionName);
    // script para aguardar cpu estar baixa antes de executar
    await waitCpuUsageLower();
    var session = await Sessions.getStatus(req.query.sessionName);
    var result = (!session.state) ? 'NOT_FOUND' : session.state;
    console.log(Utils.pegaDataHora() + "resultado: " + result);
    res.status(200).json({
        result: result
    });
}); //status

app.get("/qrcode", async (req, res, next) => {
    console.log(Utils.pegaDataHora() + "--> qrcode..." + req.query.sessionName);
    // script para aguardar cpu estar baixa antes de executar
    await waitCpuUsageLower();
    var session = Sessions.getSession(req.query.sessionName);

    if (session != false) {
        if (session.status != 'isLogged') {
            if (req.query.image) {
                session.qrcode = session.qrcode.replace('data:image/png;base64,', '');
                const imageBuffer = Buffer.from(session.qrcode, 'base64');
                res.writeHead(200, {
                    'Content-Type': 'image/png',
                    'Content-Length': imageBuffer.length
                });
                res.end(imageBuffer);
            } else {
                res.status(200).json({ result: "success", message: session.state, qrcode: session.qrcode });
            }
        } else {
            res.status(200).json({ result: "error", message: session.state });
        }
    } else {
        res.status(200).json({ result: "error", message: "NOTFOUND" });
    }
});//qrcode

app.post("/sendHook", async function sendText(req, res, next) {
    console.log(Utils.pegaDataHora() + "--> sendHook...");
    var result = await Sessions.saveHook(req);
    res.json(result);
});//sendText

app.post("/sendText", async function sendText(req, res, next) {
    console.log(Utils.pegaDataHora() + "--> sendText...");
    // script para aguardar cpu estar baixa antes de executar
    await waitCpuUsageLower();
    var result = await Sessions.sendText(req);
    res.json(result);
});//sendText

app.post("/sendTextToStorie", async (req, res, next) => {
    var result = await Sessions.sendTextToStorie(req);
    res.json(result);
}); //sendTextToStorie

app.post("/sendFile", async (req, res, next) => {
    var result = await Sessions.sendFile(
        req.body.sessionName,
        req.body.number,
        req.body.base64Data,
        req.body.fileName,
        req.body.caption
    );
    res.json(result);
});//sendFile

app.post("/sendImage", async (req, res, next) => {
    var result = await Sessions.sendImage(
        req.body.sessionName,
        req.body.number,
        req.body.base64Data,
        req.body.fileName,
        req.body.caption
    );
    res.json(result);
});//sendImage

app.post("/sendImageStorie", async (req, res, next) => {
    var result = await Sessions.sendImageStorie(
        req.body.sessionName,
        req.body.base64Data,
        req.body.fileName,
        req.body.caption
    );
    res.json(result);
}); //sendImageStorie

app.post("/sendLink", async (req, res, next) => {
    console.log(Utils.pegaDataHora() + "--> sendLink...");
    // script para aguardar cpu estar baixa antes de executar
    await waitCpuUsageLower();
    var result = await Sessions.sendLinkPreview(
        req.body.sessionName,
        req.body.number,
        req.body.url,
        req.body.caption
    );
    res.json(result);
}); //sendLinkPreview

app.post("/sendContactVcard", async (req, res, next) => {
    var result = await Sessions.sendContactVcard(
        req.body.sessionName,
        req.body.number,
        req.body.numberCard,
        req.body.nameCard
    );
    res.json(result);
}); //sendContactVcard

app.post("/sendVoice", async (req, res, next) => {
    var result = await Sessions.sendVoice(
        req.body.sessionName,
        req.body.number,
        req.body.voice
    );
    res.json(result);
}); //sendVoice

app.post("/sendLocation", async (req, res, next) => {
    var result = await Sessions.sendLocation(
        req.body.sessionName,
        req.body.number,
        req.body.lat,
        req.body.long,
        req.body.local
    );
    res.json(result);
}); //sendLocation

// 12/08/2023
app.get("/getMessages", async (req, res, next) => {
    console.log(Utils.pegaDataHora() + "--> getMessages..." + req.query.sessionName);
    var result = await Sessions.getMessages(req.body.sessionName);
    res.json(result);
}); //getMessages

// deprecate????
app.get("/getAllChatsNewMsg", async (req, res, next) => {
    var result = await Sessions.getAllChatsNewMsg(req.body.sessionName);
    res.json(result);
}); //getAllChatsNewMsg

app.get("/getAllUnreadMessages", async (req, res, next) => {
    var result = await Sessions.getAllUnreadMessages(req.body.sessionName);
    res.json(result);
}); //getAllUnreadMessages

app.get("/checkNumberStatus", async (req, res, next) => {
    console.log(Utils.pegaDataHora() + "--> checando número...");
    var result = await Sessions.checkNumberStatus(
        req.query.sessionName,
        req.query.number
    );
    res.json(result);
}); //Verifica Numero

app.get("/getNumberProfile", async (req, res, next) => {
    var result = await Sessions.getNumberProfile(
        req.body.sessionName,
        req.body.number
    );
    res.json(result);
}); //Verifica perfil

app.get("/close", async (req, res, next) => {
    if (typeof (Sessions.options) != "undefined") {
        if (Sessions.options.jsonbinio_secret_key !== undefined) {//se informou secret key pra salvar na nuvem
            console.log(Utils.pegaDataHora() + "--> limpando token na nuvem...");
            //salva dados do token da sessão na nuvem
            var data = JSON.stringify({ "nada": "nada" });
            var config = {
                method: 'put',
                url: 'https://api.jsonbin.io/b/' + Sessions.options.jsonbinio_bin_id,
                headers: {
                    'Content-Type': 'application/json',
                    'secret-key': Sessions.options.jsonbinio_secret_key,
                    'versioning': 'false'
                },
                data: data
            };
            await axios(config)
                .then(function (response) {
                    console.log(Utils.pegaDataHora() + JSON.stringify(response.data));
                })
                .catch(function (error) {
                    console.log(Utils.pegaDataHora() + error);
                });
        }
    }
    var result = await Sessions.closeSession(req.query.sessionName);
    res.json(result);
});//close

process.stdin.resume();//so the program will not close instantly

async function exitHandler(options, exitCode) {
    if (options.cleanup) {
        console.log(Utils.pegaDataHora() + 'cleanup');
        await Sessions.getSessions().forEach(async session => {
            await Sessions.closeSession(session.sessionName);
        });
    }
    if (exitCode || exitCode === 0) {
        console.log(Utils.pegaDataHora() + exitCode);
    }

    if (options.exit) {
        process.exit();
    }
} //exitHandler 
//do something when app is closing
process.on('exit', exitHandler.bind(null, { cleanup: true }));
//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, { exit: true }));
// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));
//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));

// função para avaliar o consumo de cpu antes de executar alguma ação
async function checkCpuUsage() {
    const cpus = os.cpus();
    let totalTime = 0;
    let totalCpuTime = 0;
    // faz uma amostra de 10 vezes e calcula o total de uso de cpu
    const qtdeAmostras = 10;
    for (let i = 0; i < qtdeAmostras; i++) {
        // pega a cada iteração os dados da cpu
        const cpus = os.cpus();
        cpus.forEach(cpu => {
            // console.log(cpu.times);
            totalTime += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
            totalCpuTime += cpu.times.user + cpu.times.nice + cpu.times.sys; // Excluindo o tempo ocioso (idle)
        });
        await new Promise(r => setTimeout(r, 100)); // amostra a cada 100ms
    }
    const cpuUsagePercent = ((totalCpuTime/ qtdeAmostras) / (totalTime/ qtdeAmostras)) * 100  // divide pela quantidade de amostragens;
    console.log(Utils.pegaDataHora() + " Total CPU Usage: " + cpuUsagePercent.toFixed(2) + "%");
    //TODO não está funcionando corretamente, a resposta é praticamente sempre igual, sem refletir o uso de cpu real
    return cpuUsagePercent < 90; // retorna true se uso < 90%
}


// função para obter o uso de cpu atual e esperar ou executar uma ação
function waitCpuUsageLower() {
    const esperarQuantasVezes = 5;
    let quantasVezes = 0;

    return new Promise((resolve, reject) => {
        quantasVezes += 1;
        const check = () => {
            const usage = checkCpuUsage(); //obtém uso atual
            if (usage) {
                resolve(true);
            } else {
                console.log('CPU ocupada... aguardando...');
                if (quantasVezes >= esperarQuantasVezes) {
                    resolve(false);
                } else {
                    setTimeout(check, 5000); // tenta novamente em 5 segundos
                }
            }
        };
        check();
    });
}