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
});

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
    response.status(status || 400).json({ error, reason });
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
                        callback.call(result);
                    }
                });
            }
        });
    }
}

/**
 * GET network information
 */
app.get('/get/:latitude/:longitude', function(request, response) {
    const params = request.params,
          latitude = Number(params.latitude),
          longitude = Number(params.longitude);
    if (latitude && longitude) {
        // SELECT FROM `mapa_signala` WHERE
        executeDB(response, '', function(result) {
            response.json({ latitude, longitude });
        });
    } else {
        error(
            response,
            'parameters',
            '`latitude` and `longitude` parameters must be supplied!'
        );
    }
});

/**
 * GET tile image
 */
app.get('/tile/:zoom/:x/:y', function(request, response) {
    const params = request.params,
          zoom = Math.round(Number(params.zoom)),
          x = Math.round(Number(params.x)),
          y = Math.round(Number(params.y));
    if (
        isNaN(zoom) || isNaN(x) || isNaN(y) ||
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
        response.sendFile(`${zoom}-${x}-${y}.png`, {
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
                      provider = Math.round(Number(el.type));
                if (
                    latitude && longitude && dbm && type && provider &&
                    type > 0 && type < 4
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