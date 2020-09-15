
'use strict';

document.body.style.zoom = 1.0;

const XRES  = 1024;
const YRES  = 576;
const ARC_E = 0.01;
const ARMS  = [];

var gamePad;  // support optional gamepad controller

const SHIP = {
	s: 3,
	b: function() { return 14; },
	h: function() { return 30; }
};

const STARS = [];
const SNDS  = {};

const gc = $('#canvas')[0].getContext('2d');

gc.canvas.width  = XRES;
gc.canvas.height = YRES;

//--------------------------------------------------

var ship;
var pID;
var score = 0;
var ended = false;
var starFieldU;

var runLoop;

export const main = function()
{
	window.addEventListener('gamepadconnected', function(e)
	{
		gamePad = navigator.getGamepads()[e.gamepad.index];
	});

	ship = makeShip();
	ship.align();

	var fieldV = ship.u().mult(-1);

	loadSounds();
	makeStars();

	gc.font = '60px monospace';
	gc.textAlign = 'center';
	gc.strokeStyle = 'rgb(225, 225, 225)';
	gc.strokeText('USE NUMPAD KEYS,', XRES / 2, YRES / 2.3);
	gc.strokeText('OR MOUSE TO PLAY', XRES / 2, YRES / 1.8);

	$('#canvas').click(clickHandler);
	$(document).keypress(keyHandler);

	runLoop = animate();
}

function animate()
{
	var endID  = null;
	var agents = [];
	var spawn  = itemFactory(agents);

	agents.push(sniper(PATHS.a, 10));
	agents.push(sniper(PATHS.b, 20));
	agents.push(bomber(PATHS.c, blast1));
	agents.push(bomber(PATHS.d, blast1));
	agents.push(bomber(PATHS.g, blast2));
	agents.push(orbitoid(PATHS.e));
	agents.push(orbitoid(PATHS.f));
	agents.push(temple(butterfly(100)));

	return function()
	{
		$('#score').text('Score: ' + Math.round(score++ / 25));

		gc.clearRect(0, 0, XRES, YRES);

		agents.map(function(a)
		{
			a.move();
			a.draw();

			if (a.bonus && a.hit())
			{
				agents = remove(agents, a);
				spawn  = itemFactory(agents);

				a.bonus();
			}
		});

		STARS.map(function(s) { s.move() });
		STARS.map(function(s) { s.draw() });

		ARMS.map(function(a) { a.move() });
		ARMS.map(function(a) { a.draw() });

		ARMS.map(function(a)  // weapon hit?
		{
			if (ship.hull() < 1)   // game over
			{
				clearInterval(pID);
				sound('death');
				gc.save();

				var s = { x: 1, y: 1 };

				if (endID === null)
				{
					endID = setInterval(function()
					{
						if (s.x < 0.8)
						{
							gc.restore();
							gc.clearRect(0, 0, XRES, YRES);
							clearInterval(endID);
							gameOver();
							return;
						}
						s = { x: s.x - 0.0025, y: s.y - 0.0025 };

						gc.translate(XRES / 2, YRES / 2);
						gc.scale(s.x, s.y);
						gc.translate(-XRES / 2, -YRES / 2);
						gc.clearRect(0, 0, XRES, YRES);

						agents.map(function(a) { a.draw(); });
						drawShip();
					}, 1000 / 30);
				}
			}

			if (a.hit() && !ship.shielded())
			{
				ship.hitTime = 5;
				ship.setHull(ship.hull() - 1);
			}
			else if (a.hit() && ship.shielded())
			{
				ship.setShield(ship.shield() - 1);
			}
		});

		pruneArms();
		spawn();

		if (rebound(ship))  // rebounds against walls
		{
			ship.align(ship.heading());
			ship.move();
		}
		gamepadListener();

		ship.move();
		drawShip();
	};
}

//----------------------------------------------------

function gameOver()
{
      ended = true;

      var points = Math.round(score / 25);
      var player = $('#you').val();

      var as = range(0.25, 1,  0.015);
      var bs = range(1, 0.25, -0.015);
      var a  = as;
      var i  = 0;

      var showScores = function(scores)
      {
        gamepadListener();

        gc.clearRect(0, 0, XRES, YRES);
        gc.font = '60px monospace';
        gc.strokeText('HIGH SCORES', XRES / 2, 75);

        if (i == as.length - 1)
        {
          i = 0;
          a = a == as ? bs : as;
        }
        gc.strokeStyle = 'rgba(255, 255, 255, ' + a[++i] + ')';
        gc.font = '30px monospace';

        var f = function(s)
        {
          var ss = s.split(',');
          return ss[1] + ': ' + ss[0];
        };
        var ss = scores.split('\n');

        ss = ss.sort(function(a,b)
        {
          var f = parseInt;
          return f(a) == f(b) ? 0 : (f(a) < f(b) ? 1 : -1);
        }).map(f);

        for (let i = 0; i < ss.length - 1; i++)
        {
          gc.strokeText(ss[i], XRES / 2, 150 + 50 * i);
        }
      };

      var writeCB = function(msg)
      {
        $.get(URL + 'evader-scores', function(data)
        {
          setInterval(showScores(data), 1000 / 30);
        });
      };
      $.get(URL + 'put-evader-score/' + points + '/'
        + player, writeCB);
}

