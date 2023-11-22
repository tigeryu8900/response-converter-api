import express from "express";

const app = express();
app.use (function(req, res, next) {
    let data= "";
    req.setEncoding("utf8");
    req.on("data", function(chunk) {
        data += chunk;
    });

    req.on('end', function() {
        req.body = data ? data : null;
        next();
    });
});

const regexpParser = /^(?<separator>.)(?<body>.*)\1(?<flags>\w*)$/;

//'/:options/:url([\\w\\W]*)'
app.all("*", async (req, res) => {
    try {
        let match = req.path.match(/^\/(?<options>[^\/]+)?\/(?<url>.*)$/)?.groups;
        let { options, url } = await new Promise((resolve, reject) => {
            if (match) {
                try {
                    let options = JSON.parse(decodeURIComponent(match.options ?? "{}"));
                    let url = new URL(match.url);
                    if (!/[.:]/.test(url.host)) {
                        let referer = req.headers.referer ?? req.headers.origin;
                        if (referer) {
                            referer = new URL(referer);
                            if (["localhost:8080", "response-converter-api.onrender.com"].includes(referer.host)) {
                                referer = new URL(referer.pathname.replace(/^\/.*?\//, ""));
                            }
                        }
                        url = new URL(url.host + url.pathname, referer);
                    }
                    for (let [key, value] of Object.entries(req.query)) {
                        url.searchParams.set(key, value);
                    }
                    resolve({ options, url });
                } catch (e) {
                    reject();
                }
            } else {
                reject();
            }
        }).catch(() => {
            let referer = req.headers.referer ?? req.headers.origin;
            if (referer) {
                referer = new URL(referer);
                if (["localhost:8080", "response-converter-api.onrender.com"].includes(referer.host)) {
                    referer = new URL(referer.pathname.replace(/^\/.*?\//, ""));
                }
            }
            let url = new URL(req.path, referer);
            return { options: {}, url };
        });
        let response = await fetch(url, {
            method: options.method ?? req.method,
            headers: {
                ...req.headers,
                ...options["request-headers"] ?? {}
            },
            credentials: options.credentials ?? req.credentials,
            body: options.body ?? req.body,
            cache: options.cache ?? req.cache,
            redirect: options.redirect ?? req.redirect,
            referrer: options.referrer ?? req.referrer,
            referrerPolicy: options.referrerPolicy ?? req.referrerPolicy,
            integrity: options.integrity ?? req.integrity,
        });
        req.fullUrl = `${options.protocol ?? req.protocol}://${req.get("host")}${req.originalUrl}`;
        let data;
        if (options.replacements &&
            ["text", "application"].includes(response.headers.get("content-type")?.split("/")[0] ?? "text")) {
            data = await response.text();
            for (let [find, replace] of Object.entries(options.replacements)) {
                if (options.regex && !(find instanceof RegExp)) {
                    let match = find.match(regexpParser);
                    find = new RegExp(match.groups.body, match.groups.flags);
                }
                data = data.replace(find, replace
                    .replace(/(?<=(?<!\$)(?:\$\$)*)\$<(\w+)>/g, (match, $1) => {
                        return String(req[$1])
                            .replaceAll("$", "$$$$")
                    }));
            }
        } else {
            data = await response.arrayBuffer();
        }
        res.status(response.status);
        response.headers.forEach((value, key) => {
            try {
                if (![
                    "content-encoding"
                ].includes(key.toLowerCase())) {
                    res.set(key, value);
                }
            } catch (e) {
                console.error(e);
            }
        });
        if (options["response-headers"]) {
            for (let [key, value] of Object.entries(options["response-headers"])) {
                try {
                    res.set(key, String(value));
                } catch (e) {
                    console.error(e);
                }
            }
        }
        res.send(Buffer.from(data));
    } catch (e) {
        console.error(req.path, e);
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
