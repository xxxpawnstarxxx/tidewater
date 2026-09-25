import { WORLD } from '../world/WorldLayout.js';
import { STAND } from './FishStand.js';
import { CHANDLERY } from './Chandlery.js';

// Minimap, lower right: the island baked once from the terrain data into a 2D canvas (depth-tinted
// sea, reef and seagrass, sand, grass and forest by height, rock, paths, village pads, the pier,
// hill shading and a coastline), shown in a round window that turns with the view (forward is up,
// a small N on the rim). Markers: the player (centre arrow), Joe's fish stand, Marta's chandlery
// and the boat; markers beyond the rim sit on it with an arrow. With the fish finder upgrade, a
// couple of soft rings mark the richest water in view.
//
// Per frame it only writes a few CSS transforms. The bake runs in row chunks over the first frames.
//   const map = new Minimap( hudEl, game );  map.update( dt );  map.highlight( [ 'joe', 'marta' ] )

const N = 768; // high-resolution dynamic map canvas
const MAP_PIXELS = 512; // samples per refresh; CSS interpolation keeps the result crisp
const MAP_REFRESH = 0.08; // refresh while moving, instead of baking a stale world map
const WORLD_PAD = 1.15; // keep the live view slightly beyond the circular mask

const CSS = /* css */`
.gm-map { position: absolute; right: var(--tw-edge); bottom: var(--tw-edge); width: calc(184 * var(--tw-u)); height: calc(184 * var(--tw-u));
	border-radius: 50%; padding: calc(5 * var(--tw-u)); pointer-events: none;
	transition: right var(--tw-slow) var(--tw-ease), bottom var(--tw-slow) var(--tw-ease), width var(--tw-med) var(--tw-ease), height var(--tw-med) var(--tw-ease), opacity var(--tw-med) var(--tw-ease); }
.tw-root[data-panel='open'] .gm-map { right: calc(var(--tw-panel-w) + 2 * var(--tw-3)); }
.gm-map.is-expanded { right: 50%; bottom: 50%; width: min(82vw, 900px); height: min(82vw, 900px); transform: translate(50%, 50%); z-index: 20; pointer-events: auto; border-radius: 28px; padding: calc(8 * var(--tw-u)); background: linear-gradient(145deg, rgba(15, 32, 43, .96), rgba(7, 17, 27, .98)); box-shadow: 0 28px 90px rgba(0,0,0,.55), 0 0 0 1px rgba(155, 238, 224, .24), inset 0 0 0 1px rgba(255,255,255,.08); }
.gm-map.is-expanded::before { content: 'TACTICAL SURVEY  /  LIVE TERRAIN'; position: absolute; left: calc(24 * var(--tw-u)); top: calc(16 * var(--tw-u)); z-index: 2; color: rgba(217, 246, 237, .82); font: 600 var(--tw-fs-xs) var(--tw-mono); letter-spacing: .16em; text-shadow: 0 1px 6px #06131d; }
.gm-map.is-expanded::after { content: 'M · close map   |   LIVE WORLD DATA'; position: absolute; left: 50%; bottom: calc(-28 * var(--tw-u)); transform: translateX(-50%); color: var(--tw-ink-3); font: 500 var(--tw-fs-xs) var(--tw-mono); white-space: nowrap; text-shadow: 0 1px 3px #000; }
.gm-map.is-expanded .gm-map-label { display: block; }
.gm-map.is-expanded .gm-map-view { border-radius: 20px; }
.gm-map.is-expanded .gm-map-vig { background: linear-gradient(180deg, rgba(4, 14, 21, .32), transparent 18%, transparent 78%, rgba(4, 14, 21, .38)); }
.gm-map.is-expanded .gm-map-me svg { width: calc(26 * var(--tw-u)); height: calc(26 * var(--tw-u)); left: calc(-13 * var(--tw-u)); top: calc(-14 * var(--tw-u)); }
.gm-map-view { position: relative; width: 100%; height: 100%; border-radius: 50%; overflow: hidden; background: #0b2c48;
	box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 18px rgba(0,0,0,0.45); }
.gm-map-view canvas { position: absolute; left: 0; top: 0; width: ${ N }px; height: ${ N }px; transform-origin: 0 0; image-rendering: auto; }
.gm-map-vig { position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
	background: radial-gradient(circle at 50% 50%, transparent 58%, rgba(4, 12, 20, 0.45) 100%); }
.gm-map-marks { position: absolute; inset: 0; }
.gm-mk { position: absolute; left: 0; top: 0; width: 0; height: 0; }
.gm-mk > i { position: absolute; left: 0; top: 0; display: grid; place-items: center; width: calc(20 * var(--tw-u)); height: calc(20 * var(--tw-u));
	margin: calc(-10 * var(--tw-u)) 0 0 calc(-10 * var(--tw-u)); border-radius: 50%; font: 700 calc(10 * var(--tw-u)) var(--tw-font); font-style: normal;
	color: #0b1418; box-shadow: 0 1px 3px rgba(0,0,0,0.55), 0 0 0 1.5px rgba(255,255,255,0.85); }
.gm-mk > i svg { width: 64%; height: 64%; }
.gm-mk.is-joe > i { background: var(--tw-sun); }
.gm-mk.is-marta > i { background: var(--tw-aqua); }
.gm-mk.is-boat > i { background: #f2efe6; }
.gm-mk > b { position: absolute; left: 0; top: 0; width: 0; height: 0; border-left: calc(5 * var(--tw-u)) solid transparent; border-right: calc(5 * var(--tw-u)) solid transparent;
	border-bottom: calc(7 * var(--tw-u)) solid rgba(255,255,255,0.9); margin: calc(-19 * var(--tw-u)) 0 0 calc(-5 * var(--tw-u)); transform-origin: calc(5 * var(--tw-u)) calc(19 * var(--tw-u)); display: none; }
.gm-mk.is-edge > b { display: block; }
.gm-mk.is-edge > i { transform: scale(0.82); }
.gm-mk.is-hot > i { animation: gm-map-pulse 1.3s var(--tw-ease-io) infinite; }
@keyframes gm-map-pulse { 0%, 100% { box-shadow: 0 1px 3px rgba(0,0,0,0.55), 0 0 0 1.5px rgba(255,255,255,0.85), 0 0 0 0 rgba(255,255,255,0.6); }
	60% { box-shadow: 0 1px 3px rgba(0,0,0,0.55), 0 0 0 1.5px rgba(255,255,255,0.85), 0 0 0 calc(10 * var(--tw-u)) rgba(255,255,255,0); } }
.gm-map-me { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
.gm-map-me svg { position: absolute; width: calc(18 * var(--tw-u)); height: calc(18 * var(--tw-u)); left: calc(-9 * var(--tw-u)); top: calc(-10 * var(--tw-u));
	filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6)); }
.gm-map-n { position: absolute; left: 0; top: 0; width: calc(14 * var(--tw-u)); height: calc(14 * var(--tw-u)); margin: calc(-7 * var(--tw-u)) 0 0 calc(-7 * var(--tw-u));
	border-radius: 50%; display: grid; place-items: center; font: 700 calc(9 * var(--tw-u)) var(--tw-font); color: #0b1418; background: rgba(255,255,255,0.9);
	box-shadow: 0 1px 2px rgba(0,0,0,0.5); }
.gm-map-fish { position: absolute; left: 0; top: 0; width: 0; height: 0; opacity: 0; transition: opacity 600ms var(--tw-ease); }
.gm-map-fish.is-on { opacity: 0.9; }
.gm-map-fish > i { position: absolute; left: calc(-12 * var(--tw-u)); top: calc(-12 * var(--tw-u)); width: calc(24 * var(--tw-u)); height: calc(24 * var(--tw-u));
	border-radius: 50%; border: 1.5px solid rgba(var(--tw-aqua-rgb), 0.9); animation: gm-map-ring 2.2s var(--tw-ease-io) infinite; }
.gm-map-fish > i + i { animation-delay: -1.1s; }
@keyframes gm-map-ring { 0% { transform: scale(0.45); } 100% { transform: scale(1.15); border-color: rgba(var(--tw-aqua-rgb), 0); } }
.gm-map-label { position: absolute; left: 50%; bottom: calc(-2 * var(--tw-u)); transform: translate(-50%, 100%); padding-top: calc(4 * var(--tw-u));
	font: 500 var(--tw-fs-xs) var(--tw-mono); color: var(--tw-ink-3); white-space: nowrap; text-shadow: 0 1px 2px rgba(0,0,0,0.7); display: none; }
/* short windows: the settings rail (right, vertically centred) reaches down to the corner */
@media (max-height: 860px) { .gm-map { right: calc(var(--tw-edge) + 58 * var(--tw-u)); } }
@media (max-width: 640px) { .gm-map { width: calc(128 * var(--tw-u)); height: calc(128 * var(--tw-u)); } }
@media (prefers-reduced-motion: reduce) { .gm-mk.is-hot > i, .gm-map-fish > i { animation: none; } }
`;