//--------------------------------------------------------

function keyHandler(e)
{
      pID = !pID ? setInterval(runLoop, 1000 / 30) : pID;

      if (ended)
      {
        window.location.reload();
      }
      var angles = {
        '3': 315, '9': 225,
        '8': 180, '7': 135,
        '4': 90 , '1': 45,
        '2': 360, '6': 270
      };
      var c = String.fromCharCode(e.which);

      switch (c)
      {
        case '7': ship.setU(vec(-1, -1));  break;
        case '8': ship.setU(vec( 0, -1));  break;
        case '9': ship.setU(vec( 1, -1));  break;
        case '4': ship.setU(vec(-1,  0));  break;
        case '6': ship.setU(vec( 1,  0));  break;
        case '1': ship.setU(vec(-1,  1));  break;
        case '2': ship.setU(vec( 0,  1));  break;
        case '3': ship.setU(vec( 1,  1));  break;
        // case 'f': setFullScreen();
      }
      ship.align(angles[c]);
}

    //----------------------------------------------------

function clickHandler(e)
{
      pID = !pID ? setInterval(runLoop, 1000 / 30) : pID;

      if (ended)
      {
        window.location.reload();
      }
      var u = vec(e.pageX - 20, e.pageY - 20);
      var c = centroid(ship.ps());

      ship.setU(u.sub(c).norm());
      ship.align(ship.heading());
    }

    function gamepadListener()
    {
      if (navigator.getGamepads && navigator.getGamepads()[0])
      {
        gamePad = navigator.getGamepads()[0];
      }
      if (gamePad != undefined)
      {
        if (ended)  // any button restarts game
        {
          var anyKey = gamePad.buttons.map(function (b)
          {
            return b.pressed;

          }).reduce(function(a,b) { return a || b; });

          if (anyKey)
          {
            window.location.reload();
          }
        }
        if (!zero(gamePad.axes[4]) || !zero(gamePad.axes[5]))
        {
          ship.setU(vec(gamePad.axes[4], gamePad.axes[5]));
          ship.align(ship.heading());
        }
      }
}

//-----------------------------------------

function drawShip()
{
      var a = ship.ps()[0];
      var b = ship.ps()[1];
      var c = ship.ps()[2];

      gc.lineWidth   = 2;
      gc.strokeStyle = ship.hitTime-- > 0 ? 
        'rgb(255, 35, 35)' : 'rgb(225, 225, 225)';

      gc.beginPath();
      gc.moveTo(a.x, a.y);
      gc.lineTo(b.x, b.y);
      gc.lineTo(c.x, c.y);
      gc.lineTo(a.x, a.y);
      gc.stroke();
      gc.closePath();

      var ic  = ship.incircle();
      var red = 255 - ship.hull();

      gc.strokeStyle = 'rgb(' + red + ', 100, 100)';
      gc.beginPath();
      gc.arc(ic.x, ic.y, ic.r, 0, Math.PI*2);
      gc.closePath();
      gc.stroke();

      gc.fillStyle = 'rgb(' + red + ', 100, 100)';
      gc.beginPath();
      gc.arc(ic.x, ic.y, ic.r / 2, 0, Math.PI*2);
      gc.closePath();
      gc.fill();

      if (ship.cloaked())
      {
        var cc = ship.circumcircle();

        gc.fillStyle = 'rgba(200, 100, 100, 0.35)';
        gc.beginPath();
        gc.arc(cc.x, cc.y, cc.r, 0, Math.PI*2);
        gc.closePath();
        gc.fill();
        gc.strokeStyle = 'rgba(200, 50, 50, 1.0)';
        gc.beginPath();
        gc.arc(cc.x, cc.y, cc.r + 1, 0, Math.PI*2);
        gc.closePath();
        gc.stroke();
      }
      else if (ship.shielded())
      {
        var cc = ship.circumcircle();

        gc.fillStyle = 'rgba(100, 100, 200, 0.35)';
        gc.beginPath();
        gc.arc(cc.x, cc.y, cc.r, 0, Math.PI*2);
        gc.closePath();
        gc.fill();
        gc.strokeStyle = 'rgba(75, 75, 250, 1.0)';
        gc.beginPath();
        gc.arc(cc.x, cc.y, cc.r + 1, 0, Math.PI*2);
        gc.closePath();
        gc.stroke();
      }
}

function drawBonus(p, rgb)
{
      for (let i = 0; i < 5; i++)
      {
        var a = parseFloat(i * 0.1 + 0.15);

        gc.fillStyle = 'rgba(255, 255, 255, ' + a + ')';
        gc.beginPath();
        gc.arc(p.x, p.y, 3 * (5 - i), 0, Math.PI*2);
        gc.closePath();
        gc.fill();
      }
      gc.fillStyle = rgbStr(rgb);
      gc.beginPath();
      gc.arc(p.x, p.y, 8, 0, Math.PI*2);
      gc.closePath();
      gc.fill();
}

    //---------------------------------------------

