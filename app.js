import express from "express";

const app = express();

const regexpParser = /^(?<separator>.)(?<body>.*)\1(?<flags>\w*)$/;

app.all('/', async (req, res) => {
    try {
        let response = await fetch(req.query.url, {
            method: req.method,
            ...req.query,
            headers: req.headers
        });
        let text = await response.text();
        req.fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
        if (req.query.replacements) {
            let replacements = JSON.parse(req.query.replacements);
            for (let find in replacements) {
                let replace = replacements[find];
                if (req.query.regex === "true") {
                    let match = find.match(regexpParser);
                    find = new RegExp(match.groups.body, match.groups.flags);
                }
                text = text.replace(find, replace
                    .replace(/(?<=(?<!\$)(?:\$\$)*)\$<(\w+)>/g, (match, $1) => {
                        return String(req[$1])
                            .replaceAll("$", "$$$$")
                    }));
            }
        }
        res.status(response.status);
        response.headers.forEach((value, key) => {
            try {
                res.set(key, value);
            } catch (e) {
                console.error(e);
            }
        });
        if (req.query.headers) {
            for (let [key, value] of Object.entries(JSON.parse(req.query.headers))) {
                try {
                    res.set(key, String(value));
                } catch (e) {
                    console.error(e);
                }
            }
        }
        res.send(text);
    } catch (e) {
        console.error(e);
        res.status(500);
        if (e instanceof Error) {
            res.send(e.stack);
        } else {
            res.send(e?.message || e?.name || e);
        }
    }
});

// Start the server
const PORT = parseInt(process.env.PORT) || 8080;
app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`);
    console.log('Press Ctrl+C to quit.');
});
