import { System, SystemGroup } from '../../core/System.js';
import { Minimap } from '../Minimap.js';
import { Guide } from '../Guide.js';
import { GameHUD } from '../GameHUD.js';
import { fuelBurn } from '../Gear.js';

export class GameInputSystem extends System {

	update( _dt, game ) {

		const { app } = game;
		const inp = app.input;
		const can = game.canFish;
		if ( inp.hit( 'KeyR' ) && can && ! game.fight ) {

			game.rod.equip( ! game.rod.equipped );
			if ( ! game.rod.equipped ) game.cancelLine();
			game.toast( game.rod.equipped ? 'Rod out · hold left mouse to cast' : 'Rod away', 1600 );

		}
		if ( ! can && game.rod.equipped ) {

			game.cancelLine( true );
			game.rod.equip( false );

		}
		if ( inp.hit( 'KeyM' ) && game.minimap ) game.minimap.toggleExpanded();
		if ( inp.hit( 'KeyK' ) ) app.toggleWireframe();
		if ( game.hud && ( inp.hit( 'KeyI' ) || inp.hit( 'Tab' ) ) ) game.hud.toggleInventory();
		if ( game.hud && inp.hit( 'Escape' ) ) {

			game.hud.toggleInventory( false );
			game.hud.closeStand();

		}

	}

}

export class GamePresentationSystem extends System {

	start( game ) {

		const ui = game.app.ui && game.app.ui.ui;
		if ( ! ui || typeof document === 'undefined' || ! document.head ) return;
		if ( ! game.hud ) game.hud = new GameHUD( ui, game );
		if ( ! game.minimap ) game.minimap = new Minimap( ui.hud || ui.root, game );
		if ( ! game.guide ) game.guide = new Guide( ui, game, game.minimap );
		ui.onReplayGuide = () => game.guide.replay();

	}

	update( dt, game ) {

		if ( game.hud && game.hud.portrait ) game.hud.portrait.update( dt );
		if ( game.hud ) game.hud.update( game.getHUDState() );
		if ( game.minimap ) game.minimap.update( dt );
		if ( game.guide ) game.guide.update( dt );

	}

}

export class BoatSystem extends System {

	constructor( game ) {

		super( game );
		this.wasDriven = false;
		this.sonarTimer = 0;
		this.sonar = null;

	}

	update( dt, game ) {

		const { app, state } = game;
		const boat = app.boatCtl;
		const player = app.player;
		if ( boat.driven ) {

			const left = state.burn( fuelBurn( boat.rpm ) * dt );
			if ( left <= 0 ) {

				boat.throttle = 0;
				if ( ! game._fuelOut ) game.toast( 'Out of fuel · buy diesel at the chandlery by the boathouse', 4000 );
				game._fuelOut = true;

			}

		} else if ( this.wasDriven ) state.save();
		this.wasDriven = boat.driven;
		if ( ( player.mode === 'boat' || player.mode === 'deck' ) && state.stats.finder ) {

			this.sonarTimer -= dt;
			if ( this.sonarTimer <= 0 ) {

				this.sonarTimer = 0.5;
				const x = boat.position.x, z = boat.position.z;
				const depth = Math.max( 0, - app.terrainData.heightAt( x, z ) );
				const habitat = game.habitatAtPoint( x, z, depth );
				let rich = 0;
				for ( const key in habitat ) rich += habitat[ key ];
				this.sonar = { depth, fish: Math.min( 1, rich / 1.4 ) };

			}

		}
		game._sonar = this.sonar;

	}

}

export class VendorSystem extends System {

	update( _dt, game ) {

		const { app, hud } = game;
		const input = app.input;
		const player = app.player;
		for ( const vendor of game.vendors ) vendor.update( _dt, player.mode === 'walk' ? player.position : null );
		let near = null;
		if ( player.mode === 'walk' ) for ( const vendor of game.vendors ) if ( vendor.inRange( player.position ) ) near = vendor;
		for ( const vendor of game.vendors ) vendor.talking = !! ( hud && hud.standOpen && hud.vendor === vendor );
		if ( hud && hud.standOpen && ( ! near || near !== hud.vendor ) ) hud.closeStand();
		if ( ! near || game.fight || game._cardDismissed || ( hud && hud.catchOpen ) ) return;
		if ( ! player.prompt ) player.prompt = { key: 'E', text: hud && hud.standOpen ? 'Leave' : `Talk to ${ near.name.split( ' ·' )[ 0 ] }` };
		if ( input.hit( 'KeyE' ) ) {

			if ( ! hud ) {

				if ( near.kind === 'buyer' ) game.sellAll();

			} else if ( hud.standOpen ) hud.closeStand();
			else hud.openStand( near );

		}

	}

}

export class GameSystemGroup extends SystemGroup {

	constructor( game ) {

		super( [ new GameInputSystem(), new BoatSystem( game ), new VendorSystem(), new GamePresentationSystem() ], game );

	}

}

export { System, SystemGroup };