function rand(m, n)  // interval [n, m)
{
      n = n === undefined ? 0 : n;

      return Math.floor(Math.random() * (n - m)) + m;
}

function randSign()
{
      return Math.random() < 0.5 ? 1 : -1;
}

//-----------------------------------------------

function sniper(curve, inaccuracy)
{
      var i   = 1;
      var b   = true;
      var ps  = range(0, 1, 0.0025).map(fix(casteljau, curve));
      var r   = 3;
      var p   = vec(ps[0].x, ps[0].y);
      var rnd = rand(80, 120);

      var move = function()
      {
        b = (i < 1 || i == ps.length - 1) ? !b : b;
        i = i + (b ? 1 : -1);
        p = vec(ps[i].x, ps[i].y);

        if (--rnd < 1 && !ship.cloaked())  // beam attack
        {
          beam(p, 0.1, inaccuracy);
          sound('torpedo');
          rnd = rand(80, 120);
        }
      };

      var draw = function()
      {
        gc.strokeStyle = 'rgb(255, 255, 0)';
        gc.beginPath();
        gc.arc(p.x, p.y, r, 0, Math.PI * 2);
        gc.stroke();
      }

      return {
        ps:   function() { return ps },
        r:    function() { return r },
        p:    function() { return p },
        rnd:  function() { return rnd },
        move: function() { move() },
        draw: function() { draw() }
      };
}

function temple(ps)
{
      var i = 1;
      var b = true;
      var r = 3;
      var p = vec(ps[0].x, ps[0].y);

      var move = function()
      {
        b = (i < 1 || i == ps.length - 1) ? !b : b;
        i = i + (b ? 1 : -1);
        p = vec(ps[i].x, ps[i].y);

        var rgb = rgbGen(170, 200, 170, 200);
        bombs(p, 2, 0.5, 1, 4, 1, 0.05, 1, rgb);
      };

      var draw = function()
      {
        gc.fillStyle = 'rgba(255, 255, 0, 0.6)';
        gc.beginPath();
        gc.arc(p.x, p.y, r, 0, Math.PI * 2);
        gc.fill();
        gc.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        gc.beginPath();
        gc.arc(p.x, p.y, r + 1, 0, Math.PI * 2);
        gc.stroke();
      }

      return {
        ps:   function() { return ps },
        r:    function() { return r },
        p:    function() { return p },
        rnd:  function() { return rnd },
        move: function() { move() },
        draw: function() { draw() }
      };
}

function orbitoid(curve)
{
      var i    = 1;
      var b    = true;
      var ps   = justify(curve, ARC_E).map(fix(casteljau, curve));
      var p    = vec(ps[0].x, ps[0].y);
      var r    = 5;
      var ammo = 0;
      var rnd  = rand(3, 6);
      var prnd = rand(40, 80);

      var move = function()
      {
        b = (i < 1 || i == ps.length - 1) ? !b : b;
        i = i + (b ? 1 : -1);

        if (!ship.cloaked() && i % prnd == 0)  // burst attack
        {
          ammo = range(0.02, 0.06, 0.01);
          prnd = rand(40, 80);
          rnd  = rand(3, 6);
        }
        if (ammo.length > 0 && i % rnd == 0)
        {
          orb(p, (ammo.shift() / 2) + ((20 - ammo.length) / 2000));
          sound('orb');
        }
        p = vec(ps[i].x, ps[i].y);
      };

      var draw = function()
      {
        gc.strokeStyle = 'rgb(255, 125, 125)';
        gc.beginPath();
        gc.arc(p.x, p.y, r, 0, Math.PI * 2);
        gc.stroke();
      };

      return {
        ps:   function() { return ps },
        r:    function() { return r },
        p:    function() { return p },
        ammo: function() { return ammo },
        rnd:  function() { return rnd },
        move: function() { move() },
        draw: function() { draw() }
      };
}

function bomber(curve, attack)
{
      var i   = 1;
      var b   = true;
      var ps  = range(0, 1, 0.0025).map(fix(casteljau, curve));
      var r   = 8;
      var p   = vec(ps[0].x, ps[0].y);
      var rnd = rand(150, 250);
      var atk = 0;

      var move = function()
      {
        b = (i < 1 || i == ps.length - 1) ? !b : b;
        i = i + (b ? 1 : -1);
        p = vec(ps[i].x, ps[i].y);

        if (--rnd == 0)  // cluster bomb attack
        {
          rnd = rand(150, 250);
          atk = 32;

          attack(p);
          sound('bomb');
        }
      };

      var draw = function()
      {
        var rad = (0 < (atk--)) ? r * 2 : r;

        gc.fillStyle = 'rgba(255, 255, 50, 0.8)';
        gc.beginPath();
        gc.arc(p.x, p.y, rad, 0, Math.PI * 2);
        gc.fill();
        gc.fillStyle = 'rgba(175, 10, 5, 0.8)';
        gc.beginPath();
        gc.arc(p.x, p.y, rad * 0.9, 0, Math.PI * 2);
        gc.fill();
        gc.fillStyle = 'rgba(50, 0, 0, 0.8)';
        gc.beginPath();
        gc.arc(p.x, p.y, rad * 0.4, 0, Math.PI * 2);
        gc.fill();
      };

      return {
        ps:   function() { return ps },
        r:    function() { return r  },
        p:    function() { return p  },
        move: function() {  move()   },
        draw: function() {  draw()   }
      };
}