const ICON = {
	fish: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 12c3-4 7-6 11-6 3 0 5 2 7 4l-2 2 2 2c-2 2-4 4-7 4-4 0-8-2-11-6Zm12-1.2a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z"/></svg>',
	anchor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="5" r="2"/><path d="M12 7v13M7 11h10M4 14c1 4 4 6 8 6s7-2 8-6"/></svg>',
	boat: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v9H6l6-9Zm1 2 5 7h-5V5ZM3 14h18l-3 5H6l-3-5Z"/></svg>',
};

const h = ( tag, cls, html ) => {

	const e = document.createElement( tag );
	if ( cls ) e.className = cls;
	if ( html !== undefined ) e.innerHTML = html;
	return e;

};

const mix = ( a, b, t ) => [ a[ 0 ] + ( b[ 0 ] - a[ 0 ] ) * t, a[ 1 ] + ( b[ 1 ] - a[ 1 ] ) * t, a[ 2 ] + ( b[ 2 ] - a[ 2 ] ) * t ];
const sat = ( x ) => Math.min( 1, Math.max( 0, x ) );
const smooth = ( e0, e1, x ) => {

	const t = sat( ( x - e0 ) / ( e1 - e0 ) );
	return t * t * ( 3 - 2 * t );

};

// map palette (sRGB 0..255)
const C = {
	deep: [ 12, 44, 78 ], mid: [ 22, 104, 150 ], shallow: [ 62, 186, 190 ], foam: [ 186, 232, 226 ],
	grassSea: [ 34, 110, 108 ], rubble: [ 30, 84, 104 ],
	sand: [ 232, 216, 172 ], wet: [ 206, 190, 150 ], grass: [ 128, 160, 88 ], scrub: [ 88, 128, 64 ], forest: [ 52, 92, 50 ],
	rock: [ 132, 134, 126 ], path: [ 205, 182, 136 ], scarp: [ 176, 146, 104 ], pad: [ 196, 184, 162 ],
};

