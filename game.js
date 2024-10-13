let requests = {};
let statistics = [];

function generateUUIDv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0; // Zufällige Zahl zwischen 0 und 15
        const v = c === 'x' ? r : (r & 0x3 | 0x8); // Wenn 'x', dann r; wenn 'y', dann (r & 0x3 | 0x8)
        return v.toString(16); // In Hexadezimal umwandeln
    });
}


const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,

    parent: 'game-container',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: {y: 300},
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};


let GAME_READY = 0x01;
let GAME_RUNNING = 0x02;
let GAME_OVER = 0x03;



let GameData = {};

GameData.state = 0;
GameData.score = 0;
GameData.round = 0;
GameData.alive = true;
GameData.player_id = "";
GameData.movement = {};
GameData.movement.x = 0.0;
GameData.movement.y = 0.0;
GameData.movement.facing = "";

GameData.stars = {};
GameData.bombs = {};
GameData.players = {};

GameData.player = null;
GameData.score_text = null;
GameData.current_scene = null;

GameData.stars_group = {};
GameData.bombs_group = {};
GameData.cursors = {};
GameData.platforms = {};



let game = new Phaser.Game(config);

function preload() {
    this.load.image('sky', 'assets/sky.png');
    this.load.image('ground', 'assets/platform.png');
    this.load.image('star', 'assets/star.png');
    this.load.image('bomb', 'assets/bomb.png');
    this.load.spritesheet('dude', 'assets/dude.png', { frameWidth: 32, frameHeight: 48 });
}