function blast1(p)
{
      bombs(p, 6, 0.5, 5, 100, 1.0, 0.01, 10,
        rgbGen(235, 255, 50, 200));
}

function blast2(p)
{
      bombs(p, 1, 0.2, 10, 300, 1.0, 0.01, 30,
        rgbGen(240, 255, 240, 255, 20, 40));
}

function makeShip()
{
      var u  = vec(0,0);  // heading vector
      var s  = SHIP.s;    // speed
      var d  = 0;         // initial angle
      var ps = [
        vec(XRES/2,  YRES/2),
        vec(XRES/2 - SHIP.b(), YRES/2 - SHIP.h()),
        vec(XRES/2 + SHIP.b(), YRES/2 - SHIP.h())
      ];
      var hull        = 255;
      var cloakTime   = 0;
      var shieldPower = 0;
      var hitTime     = 0;

      var translate = function(x,y)
      {
        ps = ps.map(function(u)
        {
          return u.add(vec(x,y));
        });
      };

      var circumcircle = function()
      {
        var a = ps[0];
        var b = ps[1];
        var c = ps[2];

        var m = ((a.x - c.x) * (a.x + c.x) 
              + ( a.y - c.y) * (a.y + c.y)) / 2 * (b.y - c.y)
              - ((b.x - c.x) * (b.x + c.x)
              + ( b.y - c.y) * (b.y + c.y)) / 2 * (a.y - c.y);

        var n = ((b.x - c.x) * (b.x + c.x)
              + ( b.y - c.y) * (b.y + c.y)) / 2 * (a.x - c.x)
              - ((a.x - c.x) * (a.x + c.x)
              + ( a.y - c.y) * (a.y + c.y)) / 2 * (b.x - c.x);

        var d = (a.x - c.x) * (b.y - c.y)
              - (b.x - c.x) * (a.y - c.y);

        var u = vec(m/d, n/d);

        return {
          x: m / d,
          y: n / d,
          u: u,
          r: dist(u, ps[0])
        };
      };

      var incircle = function()
      {
        var a = dist(ps[1], ps[2]);
        var b = dist(ps[2], ps[0]);
        var c = dist(ps[0], ps[1]);
        var d = a + b + c;
        var s = d / 2;

        return {
          x: (a * ps[0].x + b * ps[1].x + c * ps[2].x) / d,
          y: (a * ps[0].y + b * ps[1].y + c * ps[2].y) / d,
          r: Math.sqrt((s-a) * (s-b) * (s-c) / s),
          u: vec(this.x, this.y)
        };
      };

      var heading = function()
      {
        var r = Math.atan2(u.y, u.x);
        return r * 180 / Math.PI + 270;
      };

      var align = function(deg)
      {
        ps = rotate(ps, -d);
        d  = deg ? deg : d;
        ps = rotate(ps, d);
        starFieldU = vec(ship.u().x, ship.u().y).mult(-1);
      };

      var move = function()
      {
        ps = ps.map(function(p)
        {
          return p.add(u.mult(s));
        });
        cloakTime = 0 < cloakTime ? cloakTime  - 1 : 0;
      };

      var cloak = function()
      {
        cloakTime = 600;
      };

      var still = function()
      {
        return 0 == u.x && u.y == 0;
      };

      return {
        u:     function()        { return u },
        ps:    function()        { return ps },
        move:    function()      { move() },
        setU:    function(v)     { u = v },
        hull:    function()      { return hull },
        still:   function()      { return still() },
        cloak:   function()      { cloak() },
        align:   function(d)     { align(d) },
        shield:  function()      { return shieldPower },
        heading:   function()    { return heading() },
        cloaked:   function()    { return cloakTime  > 150 },
        setHull:   function(n)   { hull = n },
        shielded:  function()    { return shieldPower > 0 },
        incircle:  function()    { return incircle() },
        setShield: function(n)   { shieldPower = n },
        circumcircle: function() { return circumcircle() },
        translate: translate
      };
}

//------------------------------------------------------

function beam(u, s, rad)  // u is the beam origin
{
      var v = centroid(ship.ps()).sub(u);
      var w = u.add(v.mult(0.2));                // beam tip
      var r = vec(rand(20, rad), rand(20, rad)); // accuracy
      v     = v.add(vec(r.x * randSign(), r.y * randSign()));

      var blocked = false;

      var draw = function()
      {
        gc.lineWidth   = 3;
        gc.strokeStyle = 'rgba(255, 255, 0, 0.8)';
        gc.beginPath();
        gc.moveTo(u.x, u.y);
        gc.lineTo(w.x, w.y);
        gc.closePath();
        gc.stroke();
      };

      var move = function()
      {
        u = u.add(v.mult(s));
        w = blocked ? w : u.add(v.mult(0.2));
      };

      var hit = function()
      {
        if (blocked)
        {
          return false;
        }
        if (ship.shielded())
        {
          var cc = ship.circumcircle();

          if (distSquared(w, cc.u) < Math.pow(cc.r, 2))
          {
            blocked = true;
            return false;
          }
        }
        return inPgon(w, ship.ps());
      }

      var on = function()
      {
        if (blocked && distSquared(w, u) < 5)
        {
          return false;  // shield blocking animation done
        }
        return true;
      }

      ARMS.push({
        u:  function() { return u },  // position
        v:  function() { return v },  // velocity
        s:  function() { return s },  // scalar
        r: 2,
        on: on,
        draw: draw,
        move: move,
        hit: hit
      });
}

