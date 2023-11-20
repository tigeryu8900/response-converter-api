import express from "express";

const app = express();

const regexpParser = /^(?<separator>.)(?<body>.*)\1(?<flags>\w*)$/;

app.get('/', async ({query}, res) => {
    let response = await fetch(query.url, {
        ...query,
        headers: query.headers ? JSON.parse(query.headers) : undefined
    });
    let text = await response.text();
    if (query.replacements) {
        let replacements = JSON.parse(query.replacements);
        for (let find in replacements) {
            let replace = replacements[find];
            if (query.regexp === "true") {
                let match = find.match(regexpParser);
                find = new RegExp(match.groups.body, match.groups.flags);
            }
            text = text.replace(find, replace);
        }
    }
    res.status(response.status);
    response.headers.forEach((key, value) => {
        try {
            res.set(key, value);
        } catch (e) {
            console.error(e);
        }
    });
    res.send(text);
});

// Start the server
const PORT = parseInt(process.env.PORT) || 8080;
app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`);
    console.log('Press Ctrl+C to quit.');
});
