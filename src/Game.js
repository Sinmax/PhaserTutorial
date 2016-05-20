/* globals Phaser:false */

//  Generic global variables
var game;
var myDataRef, myPlayersRef, myStarsRef;
var myPlayerRef, myRivalRef;
var platforms, stars, starList=[], cursors, touchPoint;
var player, rival;
var score, ready;
var scoreText, scoreText2, loadingText;
var errText;

window.onload = function() {
    /* globals Phaser:false, BasicGame: false */
    //  Create your Phaser game and inject it into the game div.
    //  We did it in a window.onload event, but you can do it anywhere (requireJS load, anonymous function, jQuery dom ready, - whatever floats your boat)
    //  We're using a game size of 800 x 6000 here, but you can use whatever you feel makes sense for your game of course.
    var game = new Phaser.Game(800, 600, Phaser.AUTO, 'game');
    
    // Adding loagind and playing states & start the game.
    game.state.add("LoadingGame", LoadingGame);
    game.state.add("PlayGame", PlayGame);
    game.state.start("LoadingGame");
};

// create LoadingGame function
var LoadingGame = function (game) {};

// set LoadingGame function prototype
LoadingGame.prototype = {

    init: function () {
        // set up input max pointers
        this.input.maxPointers = 1;
        // set up stage disable visibility change
        this.stage.disableVisibilityChange = true;
        // Set up the scaling method used by the ScaleManager
        // Valid values for scaleMode are:
        // * EXACT_FIT
        // * NO_SCALE
        // * SHOW_ALL
        // * RESIZE
        // See http://docs.phaser.io/Phaser.ScaleManager.html for full document
        this.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
        // If you wish to align your game in the middle of the page then you can
        // set this value to true. It will place a re-calculated margin-left
        // pixel value onto the canvas element which is updated on orientation /
        // resizing events. It doesn't care about any other DOM element that may
        // be on the page, it literally just sets the margin.
        this.scale.pageAlignHorizontally = true;
        this.scale.pageAlignVertically = true;
        // Force the orientation in landscape or portrait.
        // * Set first to true to force landscape. 
        // * Set second to true to force portrait.
        this.scale.forceOrientation(false, true);
        // Sets the callback that will be called when the window resize event
        // occurs, or if set the parent container changes dimensions. Use this 
        // to handle responsive game layout options. Note that the callback will
        // only be called if the ScaleManager.scaleMode is set to RESIZE.
        this.scale.setResizeCallback(this.gameResized, this);
        // Set screen size automatically based on the scaleMode. This is only
        // needed if ScaleMode is not set to RESIZE.
        this.scale.updateLayout(true);
        // Re-calculate scale mode and update screen size. This only applies if
        // ScaleMode is not set to RESIZE.
        this.scale.refresh();
    },
    
    preload: function () {
        //  Preload needed media
        this.load.image('sky', 'assets/sky.png');
    },
    
    create: function () {
        //  A simple background for our game
        this.add.sprite(0, 0, 'sky');
        //  Set loading indicator text
        loadingText = this.add.text(300, 300, 'LOADING...', { fontSize: '32px', fill: '#000' });
        
        //  Connect to Firebase DB
        myDataRef = new Firebase('https://incandescent-fire-3223.firebaseio.com/');
        myPlayersRef = myDataRef.child('players');
        myStarsRef = myDataRef.child('stars');
        
        ready = 0;
        myPlayerRef=null; myRivalRef=null;
        
        myPlayersRef.once("value", function(snapshot) {
            var playerData = snapshot.val();
            
            //  Assuming 2 players are already entered in the database.
            //  Iterating through them - in the future maybe more to find one
            //  offline player slot to use; and one online player as a rival.
            var i;
            for ( i in playerData ) {
                //  If status is offline, use this slot for the current player,
                //  if we haven't done so in a previous iteration (==null),
                //  otherwise use the empty spot as a rival for now 
                //  (single player) until a rival arrives.
                if ( playerData[i].status == 'offline' ) {
                    if ( myPlayerRef==null ) {
                        myPlayerRef=myPlayersRef.child(i);
                        myPlayerRef.child('status').onDisconnect().set("offline");
                        myPlayerRef.update({'status':"online"});
                        ready++;
                    } else {
                        myRivalRef=myPlayersRef.child(i);
                        ready++;
                    }
                } else {
                    //  If player is online, use as a rival if we did not
                    //  chose a rival on a previous iteration.
                    if ( myRivalRef==null ) {
                        myRivalRef=myPlayersRef.child(i);
                        ready++;
                    }
                }
                //  If we have both player and rival slots selected, exit for.
                if (ready > 1) break;
            }
            if (ready < 2) {
                //  No free spot to use.
                loadingText.text = "Try again later!";
            } else {
                //  Start game, by switching state; 
                //  clear world (2nd parameter true)
                loadingText.text = "Starting...";
            }
        });
    },
    
    update: function() {
        if (ready > 1) {
            this.state.start("PlayGame",true,false);
        }
    }
};
        