function orb(u, s)
{
      var v = centroid(ship.ps()).sub(u);
      var a = 1.0;

      var draw = function()
      {
        gc.fillStyle = 'rgba(0, 255, 0,' + a + ')';
        gc.beginPath();
        gc.arc(u.x, u.y, 2.5, 0, Math.PI*2);
        gc.closePath();
        gc.fill();
      };

      var move = function()
      {
        u  = u.add(v.mult(s));
        a -= 0.008;
      };

      var hit = function()
      {
        return inPgon(u, ship.ps());
      };

      var on = function()
      {
        if (ship.shielded())
        {
          var cc = ship.circumcircle();

          if (distSquared(u, cc.u) < Math.pow(cc.r, 2))
          {
            return false;
          }
        }
        return a > 0;
      };

      ARMS.push({
        u:  function() { return u },  // position
        v:  function() { return v },  // velocity
        s:  function() { return s },  // scalar
        r: 2,
        on: on,
        draw: draw,
        move: move,
        hit: hit
      });
}

function bombs(u, r, rA, d0, d1, a, dA, n, rgbG)
{
      var v    = vec(0,0);
      var ps   = [];
      var bs   = [];
      var rgbs = []; 

      for (let i = 0; i < n; i++)
      {
        var w = vec(rand(d0, d1), rand(d0, d1));
        w   = vec(w.x * randSign(), w.y * randSign());
        
        while (dist(u, u.add(w)) > d1)
        {
          w = vec(rand(d0, d1), rand(d0, d1));
          w = vec(w.x * randSign(), w.y * randSign());
        }
        rgbs.push(rgbG());
        ps.push(u.add(w));
      }

      var move = function()
      {
        a -= dA;
        r += rA;
      };

      var hit = function()
      {
        var cs = bs.filter(function(b)
        {
          var us = ship.ps().map(function(u)
          {
            return { x: u.x, y: u.y };
          });

          return dist(us[0], b) < r
              || dist(us[1], b) < r
              || dist(us[2], b) < r
              || dist(ship.incircle().u, b) < r;
        });
        return cs.length > 0;
      };

      ARMS.push({
        r:    r,
        move: move,
        hit:  hit,
        u:    function() { return u },  // position
        v:    function() { return v },  // velocity
        s:    function() { return s },  // scalar
        a:    function() { return a },  // scalar
        on:   function() { return a > 0 },
        draw: function()
        {
          if (0 < ps.length && rand(1, 50) % 3 == 0)
          {
            bs.push(ps.pop());
          }
          for (let i = 0; i < bs.length; i++)
          {
            gc.fillStyle = rgbStr(rgbs[i].concat([a]));
            gc.beginPath();
            gc.arc(bs[i].x, bs[i].y, r, 0, Math.PI*2);
            gc.closePath();
            gc.fill();
          }
        }
      });
}

//-----------------------------------------------

function shield(x, y)
{
      var p  = vec(x, y);
      var r  = 8;
      var id = rand(0, 99999999);

      var move = function() { };  // doesn't move

      var draw = function()
      {
        drawBonus(p, [0, 0, 255, 0.75]);
      };

      var hit = function()
      {
        if (ship.cloaked())
        {
          return false;
        }
        var cc = ship.circumcircle();
        return distSquared(p, cc.u) < Math.pow(cc.r + r, 2);
      };

      var bonus = function()
      {
        ship.setShield(50);
        sound('shield');
      };

      return {
        p:      function() { return p  },
        r:      function() { return r  },
        id:     function() { return id },
        move:   function() {  move()   },
        draw:   function() {  draw()   },
        hit:    hit,
        bonus:  bonus
      };
}

function cloak(x, y)
{
      var p  = vec(x, y);
      var r  = 10;
      var id = rand(0, 99999999);

      var move = function() { };  // doesn't move

      var draw = function()
      {
        drawBonus(p, [255, 0, 0, 0.75]);
      };

      var hit = function()
      {
        if (ship.shielded())
        {
          return false;
        }
        var cc = ship.circumcircle();
        return distSquared(p, cc.u) < Math.pow(cc.r + r, 2);
      };

      var bonus = function()
      {
        ship.cloak();
        sound('cloak');
      };

      return {
        p:      function() { return p  },
        r:      function() { return r  },
        id:     function() { return id },
        move:   function() {  move()   },
        draw:   function() {  draw()   },
        hit:    hit,
        bonus:  bonus
      };
}