export class Minimap {

	constructor( parent, game ) {

		this.game = game;
		const style = h( 'style' );
		style.textContent = CSS;
		document.head.append( style );

		this.el = h( 'div', 'gm-map tw-glass', `<div class="gm-map-view"><canvas width="${ N }" height="${ N }"></canvas><div class="gm-map-vig"></div>
			<div class="gm-map-marks"></div>
			<div class="gm-map-me"><svg viewBox="0 0 24 24"><path d="M12 2 20 21 12 16.5 4 21Z" fill="#fff" stroke="#0b1418" stroke-width="1.4" stroke-linejoin="round"/></svg></div></div>` );
		this.el.setAttribute( 'aria-hidden', 'true' );
		this.el.setAttribute( 'role', 'dialog' );
		this.el.setAttribute( 'aria-label', 'Island map' );
		this.view = this.el.querySelector( '.gm-map-view' );
		this.canvas = this.el.querySelector( 'canvas' );
		this.marks = this.el.querySelector( '.gm-map-marks' );
		parent.append( this.el );

		const mk = ( kind, icon ) => {

			const e = h( 'div', 'gm-mk is-' + kind, `<b></b><i>${ icon }</i>` );
			this.marks.append( e );
			return { el: e, arrow: e.firstChild };

		};

		this.markers = [
			{ id: 'joe', ...mk( 'joe', ICON.fish ), pos: () => ( { x: STAND.x, z: STAND.z } ) },
			{ id: 'marta', ...mk( 'marta', ICON.anchor ), pos: () => ( { x: CHANDLERY.x, z: CHANDLERY.z } ) },
			{ id: 'boat', ...mk( 'boat', ICON.boat ), pos: () => {

				const b = game.app.boatCtl;
				return b ? { x: b.position.x, z: b.position.z } : null;

			}, hideWhen: () => {

				const p = game.app.player;
				return p.mode === 'boat' || p.mode === 'deck';

			} },
		];
		this.north = h( 'div', 'gm-map-n', 'N' );
		this.marks.append( this.north );
		this.fish = [ h( 'div', 'gm-map-fish', '<i></i><i></i>' ), h( 'div', 'gm-map-fish', '<i></i><i></i>' ) ];
		this.fish.forEach( ( f ) => this.marks.prepend( f ) );
		this._fishPts = [];
		this._fishT = 0;

		this.radiusM = 110; // world radius shown (m), eased between on foot and at sea
		this._hot = new Set();
		this._size = 0;
		this._bake = { ctx: this.canvas.getContext( '2d', { alpha: false } ) };
		this._mapT = 0;
		// the view's size, kept by a ResizeObserver (reading clientWidth per frame forces a style +
		// layout pass right after last frame's transform writes)
		this._viewSize = - 1;
		if ( typeof ResizeObserver !== 'undefined' ) {

			this._ro = new ResizeObserver( () => {

				this._viewSize = this.view.clientWidth;

			} );
			this._ro.observe( this.view );

		}

	}

