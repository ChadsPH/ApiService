const express = require('express');
const cors = require('cors');
const genre = require('./routes/genre.js');
const info = require('./routes/info.js');
const app = require('./routes/app.js');
const search = require('./routes/search.js');
const random = require('./routes/random.js');
const mix = require('./routes/mix.js');
const episode = require('./routes/episode.js');
const shedule = require('./routes/shedule.js');
const server = require('./routes/server.js');
const src = require('./routes/src1.js');

const inde = express();
const port = process.env.PORT || 3005;

// ✅ CORS once, globally — not per router
inde.use(cors());

// ✅ Request timeout — stops hanging requests from killing the server
inde.use((req, res, next) => {
    res.setTimeout(20000, () => {
        res.status(408).json({ error: 'Request timed out' });
    });
    next();
});

// ✅ Keep connections alive (reduces TCP overhead per request)
inde.use((req, res, next) => {
    res.setHeader('Connection', 'keep-alive');
    next();
});

inde.use('/api', genre);
inde.use('/api', info);
inde.use('/api', app);
inde.use('/api', search);
inde.use('/api', random);
inde.use('/api', mix);
inde.use('/api', episode);
inde.use('/api', shedule);
inde.use('/api', server);
inde.use('/api', src);

inde.get('/', (req, res) => {
    res.send('Api Is ON SERVICE !');
});

// ✅ Global error handler
inde.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
});

inde.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