function money(x, y)
{
      var p  = vec(x, y);
      var r  = 8;
      var id = rand(0, 99999999);

      var move = function() { };  // doesn't move

      var draw = function()
      {
        drawBonus(p, [0, 255, 0, 0.75]);
      };

      var hit = function()
      {
        var cc = ship.circumcircle();
        return distSquared(p, cc.u) < Math.pow(cc.r, 2);
      };

      var bonus = function()
      {
        score += 625;
        sound('money');
      };

      return {
        p:      function() { return p  },
        r:      function() { return r  },
        id:     function() { return id },
        move:   function() {  move()   },
        draw:   function() {  draw()   },
        hit:    hit,
        bonus:  bonus
      };
}

//---------------------------------------------------

function itemFactory(items)
{
      return function()
      {
        if (Math.random() < 0.0005)
        {
          items.push(temple(butterfly(100)));
        }
        if (Math.random() < 0.001)
        {
          var p = ['c','d','g','e','f'][rand(0, 5)];
          items.push(sniper(PATHS[p], 20));
        }
        if (Math.random() < 0.0007)
        {
          items.push(shield(rand(70, XRES - 70),
            rand(70, YRES - 70)));
        }
        if (Math.random() < 0.0007)
        {
          items.push(cloak(rand(70, XRES - 70),
            rand(70, YRES - 70)));
        }
        if (Math.random() < 0.0007)
        {
          items.push(money(rand(70, XRES - 70),
            rand(70, YRES - 70)));
        }
      };
}

//---------------------------------------------------

function star()
{
      var x2 = XRES + XRES / 2;
      var y2 = YRES + YRES / 2;

      var u = vec(rand(-x2, x2), rand(-y2, y2));
      var a = rand(0, 2) ? 0.5 : 0.9;
      var s = a < 0.7 ? 1.25 : 1.75;

      var draw = function()
      {
        gc.fillStyle = 'rgba(255, 255, 255,' + a + ')';
        gc.fillRect(u.x, u.y, 2, 2);
      };

      var move = function()
      {
        u = u.add(starFieldU.mult(s));
      };

      return {
        u: u,
        draw: draw,
        move: move
      };
}

function makeStars()
{
      for (let i = 0; i < 1000; i++)
      {
        STARS.push(star());
      }
}

//-----------------------------------------------

function loadSounds()
{
      SNDS['bomb']    = new Audio('/sounds/space-evader/bomb.ogg');
      SNDS['torpedo'] = new Audio('/sounds/space-evader/torpedo.ogg');
      SNDS['orb']     = new Audio('/sounds/space-evader/orb.ogg');
      SNDS['death']   = new Audio('/sounds/space-evader/death.ogg');
      SNDS['shield']  = new Audio('/sounds/space-evader/shield.ogg');
      SNDS['cloak']   = new Audio('/sounds/space-evader/cloak.ogg');
      SNDS['money']   = new Audio('/sounds/space-evader/money.ogg');

      SNDS['bomb'].volume    = 0.2;
      SNDS['torpedo'].volume = 0.15;
      SNDS['orb'].volume     = 0.1;
      SNDS['death'].volume   = 0.2;
      SNDS['shield'].volume  = 0.2;
      SNDS['cloak'].volume   = 0.2;
      SNDS['money'].volume   = 0.2;

      for (let k in SNDS)
      {
        SNDS[k].load();
      }
}

function sound(s)
{
      var snd = SNDS[s];

      if (snd.currentTime == 0 || snd.ended)
      {
        snd.play();
      }
}

//-----------------------------------------------

function pathLen(ps)
{
      var d = 0;

      for (let i = 0; i < ps.length - 1; i++)
      {
        d += dist(ps[i], ps[i+1]);
      }
      return d;
    }

    function justify(ps, e)
    {
      var f  = fix(casteljau, ps);
      var qs = range(0, 1, e).map(f);
      var d  = pathLen(qs) / 150;

      var ds = range(0, d * 150, d);
      var ts = [];
      var i  = 0;
      qs     = [ps[0]];

      for (let t = 0.0005; t < 1; t += 0.0005)
      {
        qs.push(f(t));

        if (pathLen(qs) > ds[i])
        {
          ts.push(t);
          i++;
        }
      }
      return ts;
}

function rotate(pgon, degree, o)
{
      o = o ? o : centroid(pgon);

      return pgon.map(function(p)
      {
        return p.rot(o, degree);
      });
}

function centroid(ps)  // arithmetic mean of ps
{
      var u = vec(0,0);

      ps.map(function(p)
      {
        u = u.add(p);
      });
      return u.div(ps.length);
}

function spriteCentroid(trigons)
{
      var us = [];

      trigons.map(function(t)
      {
        us.push(vec(t[0], t[1]));
        us.push(vec(t[2], t[3]));
        us.push(vec(t[4], t[5]));
      });
      return centroid(us);
}

function scaleSprite(s, sprite)  // broken
{
      var rgbs = sprite.map(function(a)
      {
        return a.pop();
      });
      sprite = sprite.reduce(function(a,b)
      {
        return a.concat(b);
      });
      var us = [];

      for (let i = 0; i < sprite.length; i += 2)
      {
        us.unshift(vec(sprite[i], sprite[i+1]));
      }
      var vs  = scale(s, us, centroid(us));
      var xys = [];

      vs.map(function(v)
      {
        xys.unshift(v.x);
        xys.unshift(v.y);
      });
      var ret = [];

      for (let i = 0; i < xys.length; i += 6)
      {
        ret.unshift(xys.slice(i, i+6));
      }
      for (let i = 0; i < ret.length; i++)
      {
        ret[i].push(rgbs[i]);
      }
      return ret;
}

