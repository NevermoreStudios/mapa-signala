'use strict';
const {exec} = require('child_process');
setInterval(function() {
    exec('mono MapaSignala.exe', function(error, stdout, stderr) {
        if (error) {
            console.log(`Error: ${error}`.trim());
        }
        if (stderr) {
            console.log(`Stderr: ${stderr}`.trim());
        }
        if (stdout) {
            console.log(`Stdout: ${stdout}`.trim());
        }
    });
}, 60 * 60 * 1000);