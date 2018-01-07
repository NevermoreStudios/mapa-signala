/**
 * main.js
 * 
 * Application main script
 */
'use strict';

/**
 * Importing packages
 */
const app = require('express')(),
      parser = require('body-parser'),
      mysql = require('mysql'),
      fs = require('fs'),
      https = require('https'),
      info = require('./package.json'),
      config = require('./config.json');

/**
 * Constants
 */
const pool = mysql.createPool({
    connectionLimit: config.limit,
    host: config.host,
    user: config.username,
    password: config.password,
    database: config.database,
    debug: false
}), DISTANCE_LAT = 0.000090909,
DISTANCE_LONG = 0.000125;

app.use(parser.json());
app.use(parser.urlencoded({
    extended: true
}));

try {
    https.createServer({
        key: fs.readFileSync('keys/key.pem'),
        cert: fs.readFileSync('keys/cert.pem')
    }, app).listen(config.port);
} catch(e) {
    console.log('Failed to run HTTPS server!');
    process.exit();
}

/**
 * GET version
 */
app.get('/', function(request, response) {
    response.json({
        version: info.version,
        motd: 'Јуче је данас било сутра.'
    });
});

function error(response, error, reason, status) {
    try {
        response.status(status || 400).json({ error, reason });
    } catch(e) {
        console.log('Guess I\'ll die');
        console.log(e.stack);
    }
}

function dbError(response) {
    error(response, 'database', 'Cannot connect to database', 500);
}

function executeDB(response, query, callback) {
    if (typeof callback === 'function') {
        pool.getConnection(function(err, connection) {
            if (err) {
                dbError(response);
            } else {
                connection.on('error', function() {
                    dbError(response);
                });
                connection.query(query, function(err1, result) {
                    if (err1) {
                        dbError(response);
                    } else {
                        callback(result);
                    }
                });
            }
        });
    }
}

function average(arr) {
    let sum = 0;
    arr.forEach(s => sum += s);
    return sum / arr.length;
}

function getProvider(provider) {
    if (provider === 'all') {
        return -1;
    } else {
        provider = Math.round(Number(provider));
        if (isNaN(provider) || provider < 22001 || provider > 22005) {
            return 0;
        } else {
            return provider - 22000;
        }
    }
}

/**
 * GET network information
 */
app.get('/get/:latitude/:longitude/:provider', function(request, response) {
    const params = request.params,
          latitude = Number(params.latitude),
          longitude = Number(params.longitude),
          provider = getProvider(params.provider);
    if (
        isNaN(latitude) || isNaN(longitude) || !provider ||
        latitude < 0 && longitude < 0
    ) {
        error(
            response,
            'parameters',
            '`latitude` and `longitude` parameters must be supplied!'
        );
    } else {
        let query = 'SELECT * FROM `data` WHERE `latitude` BETWEEN ' +
                    (latitude - DISTANCE_LAT) + ' AND ' +
                    (latitude + DISTANCE_LAT) + ' AND `longitude` BETWEEN ' +
                    (longitude - DISTANCE_LONG) + ' AND ' +
                    (longitude + DISTANCE_LONG);
        if (provider !== -1) {
            query += ' AND `provider`=' + provider;
        }
        executeDB(response, query, function(result) {
            const res = [];
            result.forEach(function(el) {
                const type = el.type - 1,
                      prov = el.provider - 1;
                if (provider === -1) {
                    if (!res[prov]) {
                        res[prov] = [];
                    }
                    if (!res[prov][type]) {
                        res[prov][type] = [];
                    }
                } else if (prov + 1 === provider) {
                    if (!res[type]) {
                        res[type] = [];
                    }
                } else {
                    return;
                }
                const diffLat = latitude - el.latitude,
                      diffLong = longitude - el.longitude;
                // Reduce square to circle
                if (
                    diffLat * diffLat +
                    diffLong * diffLong <
                    DISTANCE_LAT * DISTANCE_LONG
                ) {
                    if (provider === -1) {
                        res[prov][type].push(el.dbm);
                    } else {
                        res[type].push(el.dbm);
                    }
                }
            });
            response.json(res.map(function(el) {
                if (el) {
                    if (provider === -1) {
                        return el.map(e2 => average(e2));
                    } else {
                        return average(el);
                    }
                }
                return -1;
            }));
        });
    }
});

/**
 * GET tile image
 */
app.get('/tile/:zoom/:x/:y/:gen/:provider', function(request, response) {
    const params = request.params,
          zoom = Math.round(Number(params.zoom)),
          x = Math.round(Number(params.x)),
          y = Math.round(Number(params.y)),
          gen = Math.round(Number(params.gen)),
          provider = getProvider(params.provider);
    if (
        isNaN(zoom) || isNaN(x) || isNaN(y) ||
        !provider || isNaN(gen) ||
        zoom > 19 || zoom < 0 ||
        x > 65536 || x < 0 ||
        y > 65536 || y < 0
    ) {
        error(
            response,
            'parameters',
            '`zoom`, `x` and `y` parameters must be supplied and valid!'
        );
    } else {
        response.sendFile(`${zoom}-${x}-${y}-${gen}-${provider}.png`, {
            root: __dirname + '/tiles/'
        }, function(err) {
            if (err) {
                error(
                    response,
                    'parameters',
                    'Unknown filename'
                );
            }
        });
    }
});

/**
 * POST network data
 */
app.post('/post', function(request, response) {
    const body = request.body;
    if (body instanceof Array) {
        const arr = [];
        body.forEach(function(el) {
            if (typeof el === 'object') {
                const latitude = Number(el.latitude),
                      longitude = Number(el.longitude),
                      dbm = Math.round(Number(el.dbm)),
                      type = Math.round(Number(el.type)),
                      provider = getProvider(el.provider);
                if (
                    !isNaN(latitude) && !isNaN(longitude) && !isNaN(dbm) &&
                    !isNaN(type) && provider > 0 && type >= 0 && type < 4 &&
                    latitude >= 0 && longitude >= 0
                ) {
                    arr.push(`(${[
                        latitude, longitude, dbm, type, provider
                    ].join(',')})`);
                }
            }
        });
        if (arr.length === 0) {
            error(
                response,
                'parameters',
                'All objects in supplied array are invalid'
            );
        } else {
            executeDB(
                response,
                'INSERT INTO `data` ' +
                '(`latitude`, `longitude`, `dbm`, `type`, `provider`) VALUES ' +
                arr.join(','),
                function() {
                    response.json({ success: true });
                }
            );
            
        }
    } else {
        error(
            response,
            'parameters',
            'Required parameters have not been supplied'
        );
    }
});