function scale(s, ps, o)  // scale points
{
      var o = o ? o : centroid(ps);

      var qs = ps.map(function(p)
      {
        return vec(p.x, p.y).sub(o);
      });
      return qs.map(function(q)
      {
        return q.mult(s);

      }).map(function(p)
      {
        var t = p.add(o);
        return { x: t.x, y: t.y };
        //return p.add(o);
      });
}

function bounds(ps)
{
      var xs = ps.map(function(p) { return p.x; });
      var ys = ps.map(function(p) { return p.y; });

      return {
        x:  Math.min.apply(null, xs),
        y:  Math.min.apply(null, ys),
        x2: Math.max.apply(null, xs),
        y2: Math.max.apply(null, ys)
      };
}

function rebound(obj)
{
      var p = obj.rect || bounds(obj.ps());

      if (p.x < 1 || p.x2 > XRES - 1)
      {
        var dx = p.x < 1 ? 6 : -6;
        obj.setU(vec(-obj.u().x, obj.u().y));
        ship.translate(dx, 0);
        return true;
      }
      else if (p.y < 1 || p.y2 > YRES - 1)
      {
        var dy = p.y < 1 ? 6 : -6;
        obj.setU(vec(obj.u().x, -obj.u().y));
        ship.translate(0, dy);
        return true;
      }
      return false;
}

//---------------------------------------------

function ballBounds(b)
{
      return {
        x:  b.x - RADIUS,
        y:  b.y - RADIUS,
        x2: b.x + RADIUS,
        y2: b.y + RADIUS
      };
}

function inRect(r, p)
{
      return r.x < p.x && p.x < r.x2
          && r.y < p.y && p.y < r.y2;
}

function inScreen(p)
{
      return 0 < p.x && p.x < XRES
          && 0 < p.y && p.y < YRES;
}

function insidePolygon(p, ps)
{
      var ret = true;
      var b   = ccw(p, ps[0], ps[1]) < 0;

      for (let i = 1; i < ps.length - 1; i++)
      {
        ret &= (b == (ccw(p, ps[i], ps[i+1]) < 0));
      }
      return ret;
}

function ccw(a, b, c)  // 'counterclockwise'
{
      return (b.x - a.x) * (c.y - a.y)
           - (b.y - a.y) * (c.x - a.x);
}

function zero(n)
{
      return 0.01 > n && n > -0.01;
}

function equal(p,q)
{
      return p.x == q.x || p.y == q.y;
}

function dist(p,q)
{
      return Math.sqrt(Math.pow(q.x - p.x, 2)
           + Math.pow(q.y - p.y, 2));
}

function distSquared(p, q)  // more efficient
{
      return Math.pow(q.x - p.x, 2)
           + Math.pow(q.y - p.y, 2);
}

function inPgon(u, pgon)
{
      if (!inRect(bounds(pgon), u))
      {
        return false;
      }
      return insidePolygon(u, pgon);
};

function angle(p,q)  // not sure this works
{
	var u = vec(p,q);

	u.x = q.x - p.x;
	u.y = q.y - p.y;

	var len = Math.sqrt(u.x * u.x + u.y * u.y);
	var v   = u.norm();

	v.x /= (u.x / len);

	return Math.acos(v.x);
}

//----------------------------------------

function pruneArms()
{
	ARMS = ARMS.filter(function(a)
	{
		return a.on() && inScreen(a.u());
	});
}

//----------------------------------------

function contains(arr, obj)
{
	for (let i = 0; i < arr.length; i++)
	{
		if (arr[i].id == obj.id)
		{
			return true;
		}
	}
	return false;
}

function remove(arr, obj)
{
	return arr.filter(function(b)
	{
		return b.id != obj.id;
	});
}

//----------------------------------------

function fix(f, p)
{
	return function(q, r)
	{
		return f(p, q, r);
	};
}

function zipWith(f, xs, ys)
{
	let a = [];
	let p = { x: xs.length, y: ys.length };
	let n = p.x < p.y ? p.x : p.y;

	for (let i = 0; i < n; i++)
	{
		a[i] = f(xs[i], ys[i]);
	}
	return a;
}

function range(m, n, r)
{
	let a = [m];

	for (let i = 1; i < (n - m) / r; i++)
	{
		a[i] = a[i-1] + r;
	}
	a.push(n);
	return a;
}

//--------------------------------------------

function casteljau(ps, t)
{
	var f = function(t, a, b)
	{
		return (1 - t) * a + t * b;
	};

	var g = function(t, p, q)
	{
		return {
			x: f(t, p.x, q.x),
			y: f(t, p.y, q.y)
		};
	};

	if (ps.length == 1)
	{
		return ps[0];
	}
	var qs = zipWith(fix(g,t), ps, ps.slice(1));

	return casteljau(qs, t);
}

//--------------------------------------------------