	// style writes only when the value changes
	_setStyle( el, prop, value ) {

		const k = '__gm_' + prop;
		if ( el[ k ] === value ) return;
		el[ k ] = value;
		el.style[ prop ] = value;

	}

	_toggle( el, cls, on ) {

		const k = '__gm_c_' + cls;
		if ( el[ k ] === on ) return;
		el[ k ] = on;
		el.classList.toggle( cls, on );

	}

		highlight( ids = [] ) {

			this._hot = new Set( ids );
			for ( const m of this.markers ) this._toggle( m.el, 'is-hot', this._hot.has( m.id ) );

		}

		toggleExpanded( expanded = ! this.expanded ) {

			this.expanded = expanded;
			this._toggle( this.el, 'is-expanded', expanded );
			this.el.setAttribute( 'aria-hidden', expanded ? 'false' : 'true' );
			if ( expanded ) this._viewSize = - 1;

		}

		// ---- realtime renderer
	_renderRealtime( x, z, radiusM ) {

		const T = this.game.app.terrainData, ctx = this._bake.ctx;
		const n = MAP_PIXELS, scale = ( radiusM * WORLD_PAD * 2 ) / n;
		const idx = ( wx, wz ) => {
			const i = Math.floor( ( wx - T.origin ) / T.texel ), j = Math.floor( ( wz - T.origin ) / T.texel );
			return i < 0 || j < 0 || i >= T.res || j >= T.res ? - 1 : j * T.res + i;
		};
		const img = ctx.createImageData( n, n ), d = img.data;
		for ( let py = 0; py < n; py ++ ) for ( let px = 0; px < n; px ++ ) {
			const wx = x + ( px + 0.5 - n / 2 ) * scale, wz = z + ( py + 0.5 - n / 2 ) * scale;
			const hgt = T.heightAt( wx, wz ), k = idx( wx, wz ), dep = - hgt;
			let c;
			if ( hgt < 0 ) {
				c = dep < 7 ? mix( C.shallow, C.mid, smooth( 0.2, 7, dep ) ) : mix( C.mid, C.deep, smooth( 7, 48, dep ) );
				if ( k >= 0 ) { c = mix( c, C.grassSea, ( T.seagrass[ k ] / 255 ) * 0.6 ); c = mix( c, C.rubble, ( T.rubble[ k ] / 255 ) * 0.65 ); }
				c = mix( c, C.foam, smooth( 0.8, 0, dep ) * 0.55 );
			} else {
				const rock = k >= 0 ? T.rock[ k ] : 0, sand = k >= 0 ? T.sand[ k ] / 255 : 0;
				c = mix( C.grass, C.scrub, smooth( 4, 16, hgt ) ); c = mix( c, C.forest, smooth( 12, 40, hgt ) );
				c = mix( c, C.sand, Math.max( sand, smooth( 1.6, 0.4, hgt ) ) ); c = mix( c, C.wet, smooth( 0.5, 0, hgt ) * 0.6 ); c = mix( c, C.rock, smooth( 0.35, 0.7, rock ) );
				if ( k >= 0 ) { c = mix( c, C.path, ( T.path[ k ] / 255 ) * 0.9 ); c = mix( c, C.scarp, ( T.scarp[ k ] / 255 ) * 0.5 ); }
				const e = Math.max( 1.5, scale * 1.5 ), gx = ( T.heightAt( wx + e, wz ) - T.heightAt( wx - e, wz ) ) / ( 2 * e ), gz = ( T.heightAt( wx, wz + e ) - T.heightAt( wx, wz - e ) ) / ( 2 * e );
				const shade = 0.72 + 0.42 * sat( ( gx * 0.6 + gz * 0.6 + 0.53 ) / 0.53 ); c = [ c[ 0 ] * shade, c[ 1 ] * shade, c[ 2 ] * shade ];
			}
			const o = ( py * n + px ) * 4; d[ o ] = c[ 0 ]; d[ o + 1 ] = c[ 1 ]; d[ o + 2 ] = c[ 2 ]; d[ o + 3 ] = 255;
		}
		ctx.clearRect( 0, 0, N, N ); ctx.putImageData( img, ( N - n ) / 2, ( N - n ) / 2 );
		const P = ( wx, wz ) => [ ( wx - x ) / scale + n / 2 + ( N - n ) / 2, ( wz - z ) / scale + n / 2 + ( N - n ) / 2 ];
		ctx.strokeStyle = 'rgba(185, 238, 230, 0.2)'; ctx.lineWidth = 1;
		for ( let m = - 600; m <= 600; m += 100 ) { const q = P( x + m, z ); ctx.beginPath(); ctx.moveTo( q[ 0 ], 0 ); ctx.lineTo( q[ 0 ], N ); ctx.stroke(); const r = P( x, z + m ); ctx.beginPath(); ctx.moveTo( 0, r[ 1 ] ); ctx.lineTo( N, r[ 1 ] ); ctx.stroke(); }
		ctx.fillStyle = 'rgba(245, 235, 207, 0.72)';
		for ( const p of T.pads || [] ) { const q = P( p.x, p.z ), r = Math.max( 2, p.radius * 0.8 / scale ); ctx.fillRect( q[ 0 ] - r, q[ 1 ] - r, r * 2, r * 2 ); }
		const W = WORLD.pier; const a = P( W.x - Math.max( W.width, 3 ) / 2, W.zStart ), b = P( W.x + Math.max( W.width, 3 ) / 2, W.zEnd );
		ctx.fillStyle = '#e7d19d'; ctx.strokeStyle = 'rgba(24, 33, 43, 0.8)'; ctx.lineWidth = 2; ctx.fillRect( a[ 0 ], a[ 1 ], b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] ); ctx.strokeRect( a[ 0 ], a[ 1 ], b[ 0 ] - a[ 0 ], b[ 1 ] - a[ 1 ] );
		this._lastMapScale = scale;

	}

	// ---- per frame
	update( dt ) {

			const app = this.game.app, cam = app.camera, p = app.player;
		if ( this._viewSize < 0 || ! this._ro ) this._viewSize = this.view.clientWidth;
		const size = this._viewSize;
		if ( ! size ) return;
		const R = size / 2;

		// forward (xz) of the view
		const e = cam.matrixWorld.elements;
		let fx = - e[ 8 ], fz = - e[ 10 ];
		const fl = Math.hypot( fx, fz );
		if ( fl < 1e-4 ) {

			fx = 0; fz = - 1;

		} else {

			fx /= fl; fz /= fl;

		}

		const rx = - fz, rz = fx; // right
		const x = cam.position.x, z = cam.position.z;

		// zoom: close on foot, wider at sea
		const want = p.mode === 'boat' || p.mode === 'deck' || p.mode === 'swim' ? 240 : 110;
		this.radiusM += ( want - this.radiusM ) * ( 1 - Math.exp( - dt * 1.5 ) );
			const kpm = R / this.radiusM; // css px per metre

			// Generate the visible terrain around the player continuously. The canvas is
			// intentionally rebuilt in world space, so moving boats reveal fresh coastline.
			this._mapT -= dt;
			if ( this._mapT <= 0 || ! this._rendered ) {
				this._mapT = MAP_REFRESH;
				this._renderRealtime( x, z, this.radiusM );
				this._rendered = true;
			}

			// map: player at the centre, forward up
			const rot = - Math.PI / 2 - Math.atan2( fz, fx );
			const s = kpm / ( MAP_PIXELS / ( this.radiusM * WORLD_PAD * 2 ) );
			this._setStyle( this.canvas, 'transform', `translate(${ R }px, ${ R }px) rotate(${ rot }rad) scale(${ s }) translate(${ -N / 2 }px, ${ -N / 2 }px)` );

		const place = ( el, dx, dz, edgeInset, arrow ) => {

			let sx = ( dx * rx + dz * rz ) * kpm, sy = - ( dx * fx + dz * fz ) * kpm;
			const r = Math.hypot( sx, sy ), max = R - edgeInset;
			const edge = r > max;
			if ( edge ) {

				sx *= max / r; sy *= max / r;

			}

			this._setStyle( el, 'transform', `translate(${ R + sx }px, ${ R + sy }px)` );
			if ( arrow && edge ) this._setStyle( arrow, 'transform', `rotate(${ Math.atan2( sx, - sy ) }rad)` );
			return edge;

		};

		for ( const m of this.markers ) {

			const q = m.pos();
			const hide = ! q || ( m.hideWhen && m.hideWhen() );
			this._setStyle( m.el, 'display', hide ? 'none' : '' );
			if ( hide ) continue;
			const edge = place( m.el, q.x - x, q.z - z, 12, m.arrow );
			this._toggle( m.el, 'is-edge', edge );

		}

		// the N on the rim
		place( this.north, 0, - 1e6, 9 );

		// fish finder: the richest water nearby, refreshed now and then
		const finder = this.game.state.stats.finder;
		this._fishT -= dt;
		if ( finder && this._fishT <= 0 ) {

			this._fishT = 1.5;
			this._fishPts = this._richest( x, z, this.radiusM * 0.85 );

		}

		for ( let i = 0; i < this.fish.length; i ++ ) {

			const q = finder ? this._fishPts[ i ] : null;
			this._toggle( this.fish[ i ], 'is-on', !! q );
			if ( q ) place( this.fish[ i ], q.x - x, q.z - z, 14 );

		}

	}

	// the two richest points on a coarse polar grid around (x, z), at least 25 m apart
	_richest( x, z, r ) {

		const g = this.game, T = g.app.terrainData;
		const pts = [];
		for ( let ring = 1; ring <= 3; ring ++ ) for ( let a = 0; a < 12; a ++ ) {

			const ang = ( a / 12 ) * Math.PI * 2 + ring * 0.4, d = r * ring / 3;
			const px = x + Math.cos( ang ) * d, pz = z + Math.sin( ang ) * d;
			const depth = - T.heightAt( px, pz );
			if ( depth < 1 ) continue;
			const hab = g.habitatAtPoint( px, pz, depth );
			let rich = 0;
			for ( const k in hab ) rich += hab[ k ];
			if ( rich > 0.7 ) pts.push( { x: px, z: pz, rich } );

		}

		pts.sort( ( a, b ) => b.rich - a.rich );
		const out = [];
		for ( const q of pts ) if ( out.every( ( o ) => Math.hypot( o.x - q.x, o.z - q.z ) > 25 ) ) {

			out.push( q );
			if ( out.length === 2 ) break;

		}

		return out;

	}

}