// create PlayGame function
var PlayGame = function (game) {};

// set PlayGame function prototype
PlayGame.prototype = {
    
    preload: function () {
        //  Preload new needed media
        this.load.image('ground', 'assets/platform.png');
        this.load.image('star', 'assets/star.png');
        this.load.spritesheet('dude', 'assets/dude.png', 32, 48);
        this.load.spritesheet('dude2', 'assets/dude2.png', 32, 48);
    },
    
    create: function () {
        //  We're going to be using physics, so enable the Arcade Physics system
        this.physics.startSystem(Phaser.Physics.ARCADE);
        //  A simple background for our game
        this.add.sprite(0, 0, 'sky');
    
        //  The platforms group contains the ground and the 2 ledges we can jump on
        platforms = this.add.group();
        //  We will enable physics for any object that is created in this group
        platforms.enableBody = true;
        // Here we create the ground.
        var ground = platforms.create(0, this.world.height - 64, 'ground');
        //  Scale it to fit the width of the game (the original sprite is 400x32 in size)
        ground.scale.setTo(2, 2);
        //  This stops it from falling away when you jump on it
        ground.body.immovable = true;
        //  Now let's create two ledges
        var ledge = platforms.create(400, 400, 'ground');
        ledge.body.immovable = true;
        ledge = platforms.create(-150, 250, 'ground');
        ledge.body.immovable = true;


        // The player and its settings
        player = this.add.sprite(32, this.world.height - 150, 'dude');
        //  We need to enable physics on the player
        this.physics.arcade.enable(player);
        //  Player physics properties. Give the little guy a slight bounce.
        player.body.bounce.y = 0.2;
        player.body.gravity.y = 300;
        player.body.collideWorldBounds = true;
        //  Our two animations, walking left and right.
        player.animations.add('left', [0, 1, 2, 3], 10, true);
        player.animations.add('right', [5, 6, 7, 8], 10, true);
        
        // The player and its settings
        rival = this.add.sprite(32, this.world.height - 150, 'dude2');
        //
        //  No physics enable for rival as it's controlled by DB data.
        //
        //  Our two animations, walking left and right.
        rival.animations.add('left', [0, 1, 2, 3], 10, true);
        rival.animations.add('right', [5, 6, 7, 8], 10, true);
        //  Start with rival hidden.
        rival.visible = false;
        
        stars = this.add.group();
        stars.enableBody = true;
    
        //  Here we'll create 12 of them evenly spaced apart
        for (var i = 0; i < 12; i++)
        {
            //  Create a star inside of the 'stars' group
            var star = stars.create(i * 70, 0, 'star');
            starList[i]=star;
            //  Let gravity do its thing
            star.body.gravity.y = 6;
            //  This just gives each star a slightly random bounce value
            star.body.bounce.y = 0.7 + Math.random() * 0.2;
            
            // Set star data in database (replace old value)
            myStarsRef.child(i).set({'status':'on',
                                     'startx':star.body.x,
                                     'starty':star.body.y,
                                    });
                    
            myStarsRef.child(i).on("value", function(snapshot) {
                var i = snapshot.key();
                var starData = snapshot.val();
                if (starData.status == "off") {
                    starList[i].kill();
                } /*else {
                    starList[i].visible = true;
                    starList[i].x = starData.startx;
                    starList[i].y = starData.starty;
                }*/
            });
        }
        
        //  Create cursors and bind to keyboard
        cursors = this.input.keyboard.createCursorKeys();
        
        score = 0;
        scoreText = this.add.text(16, 16, 'Score: 0', { fontSize: '32px', fill: '#000' });
        scoreText2 = this.add.text(500, 16, 'Rival: none', { fontSize: '32px', fill: '#000' });
        errText = this.add.text(300, 550, 'Running...', { fontSize: '32px', fill: '#000' });
        
        //  Set initial player status in DB
        myPlayerRef.update({'x':player.x, 'y':player.y, 'score': 0});
        
        //  Connect to read rival data
        myRivalRef.on("value", function(snapshot) {
            var rivalData = snapshot.val();
            
            if (rivalData != null &&
                rivalData.status == 'online')
                {
                rival.visible = false;
                rival.x = rivalData.x;
                rival.y = rivalData.y;
                
                if (rivalData.animation == "none") {
                    rival.animations.stop();
                    rival.frame = 4;
                } else {
                    rival.animations.play(rivalData.animation);
                }
                scoreText2.text = 'Rival:'+rivalData.score;
                rival.visible = true;
            } else {
                rival.visible = false;
                scoreText2.text = 'Rival: none';
            }
        });
    },

    gameResized: function (width, height) {

        // This could be handy if you need to do any extra processing if the 
        // game resizes. A resize could happen if for example swapping 
        // orientation on a device or resizing the browser window. Note that 
        // this callback is only really useful if you use a ScaleMode of RESIZE 
        // and place it inside your main game state.

    },
    
    update: function () {
        
        //  Define touch poiunt based on activePointer.
        //  Define here instead of create method because this can change in time,
        //  not like the createCursorKeys, which is always liked to same input.
        touchPoint = this.input.activePointer;
        
        //  Collide the player and the stars with the platforms
        this.physics.arcade.collide(player, platforms);
        //  Collide the stars with the platforms
        this.physics.arcade.collide(stars, platforms);
        
        //  Add action when player overlaps with star
        this.physics.arcade.overlap(player, stars, this.collectStar, null, this);
        
        //  Reset the players velocity (movement)
        player.body.velocity.x = 0;
    
        var plAnimation = 'none';
        if (cursors.left.isDown || (touchPoint.isDown && touchPoint.x < player.body.x))
        {
            //  Move to the left
            player.body.velocity.x = -150;
            player.animations.play('left');
            plAnimation = 'left';
        }
        else if (cursors.right.isDown || (touchPoint.isDown && touchPoint.x  > player.body.x))
        {
            //  Move to the right
            player.body.velocity.x = 150;
            player.animations.play('right');
            plAnimation = 'right';
        }
        else
        {
            //  Stand still
            player.animations.stop();
            player.frame = 4;
        }
    
        //  Allow the player to jump if they are touching the ground.
        if ((cursors.up.isDown || (touchPoint.isDown && touchPoint.y < player.body.y)) && 
            player.body.touching.down)
        {
            player.body.velocity.y = -350;
        }
        
        myPlayerRef.update({'x':player.x, 'y':player.y, 'animation':plAnimation});
    },
    
    collectStar: function (player, star) {
        // Reset the star from the screen
        star.kill();
        myStarsRef.child(star.x/70).set({status:'off'});
        
        //  Add and update the score
        score += 10;
        scoreText.text = 'Score: ' + score;
        myPlayerRef.update({'score': score});
    }

};