function butterfly(s)   // Temple Fay's curve
{
	var ts = range(-100, 100, 0.0075);

	var sin5 = function(x)
	{
		return Math.sin(Math.sin(Math.sin(Math.sin(Math.sin(x)))));
	};
	var f = function(t)
	{
		return Math.sin(t) * (Math.pow(Math.E, Math.cos(t))
			- 2 * Math.cos(4*t) - sin5(t / 12));
	};
	var g = function(t)
	{
		return Math.cos(t) * (Math.pow(Math.E, Math.cos(t))
			- 2 * Math.cos(4*t) - sin5(t / 12));
	};

	return scale(s, ts.map(function(t)
	{
		return {
			x: f(t) + XRES / 2,
			y: -1 * g(t) + YRES / 2
		};
	}));
}
    
//--------------------------------------------------

function vec(x, y)
{
	return
	{
		x: x,
		y: y,

		add: function(u)
		{
			return vec(x + u.x, y + u.y);
		},
		sub: function(u)
		{
			return vec(x - u.x, y - u.y);
		},
		mult: function(n)
		{
			return vec(x*n, y*n);
		},
		div: function(n)
		{
			return vec(x/n, y/n);
		},
		mag: function()
		{
			return Math.sqrt(x*x + y*y);
		},
		norm: function()
		{
			return this.mag() == 0 ? null : this.div(this.mag());
		},
		rot: function(o, degree)
		{
			var u = this.sub(o);
			var r = degree * (Math.PI / 180);
			var a = u.x * Math.cos(r) - u.y * Math.sin(r);
			var b = u.x * Math.sin(r) + u.y * Math.cos(r);

			return vec(a,b).add(o);
		}
	};
}

//--------------------------------------------------------------------

function rgbStr(a)
{
	return 'rgba(' + a[0] + ',' + a[1] + ',' + a[2] + ',' + a[3] + ')';
}
    
function rgbGen(r0, r1, g0, g1, b0, b1)
{
	var b0 = b0 ? b0 : 0;
	var b1 = b1 ? b1 : 1;

	return function()
	{
		return [rand(r0, r1), rand(g0, g1), rand(b0, b1)];
	};
}

//--------------------------------------------------------------------

function setFullScreen()
{
	var e = $('body')[0];

	if (e.requestFullscreen)
	{
		e.requestFullscreen();
	}
	else if (e.mozRequestFullScreen)
	{
		e.mozRequestFullScreen();
	}
	else if (e.webkitRequestFullscreen)
	{
		e.webkitRequestFullscreen();
	}
	else if (e.msRequestFullscreen)
	{
		e.msRequestFullscreen();
	}
	setTimeout(setResolution, 100);
}

//--------------------------------------

const PATHS =
{
	a: [
		{ x: 6.0,    y:   6.0 },
		{ x: 1009.0, y:  12.0 },
		{ x: 11.0,   y: 564.0 },
		{ x: 1012.0, y: 566.0 }
	],

	b: [
		{ x: 522.0, y:   6.0 },
		{ x: 47.0,  y: 347.0 },
		{ x: 71.0,  y: 471.0 },
		{ x: 906.0, y: 202.0 },
		{ x: 9.0,   y:  12.0 }
	],

	c: [
		{ x: 913.0, y:  94.0 },
		{ x: 596.0, y: 214.0 },
		{ x: 821.0, y: 556.0 },
		{ x: 165.0, y:  47.0 },
		{ x: 477.0, y: 173.0 },
		{ x: 118.0, y: 461.0 }
	],

	d: [
		{ x: 528.0,  y:   8.0 },
		{ x: 677.0,  y: 554.0 },
		{ x: 71.0,   y:  26.0 },
		{ x: 134.0,  y:   4.0 },
		{ x: 693.0,  y:   0.0 },
		{ x: 598.0,  y: 120.0 },
		{ x: 1023.0, y: 493.0 },
		{ x: 642.0,  y: 392.0 },
		{ x: 11.0,   y: 309.0 },
		{ x: 506.0,  y: 564.0 }
	],

	e: [
		{ x: 529.0,  y: 301.0 },
		{ x: 780.0,  y: 158.0 },
		{ x: 73.0,   y: 236.0 },
		{ x: 1023.0, y: 575.0 },
		{ x: 367.0,  y:  29.0 },
		{ x: 580.0,  y: 313.0 }
	],

	f: [
		{ x: 328.0, y: 400.0 },
		{ x: 295.0, y: 507.0 },
		{ x: 184.0, y: 401.0 },
		{ x: 384.0, y: 370.0 },
		{ x: 195.0, y: 423.0 },
		{ x: 385.0, y: 444.0 },
		{ x: 387.0, y: 482.0 },
		{ x: 337.0, y: 255.0 },
		{ x: 289.0, y: 458.0 }
	],

	g: [
		{ x: 935.0,  y: 493.0 },   // an S-shaped
		{ x: 0.0,    y: 575.0 },   // curve from
		{ x: 0.0,    y: 489.0 },   // upper-left to
		{ x: 1023.0, y:  93.0 },   // bottom-right
		{ x: 1023.0, y:  32.0 },
		{ x: 70.0,   y:  59.0 }
	]
};