function create() {
    GameData.current_scene = this;
    this.add.image(400, 300, 'sky');
    GameData.platforms = this.physics.add.staticGroup();
    GameData.platforms.create(400, 568, 'ground').setScale(2).refreshBody();
    GameData.platforms.create(600, 400, 'ground');
    GameData.platforms.create(50, 250, 'ground');
    GameData.platforms.create(750, 220, 'ground');

    GameData.player = this.physics.add.sprite(100, 450, 'dude');
    GameData.player.setBounce(0.2);
    GameData.player.setCollideWorldBounds(true);

    this.anims.create({
        key: 'left',
        frames: this.anims.generateFrameNumbers('dude', { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1
    });

    this.anims.create({
        key: 'turn',
        frames: [{ key: 'dude', frame: 4 }],
        frameRate: 20
    });

    this.anims.create({
        key: 'right',
        frames: this.anims.generateFrameNumbers('dude', { start: 5, end: 8 }),
        frameRate: 10,
        repeat: -1
    });

    GameData.cursors = this.input.keyboard.createCursorKeys();

    GameData.stars_group = this.physics.add.group();
    GameData.bombs_group = this.physics.add.group();

    this.physics.add.collider(GameData.player, GameData.platforms);
    this.physics.add.collider(GameData.stars_group, GameData.platforms);
    this.physics.add.collider(GameData.bombs_group, GameData.platforms);
    this.physics.add.overlap(GameData.player, GameData.stars_group, collectStar, null, this);
    this.physics.add.collider(GameData.player, GameData.bombs_group, hitBomb, null, this);

    GameData.score_text = this.add.text(16, 16, 'Score: 0', { fontSize: '32px', fill: '#000' });
    GameData.round_text = this.add.text(16, 48, 'Round: 0', { fontSize: '32px', fill: '#000' });

    GameData.players = this.physics.add.group();
}

function game_init(data){
    GameData.player_id = data.player_id;
    GameData.state = data.game_state;
    GameData.round = 0;
    GameData.score = 0;
    //GameData.players = data.players;

    $.each(data.players, function(id, player) {
        //console.debug('Spawning player:', player);
        if (id !== GameData.player_id){
            game_spawn_other_player(player.id, GameData.movement.x, GameData.movement.y);
        }
    });

    setInterval(function () {
        GameData.movement.player_id = GameData.player_id;
        send_message('movement', GameData.movement)
    }, 33);
}

function game_star_collected(data){
    let star = game_get_star(data.payload.star_id);
    if (star) {
        star.disableBody(true, true);
        star.collected = true;
    }
}

function game_all_stars_collected(){
    let ret = true;
    $.each(GameData.stars, function(id, star) {
        if(!star.collected) ret = false;
    });
    return ret;
}

function game_spawn_stars(stars){
    GameData.stars = {};
    $.each(stars, function(id, star) {
        //console.debug('Spawning star:', star);
        let newStar = GameData.stars_group.create(star.x, star.y, 'star');
        newStar.setBounceY(Phaser.Math.FloatBetween(0.4, 0.8));
        newStar.star_id = star.id;
        newStar.collected = false;
        GameData.stars[star.id] = newStar;
    });
}

function game_get_star(id){
    return GameData.stars[id];
}

function game_get_bomb(id){
    let bomb = GameData.bombs[id];
    //console.log(bomb)
    return bomb
}

function game_spawn_bomb(bomb){
    let new_bomb = GameData.bombs_group.create(bomb.x, bomb.y, 'bomb', bomb.vx);
    new_bomb.setBounce(1);
    new_bomb.setCollideWorldBounds(true);
    new_bomb.setVelocity(bomb.vx, 20);
    new_bomb.allowGravity = true;
    new_bomb.bomb_id = bomb.id;
    GameData.bombs[bomb.id] = new_bomb;
    //console.debug('Bomb created:', bomb.id);
}

function game_spawn_bombs(bombs){
    $.each(bombs, function(id, bomb) {
        let old_bomb = game_get_bomb(id);
        if (!old_bomb) {
            game_spawn_bomb(bomb);
        }
    });
}

function game_destroy_bomb(id){
    let bomb = game_get_bomb(id);
    if (bomb) {
        bomb.destroy();
        //console.debug('Bomb destroyed:', id);
    }
}

function game_start(data){
    game_start_event();
    GameData.round++;
    GameData.round_text.setText('Round: ' + GameData.round);
    console.log('Game started with stars and bombs:', data.payload.stars, data.payload.bombs);
    game_spawn_bombs(data.payload.bombs);
    game_spawn_stars(data.payload.stars);
}

function game_delete_all_stars(){
    $.each(GameData.stars, function(id, star) {
        //console.debug('Deleting star:', id);
        star.disableBody(true, true);
        star.collected = true;
    });
}

function game_next_round(data){
    game_delete_all_stars();
    game_spawn_bombs(data.bombs);
    game_spawn_stars(data.stars);
    GameData.round++;
    GameData.round_text.setText('Round: ' + GameData.round);
}

function game_over(data){
    console.debug('GAME OVER!');
}

function game_bomb_hit(data){
    if (data.payload.player_id !== GameData.player_id) {
        let player = game_get_player(data.payload.player_id)
        if (player) {
            game_kill_player(data.payload.player_id);
        }
        game_destroy_bomb(data.payload.bomb_id);

    }
}

function game_player_movement(data){
    if (data.player_id !== GameData.player_id) {
        let player = GameData.players[data.player_id];//game_get_player(data.player_id);
        if (player) {
            player.setX(data.payload.x);
            player.setY(data.payload.y);
            if (player.anims) {
                player.anims.play(data.payload.facing, true);
            }
        }
    
        send_message("ack", {}, data.req_id);
    }
}

function game_player_joined(data){
    let player = game_get_player(data.player_id);
    if (!player) {
        game_spawn_other_player(data.player_id, 100, 450);
    }
}

function game_player_left(data){
    let player = game_get_player(data.player_id);
    if (player) {
        player.destroy();
    }
}

function game_get_player(id){
    return GameData.players[id];
}

function game_spawn_other_player(id, x, y) {
    const player = GameData.current_scene.add.sprite(x, y, 'dude');
    player.player_id = id;
    player.setTint(Math.random()*0xFFFFFF);
    GameData.players[id] = player;
}

function game_kill_player(id){
    let player = game_get_player(id);
    player.setTint(0xff0000);
    player.anims.play('turn');
    setTimeout(() => {
        player.destroy();
    }, 100);
}


function game_server_create_stars(){
    let stars = {};
    for ( var i = 0; i < 12; i++ ) {
        let uuid = generateUUIDv4();
        stars[uuid] = {};
        stars[uuid].id = uuid;
        stars[uuid].x = 12 + i * 70;
        stars[uuid].y = 0;
        stars[uuid].collected = false;
    }
    return stars;
}

function game_server_spawn_bomb(x, y, vx, vy){
    let bomb = {};
    bomb.id = generateUUIDv4();
    bomb.x = x;
    bomb.y = y;
    bomb.vx = vx;
    bomb.vy = vy;
    bomb.hit = false;
    return bomb;
}

function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
  }


function game_server_create_bombs(){
    let vx = getRandomArbitrary(-200, 200);
    let bomb = game_server_spawn_bomb(400, 300, vx, 0);
    
    let bombs = {}
    bombs[bomb.id] = bomb;
    return(bombs);
}

function game_server_collect_star(data){

    game_star_collected(data);

    if(game_all_stars_collected()){

        let stars = game_server_create_stars();
        let bombs = game_server_create_bombs();

        let data = {};
        data.topic = "next_round";
        data.payload = {};
        data.payload.stars = stars;
        data.payload.bombs = bombs;

        send_message("next_round", data.payload);

        game_next_round(data.payload);
    }else{

        send_message("star_collected", {
            star_id: data.payload.star_id
        }, data.req_id);
    }
}


function game_server_start_game(data){
    send_message("game_start", data.payload);
    game_start(data);
}

function game_server_hit_bomb(data){

    game_bomb_hit(data);

    send_message("bomb_hit", {
        player_id: data.payload.player_id,
        bomb_id: data.payload.bomb_id,
    }, data.req_id);
    
}

function update() {
    if (GameData.state === GAME_OVER || GameData.alive == false) {
        return;
    }
    GameData.movement.x = GameData.player.x;
    GameData.movement.y = GameData.player.y;

    if (GameData.cursors.left.isDown) {
        GameData.player.setVelocityX(-160);
        GameData.player.anims.play('left', true);
        GameData.movement.facing = 'left';

    } else if (GameData.cursors.right.isDown) {
        GameData.player.setVelocityX(160);
        GameData.player.anims.play('right', true);
        GameData.movement.facing = 'right';

    } else {
        GameData.player.setVelocityX(0);
        GameData.player.anims.play('turn');
        GameData.movement.facing = 'turn';
    }

    if (GameData.cursors.up.isDown && GameData.player.body.touching.down) {
        GameData.player.setVelocityY(-330);
    }
}

function collectStar(player, star) {
    star.disableBody(true, true);
    GameData.score += 10;
    GameData.score_text.setText('Score: ' + GameData.score);

    send_message('collect_star', { star_id: star.star_id });
}

function hitBomb(player, bomb) {
    player.setTint(0xff0000);
    bomb.setTint(0xff0000);
    player.setVelocity(0,0);
    bomb.setVelocity(0,0);

    player.anims.play('turn');
    send_message('hit_bomb', { bomb_id: bomb.bomb_id, player_id: GameData.player_id});
    GameData.alive = false;
    // Show "Game Over" message for the affected player
    let gameOverText = GameData.current_scene.add.text(400, 250, '\n YOU\nDIED  ', {
        fontSize: '64px',
        fill: '#ff0000',
        fontFamily: 'Ariel'
    });
    gameOverText.setOrigin(0.5, 0.5);  // Center the text on the screen

    setTimeout(() => {
        gameOverText.destroy();
    }, 3000); // 3000 ms = 3 seconds

    setTimeout(() => {
        player.destroy();
        bomb.destroy();
    }, 3000);
}

function send_message(topic, payload, req_id = null) {
    
    let ruuid = generateUUIDv4();

    if(req_id !== null) ruuid = req_id;

    let ts = Date.now();

    let json = {
        'req_id': ruuid,
        'topic': topic,
        'player_id': GameData.player_id,
        'payload': payload
    };

    if (topic === 'collect_star' | topic === 'hit_bomb' | topic === "movement"){
        requests[ruuid] = ts;
        //console.log("Requests:", requests);
    }

    game_send_data(json);
}

function game_server_handle_response(data){
    //console.log("Req_ID:", data.req_id);
    if (data.req_id in requests){
        let start = requests[data.req_id];
        //console.log("Start Time:", start);
        let end = Date.now();
        let time_delta = end-start;
        statistics.push(time_delta);

        if(statistics.length >= 100){
            const sum = statistics.reduce((accumulator, currentValue) => accumulator + currentValue, 0);
            const average = sum / statistics.length;

            console.log("Statistics:", statistics.toString(), average);
            statistics = [];
            requests = {};
        }
    }
}

function game_handle_data(data){

    if(!data.topic === "movement"){    
        //console.debug("Data Received: ", data);
    }

    if (data.topic === 'init'){
        game_init(data);
    } else if(data.topic === "player_joined"){
        game_player_joined(data);
    } else if(data.topic === "player_left"){
        game_player_left(data);
    } else if(data.topic === "game_start"){
        game_start(data);
    } else if(data.topic === "next_round"){
        game_next_round(data.payload);
    } else if(data.topic === "game_over"){
        game_over(data);
    } else if(data.topic === "player_movement"){
        //game_player_movement(data);
    } else if(data.topic === "star_collected"){
        game_star_collected(data);
    } else if(data.topic === "bomb_hit"){
        game_bomb_hit(data);
    } else if(data.topic == "movement"){        // Server mockup
        game_player_movement(data);
    } else if(data.topic == "start"){           // Server mockup
        game_server_start_game(data);
    } else if(data.topic == "collect_star"){    // Server mockup
        game_server_handle_response(data);
        game_server_collect_star(data);
    } else if(data.topic == "hit_bomb"){        // Server mockup
        game_server_handle_response(data);
        game_server_hit_bomb(data);
    } else if(data.topic == "ack"){        // Server mockup
        game_server_handle_response(data);
    } else{
        console.error("Unknown topic received", data);
    }
}
