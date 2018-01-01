# mapa-signala
Node.js paket za upravljanje podacima iz Android aplikacije Mapa Signala pravljenu za [mt:s app konkurs](http://appkonkurs.mts.rs)
<!-- https://appkonkurs.mts.rs je zanimljiv sajt inače -->

## Korišćenje
- Pokrenite `install.sh` da biste instalirali potrebne pakete.
- Kopirajte `config.sample.json` u `config.json` i izmenite ga da biste konfigurisali server.
    - `port`: Port na kojem će se pokrenuti web server
    - `host`: Host baze podataka
    - `username`: Korisničko ime za bazu podataka
    - `password`: Lozinka za bazu podataka
    - `limit`: Ograničenje veza sa bazom podataka
- Pokrenite `start.sh` da biste pokrenuli server.